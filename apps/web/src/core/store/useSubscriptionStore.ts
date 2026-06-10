import { create } from 'zustand';
import { addDays } from 'date-fns';
import type {
  SubscriptionPlan,
  Subscription,
  Payment,
  PaymentMethod,
} from '@shared/types/subscription.types';
import type { UserProfile } from '@shared/types/user.types';
import { getBackend } from '../backend';
import { useUserStore } from './useUserStore';
import { hasCapability, defaultCapabilitiesFor } from '../subscription/planAccess';

/** Days a paid cycle lasts for a plan (admin-set; falls back to 30). */
function planDurationDays(plan: SubscriptionPlan | undefined): number {
  return plan?.durationDays && plan.durationDays > 0 ? plan.durationDays : 30;
}

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

    // Expiry: a paid plan lasts `durationDays` (admin-set) from the last
    // confirmed payment. Past that it lapses to 'overdue' (caps fall to free).
    const planId = next.currentPlan ?? 'free';
    const durationDays = planDurationDays(plans.find((p) => p.id === planId));
    const lastPaid = (payments ?? [])
      .filter((p) => p.status === 'confirmed')
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];
    const isPaidPlan = planId !== 'free';
    if (lastPaid && isPaidPlan) {
      const endsAt = addDays(new Date(lastPaid.paidAt), durationDays);
      next.subscriptionEndsAt = endsAt.toISOString();
      if (endsAt.getTime() < Date.now()) next.subscriptionStatus = 'overdue';
    } else {
      next.subscriptionEndsAt = undefined;
    }

    // Snapshot the EFFECTIVE plan's admin-defined capabilities onto the user so
    // gating across the app reflects whatever the admin configured.
    const active =
      next.subscriptionStatus === 'active' &&
      (!next.subscriptionEndsAt ||
        new Date(next.subscriptionEndsAt).getTime() >= Date.now());
    const effId = active ? planId : 'free';
    const effPlan = plans.find((p) => p.id === effId);
    next.planCapabilities = effPlan?.capabilities ?? defaultCapabilitiesFor(effId);

    const capsChanged =
      (next.planCapabilities ?? []).join(',') !== (user.planCapabilities ?? []).join(',');
    const changed =
      next.currentPlan !== user.currentPlan ||
      next.subscriptionStatus !== user.subscriptionStatus ||
      (next.freeCalculationsUsed ?? 0) !== (user.freeCalculationsUsed ?? 0) ||
      next.subscriptionEndsAt !== user.subscriptionEndsAt ||
      capsChanged;
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
      subscriptionEndsAt: addDays(new Date(), planDurationDays(plan)).toISOString(),
      planCapabilities: plan.capabilities ?? defaultCapabilitiesFor(planId),
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
