import type { UserProfile } from '@shared/types/user.types';
import type { PlanCapability } from '@shared/types/subscription.types';

/**
 * Plan capability model. Capabilities are ADMIN-CONTROLLED: each plan carries a
 * `capabilities` list (edited in the admin panel) which the subscription store
 * denormalises onto the user as `planCapabilities`. The hard-coded tiers below
 * are only a fallback/default for the built-in plan ids when a plan record
 * doesn't specify its own capabilities yet.
 */
export type Capability = PlanCapability;

const DEFAULT_TIERS: Record<string, Capability[]> = {
  free: [],
  basic: ['unlimitedCalc', 'reports', 'cloudSync'],
  pro: ['unlimitedCalc', 'reports', 'cloudSync', 'multiVehicle', 'breakEven'],
  coop: ['unlimitedCalc', 'reports', 'cloudSync', 'multiVehicle', 'breakEven', 'cooperative'],
};

// Unknown/custom paid plan with no explicit capabilities → pro-level default.
const UNKNOWN_PAID: Capability[] = [
  'unlimitedCalc',
  'reports',
  'cloudSync',
  'multiVehicle',
  'breakEven',
];

// Premium a coop member receives while their cooperative is active (excludes
// 'cooperative' management, which stays with the paying coop admin).
const PREMIUM_VIA_COOP: Capability[] = [
  'unlimitedCalc',
  'reports',
  'cloudSync',
  'multiVehicle',
  'breakEven',
];

export const ALL_CAPABILITIES: Capability[] = [
  'unlimitedCalc',
  'reports',
  'cloudSync',
  'multiVehicle',
  'breakEven',
  'cooperative',
];

/** Built-in default capabilities for a plan id (fallback when a plan record
 * has none). */
export function defaultCapabilitiesFor(planId: string): Capability[] {
  if (planId === 'free') return DEFAULT_TIERS.free;
  return DEFAULT_TIERS[planId] ?? UNKNOWN_PAID;
}

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

/** The capabilities the user currently has — admin-defined snapshot first,
 * falling back to the built-in defaults for the effective plan. */
function userCapabilities(user: UserProfile | null | undefined): Capability[] {
  if (user?.planCapabilities && Array.isArray(user.planCapabilities)) {
    return user.planCapabilities;
  }
  return defaultCapabilitiesFor(effectivePlanId(user));
}

export function hasCapability(
  user: UserProfile | null | undefined,
  cap: Capability,
): boolean {
  if (userCapabilities(user).includes(cap)) return true;
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
