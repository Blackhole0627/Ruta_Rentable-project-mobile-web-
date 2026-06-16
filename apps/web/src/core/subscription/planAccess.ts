import type { UserProfile } from '@shared/types/user.types';
import type { PlanCapability, SubscriptionPlan } from '@shared/types/subscription.types';
import { KYC_ENABLED } from '../featureFlags';

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

const BUILTIN_PLAN_NAMES: Record<string, string> = {
  free: 'Gratis',
  basic: 'Básico',
  pro: 'Pro',
  coop: 'Cooperativa',
};

export function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** Resolve a plan record from the catalog (by id or built-in slug). */
export function findPlan(
  plans: Pick<SubscriptionPlan, 'id' | 'name'>[],
  planId: string | undefined,
): Pick<SubscriptionPlan, 'id' | 'name'> | undefined {
  if (!planId || planId === 'free') return undefined;
  const direct = plans.find((p) => p.id === planId);
  if (direct) return direct;
  const builtin = BUILTIN_PLAN_NAMES[planId];
  if (builtin) return { id: planId, name: builtin };
  return undefined;
}

/** Human-readable plan label — never shows a raw UUID to the driver. */
export function planDisplayName(
  planId: string | undefined,
  plans: Pick<SubscriptionPlan, 'id' | 'name'>[],
  translate?: (key: string) => string,
): string {
  const t = translate ?? ((s) => s);
  if (!planId || planId === 'free') return t('Gratis');
  const plan = findPlan(plans, planId);
  if (plan) return plan.name;
  if (isUuidLike(planId)) return t('Plan de pago');
  return BUILTIN_PLAN_NAMES[planId] ?? planId;
}

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

/** Capabilities configured on a plan record; falls back to built-in defaults
 * when the admin hasn't set any (undefined or empty array). */
export function capabilitiesForPlan(
  plan: { capabilities?: Capability[] } | undefined,
  planId: string,
): Capability[] {
  const caps = plan?.capabilities;
  if (caps && caps.length > 0) return caps;
  return defaultCapabilitiesFor(planId);
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

/** True once the user's identity has been verified by an admin (AML/UAF gate).
 * When the KYC feature is disabled (build flag) everyone counts as verified. */
export function isKycVerified(user: UserProfile | null | undefined): boolean {
  if (!KYC_ENABLED) return true;
  return user?.kycStatus === 'verified';
}

/**
 * Whether the driver still needs to complete KYC for the paid plan they hold or
 * are signing up for. Free tier never needs KYC. Returns true while a paid plan
 * is selected/active but identity isn't yet verified. Always false when the KYC
 * feature is disabled.
 */
export function needsKyc(user: UserProfile | null | undefined): boolean {
  if (!KYC_ENABLED) return false;
  if (!user) return false;
  const plan = user.currentPlan ?? 'free';
  if (plan === 'free') return false;
  return !isKycVerified(user);
}

/** True when the user's paid plan (or trial) should unlock plan features.
 * A paid plan is only effective once KYC is verified (regulatory gate). */
export function isPlanEffective(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const plan = user.currentPlan ?? 'free';
  if (plan === 'free') return false;
  const status = user.subscriptionStatus;
  if (status !== 'active' && status !== 'trial') return false;
  if (user.subscriptionEndsAt && new Date(user.subscriptionEndsAt).getTime() < Date.now()) {
    return false;
  }
  // AML gate: an unverified driver cannot hold an effective paid subscription.
  if (!isKycVerified(user)) return false;
  return true;
}

/** The plan that actually applies right now — 'free' if expired/inactive. */
export function effectivePlanId(user: UserProfile | null | undefined): string {
  if (!user) return 'free';
  const plan = user.currentPlan ?? 'free';
  if (plan === 'free') return 'free';
  return isPlanEffective(user) ? plan : 'free';
}

/** The capabilities the user currently has — admin-defined snapshot first,
 * falling back to the built-in defaults for the effective plan. */
function userCapabilities(user: UserProfile | null | undefined): Capability[] {
  const caps = user?.planCapabilities;
  if (caps && caps.length > 0) return caps;
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
