import type { SubscriptionStatus } from './subscription.types';
import type { UserRole } from './auth.types';

export type Currency = 'NIO' | 'USD';
export type FuelUnit = 'liter' | 'gallon';

export interface UserProfile {
  id: string;
  name: string;
  currency: Currency;
  fuelUnit: FuelUnit;
  onboardingComplete: boolean;
  registeredAt: Date;

  // Stage 2 — account & subscription (optional so V1 local profiles still validate)
  email?: string;
  phone?: string;
  role?: UserRole;
  subscriptionStatus?: SubscriptionStatus;
  currentPlan?: string;
  freeCalculationsUsed?: number;
  /** Month the free-calc counter belongs to (YYYY-MM); resets each month. */
  freeCalcPeriod?: string;
  /** ISO date a paid plan expires (1 month after the last confirmed payment). */
  subscriptionEndsAt?: string;
  /** True when the user belongs to a cooperative whose admin's plan is active
   * (grants premium to member drivers — they don't pay individually). */
  coopActive?: boolean;
  updatedAt?: Date;
}
