import { create } from 'zustand';
import { addDays } from 'date-fns';
import type {
  SubscriptionPlan,
  Subscription,
  Payment,
} from '@shared/types/subscription.types';
import type { UserProfile } from '@shared/types/user.types';
import { getBackend } from '../backend';
import { useUserStore } from './useUserStore';
import {
  hasCapability,
  capabilitiesForPlan,
  defaultCapabilitiesFor,
  findPlan,
  isKycVerified,
} from '../subscription/planAccess';

/** Days a paid cycle lasts for a plan (admin-set; falls back to 30). */
function planDurationDays(plan: SubscriptionPlan | undefined): number {
  return plan?.durationDays && plan.durationDays > 0 ? plan.durationDays : 30;
}

/** Pick the canonical plan id from profile, subscription, or last payment. */
function resolveCurrentPlanId(
  raw: string | undefined,
  plans: SubscriptionPlan[],
  subscription: Subscription | null,
  payments: Payment[],
): string {
  const id = raw ?? 'free';
  if (id === 'free') return 'free';
  if (findPlan(plans, id)) return id;
  const subId = subscription?.planId;
  if (subId && findPlan(plans, subId)) return subId;
  const paid = payments.find((p) => p.status === 'confirmed' && p.planId);
  if (paid?.planId && findPlan(plans, paid.planId)) return paid.planId;
  return id;
}

const backend = getBackend();

interface SubscriptionState {
  plans: SubscriptionPlan[];
  subscription: Subscription | null;
  payments: Payment[];
  isLoading: boolean;
  load: () => Promise<void>;
  /**
   * Start an automatic Poket card payment. Redirects the browser to the hosted
   * checkout and resolves `{ redirected: true }`. On the mock backend the
   * payment is simulated instantly (no redirect) and it resolves
   * `{ redirected: false }` after refreshing local state.
   */
  startPoketCheckout: (planId: string) => Promise<{ redirected: boolean }>;
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
    const plans = await backend.listPlans(user?.currentPlan);
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
          // KYC is admin-authoritative — always take the server's value.
          kycStatus: profile.kycStatus ?? 'none',
        }
      : { ...user };

    next.currentPlan = resolveCurrentPlanId(
      next.currentPlan,
      plans,
      subscription,
      payments ?? [],
    );

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
    // gating across the app reflects whatever the admin configured. A paid plan
    // is only effective once KYC is verified (AML/UAF regulatory gate).
    const planEffective =
      planId !== 'free' &&
      isKycVerified(next) &&
      (next.subscriptionStatus === 'active' || next.subscriptionStatus === 'trial') &&
      (!next.subscriptionEndsAt ||
        new Date(next.subscriptionEndsAt).getTime() >= Date.now());
    const effId = planEffective ? planId : 'free';
    const ref = findPlan(plans, effId);
    const effPlan = ref ? plans.find((p) => p.id === ref.id) : undefined;
    next.planCapabilities = capabilitiesForPlan(effPlan, effId);

    const capsChanged =
      (next.planCapabilities ?? []).join(',') !== (user.planCapabilities ?? []).join(',');
    const changed =
      next.currentPlan !== user.currentPlan ||
      next.subscriptionStatus !== user.subscriptionStatus ||
      (next.freeCalculationsUsed ?? 0) !== (user.freeCalculationsUsed ?? 0) ||
      next.subscriptionEndsAt !== user.subscriptionEndsAt ||
      (next.kycStatus ?? 'none') !== (user.kycStatus ?? 'none') ||
      capsChanged;
    if (changed) await useUserStore.getState().setUser(next);

    set({ plans, subscription, payments, isLoading: false });
  },
  startPoketCheckout: async (planId) => {
    const user = useUserStore.getState().user;
    if (!user) return { redirected: false };
    const { checkoutUrl } = await backend.createPoketLink(planId);
    if (checkoutUrl) {
      // Real gateway: hand the driver off to Poket's hosted checkout. The
      // subscription is activated later by the webhook; on return the page
      // reloads and reflects the new status.
      window.location.href = checkoutUrl;
      return { redirected: true };
    }
    // Mock backend simulated an instant success — just refresh local state.
    await get().load();
    return { redirected: false };
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
    await backend.cancelSubscription(user.id);
    await useUserStore.getState().setUser({
      ...user,
      currentPlan: 'free',
      subscriptionStatus: 'cancelled',
      subscriptionEndsAt: undefined,
      planCapabilities: defaultCapabilitiesFor('free'),
      updatedAt: new Date(),
    });
    await get().load();
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
