import { create } from 'zustand';
import { addMonths } from 'date-fns';
import type {
  SubscriptionPlan,
  Subscription,
  Payment,
  PaymentMethod,
} from '@shared/types/subscription.types';
import type { UserProfile } from '@shared/types/user.types';
import { getBackend } from '../backend';
import { useUserStore } from './useUserStore';
import { hasCapability } from '../subscription/planAccess';

const backend = getBackend();

interface SubscriptionState {
  plans: SubscriptionPlan[];
  subscription: Subscription | null;
  payments: Payment[];
  isLoading: boolean;
  load: () => Promise<void>;
  subscribe: (planId: string, method: PaymentMethod) => Promise<void>;
  /** Submit a bank-transfer receipt for admin review (status: pending). */
  submitReceipt: (planId: string, receiptUrl: string) => Promise<void>;
  /** Cancel the current plan so a different one can be chosen. */
  unsubscribe: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plans: [],
  subscription: null,
  payments: [],
  isLoading: false,
  load: async () => {
    const user = useUserStore.getState().user;
    set({ isLoading: true });
    const plans = await backend.listPlans();
    if (!user) {
      set({ plans, isLoading: false });
      return;
    }
    // Tolerate per-user fetch failures (e.g. RLS) without breaking the page.
    const [profile, subscription, payments] = await Promise.all([
      backend.getProfile(user.id).catch(() => null),
      backend.getSubscription(user.id).catch(() => null),
      backend.listPayments(user.id).catch(() => []),
    ]);

    // Start from the server profile when present — the admin may have approved a
    // payment server-side, flipping the plan/status.
    const next: UserProfile = profile
      ? {
          ...user,
          currentPlan: profile.currentPlan,
          subscriptionStatus: profile.subscriptionStatus,
          freeCalculationsUsed: profile.freeCalculationsUsed,
        }
      : { ...user };

    // Monthly expiry: a paid plan lasts 1 month from the last confirmed payment.
    // Past that it lapses to 'overdue' (capabilities fall back to free).
    const lastPaid = (payments ?? [])
      .filter((p) => p.status === 'confirmed')
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];
    const isPaidPlan = (next.currentPlan ?? 'free') !== 'free';
    if (lastPaid && isPaidPlan) {
      const endsAt = addMonths(new Date(lastPaid.paidAt), 1);
      next.subscriptionEndsAt = endsAt.toISOString();
      if (endsAt.getTime() < Date.now()) next.subscriptionStatus = 'overdue';
    } else {
      next.subscriptionEndsAt = undefined;
    }

    const changed =
      next.currentPlan !== user.currentPlan ||
      next.subscriptionStatus !== user.subscriptionStatus ||
      (next.freeCalculationsUsed ?? 0) !== (user.freeCalculationsUsed ?? 0) ||
      next.subscriptionEndsAt !== user.subscriptionEndsAt;
    if (changed) await useUserStore.getState().setUser(next);

    set({ plans, subscription, payments, isLoading: false });
  },
  subscribe: async (planId, method) => {
    const user = useUserStore.getState().user;
    if (!user) return;
    const plan = get().plans.find((p) => p.id === planId);
    if (!plan) return;
    const payment: Payment = {
      id: crypto.randomUUID(),
      userId: user.id,
      amount: plan.priceNio ?? 0,
      currency: 'NIO',
      method,
      status: 'confirmed',
      paidAt: new Date().toISOString(),
    };
    await backend.recordPayment(payment);
    await useUserStore.getState().setUser({
      ...user,
      currentPlan: planId,
      subscriptionStatus: 'active',
      freeCalculationsUsed: 0,
      subscriptionEndsAt: addMonths(new Date(), 1).toISOString(),
      updatedAt: new Date(),
    });
    const [subscription, payments] = await Promise.all([
      backend.getSubscription(user.id),
      backend.listPayments(user.id),
    ]);
    set({ subscription, payments });
  },
  submitReceipt: async (planId, receiptUrl) => {
    const user = useUserStore.getState().user;
    if (!user) return;
    const plan = get().plans.find((p) => p.id === planId);
    if (!plan) return;
    const payment: Payment = {
      id: crypto.randomUUID(),
      userId: user.id,
      planId,
      amount: plan.priceNio ?? 0,
      currency: 'NIO',
      method: 'transfer',
      status: 'pending',
      receiptUrl,
      paidAt: new Date().toISOString(),
    };
    await backend.recordPayment(payment);
    const payments = await backend.listPayments(user.id);
    set({ payments });
  },
  unsubscribe: async () => {
    const user = useUserStore.getState().user;
    if (!user) return;
    await useUserStore.getState().setUser({
      ...user,
      currentPlan: 'free',
      subscriptionStatus: 'cancelled',
      updatedAt: new Date(),
    });
  },
}));

/** Whether the user has hit the free-tier calculation limit (this month). */
export function isCalcLimitReached(
  user: UserProfile | null | undefined,
  used: number | undefined,
  plans: SubscriptionPlan[],
): boolean {
  // Paid plan OR active cooperative → unlimited.
  if (hasCapability(user, 'unlimitedCalc')) return false;
  const free = plans.find((p) => p.id === 'free');
  const limit = free?.calcLimit;
  if (limit === null || limit === undefined) return false;
  return (used ?? 0) >= limit;
}
