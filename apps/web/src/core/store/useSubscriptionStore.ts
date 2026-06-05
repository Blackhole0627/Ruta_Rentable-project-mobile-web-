import { create } from 'zustand';
import type {
  SubscriptionPlan,
  Subscription,
  Payment,
  PaymentMethod,
} from '@shared/types/subscription.types';
import { getBackend } from '../backend';
import { useUserStore } from './useUserStore';

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
    if (user) {
      // Tolerate per-user fetch failures (e.g. RLS) without breaking the page.
      const [subscription, payments] = await Promise.all([
        backend.getSubscription(user.id).catch(() => null),
        backend.listPayments(user.id).catch(() => []),
      ]);
      set({ plans, subscription, payments, isLoading: false });
    } else {
      set({ plans, isLoading: false });
    }
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

/** Whether the user has hit the free-tier calculation limit. */
export function isCalcLimitReached(
  plan: string | undefined,
  used: number | undefined,
  plans: SubscriptionPlan[],
): boolean {
  const current = plans.find((p) => p.id === (plan ?? 'free'));
  const limit = current?.calcLimit;
  if (limit === null || limit === undefined) return false;
  return (used ?? 0) >= limit;
}
