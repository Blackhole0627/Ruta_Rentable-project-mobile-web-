import type { UserProfile } from '@shared/types/user.types';

/**
 * Plan capability model (strict cumulative tiers).
 *   free  → basic calculator + local history + monthly free-calc limit
 *   basic → unlimited calcs, reports, cloud history
 *   pro   → + multiple vehicles, break-even
 *   coop  → + cooperative / fleet tools
 * Plans are gated by capability so the UI never has to hard-code plan ids.
 */
export type Capability =
  | 'unlimitedCalc'
  | 'reports'
  | 'cloudSync'
  | 'multiVehicle'
  | 'breakEven'
  | 'cooperative';

const TIERS: Record<string, Capability[]> = {
  free: [],
  basic: ['unlimitedCalc', 'reports', 'cloudSync'],
  pro: ['unlimitedCalc', 'reports', 'cloudSync', 'multiVehicle', 'breakEven'],
  coop: ['unlimitedCalc', 'reports', 'cloudSync', 'multiVehicle', 'breakEven', 'cooperative'],
};

// Admin-created plans may carry an unknown (UUID) id. Don't under-deliver to a
// paying user — grant pro-level access; only the built-in 'coop' unlocks fleets.
const UNKNOWN_PAID: Capability[] = [
  'unlimitedCalc',
  'reports',
  'cloudSync',
  'multiVehicle',
  'breakEven',
];

/** True while a paid plan is active AND not past its expiry date. */
export function isSubscriptionActive(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (user.subscriptionStatus !== 'active') return false;
  if (user.subscriptionEndsAt && new Date(user.subscriptionEndsAt).getTime() < Date.now()) {
    return false;
  }
  return true;
}

/** The plan that actually applies right now — 'free' if expired/inactive. */
export function effectivePlanId(user: UserProfile | null | undefined): string {
  if (!user) return 'free';
  const plan = user.currentPlan ?? 'free';
  if (plan === 'free') return 'free';
  return isSubscriptionActive(user) ? plan : 'free';
}

function capsFor(planId: string): Capability[] {
  if (planId === 'free') return TIERS.free;
  return TIERS[planId] ?? UNKNOWN_PAID;
}

// Premium a coop member receives while their cooperative is active. Excludes
// 'cooperative' (managing a fleet stays with the paying coop admin).
const PREMIUM_VIA_COOP: Capability[] = [
  'unlimitedCalc',
  'reports',
  'cloudSync',
  'multiVehicle',
  'breakEven',
];

export function hasCapability(
  user: UserProfile | null | undefined,
  cap: Capability,
): boolean {
  if (capsFor(effectivePlanId(user)).includes(cap)) return true;
  // A driver in an active cooperative gets premium even on the free plan,
  // because the coop admin pays for the whole fleet.
  if (user?.coopActive && PREMIUM_VIA_COOP.includes(cap)) return true;
  return false;
}

/** Spanish tier label needed to unlock a capability — for upgrade prompts. */
export function planForCapability(cap: Capability): string {
  if (cap === 'cooperative') return 'Cooperativa';
  if (cap === 'multiVehicle' || cap === 'breakEven') return 'Pro';
  return 'Básico';
}

/** Current month key, e.g. "2026-06". */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Free-tier calculations used in the CURRENT month (0 after a month rolls over). */
export function freeCalcsUsedThisMonth(user: UserProfile | null | undefined): number {
  if (!user) return 0;
  return user.freeCalcPeriod === currentMonthKey() ? user.freeCalculationsUsed ?? 0 : 0;
}
