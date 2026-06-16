import { useEffect, useMemo } from 'react';
import { useUserStore } from '@/core/store/useUserStore';
import { useSubscriptionStore } from '@/core/store/useSubscriptionStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import {
  hasCapability,
  effectivePlanId,
  capabilitiesForPlan,
  findPlan,
  type Capability,
} from '@/core/subscription/planAccess';

/**
 * Reactive plan gating — keeps subscription/plan catalog in sync so UI locks
 * (e.g. multi-vehicle) reflect the admin-defined plan, not a stale local user.
 */
export function useHasCapability(cap: Capability): boolean {
  const user = useUserStore((s) => s.user);
  const plans = useSubscriptionStore((s) => s.plans);
  const load = useSubscriptionStore((s) => s.load);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'authenticated') void load();
  }, [status, load]);

  return useMemo(() => {
    if (hasCapability(user, cap)) return true;
    if (!user || !plans.length) return false;
    const effId = effectivePlanId(user);
    if (effId === 'free') return false;
    const ref = findPlan(plans, effId);
    if (!ref) return false;
    const plan = plans.find((p) => p.id === ref.id);
    return capabilitiesForPlan(plan, effId).includes(cap);
  }, [user, plans, cap]);
}
