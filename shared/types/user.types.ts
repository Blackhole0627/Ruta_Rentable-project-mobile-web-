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
  updatedAt?: Date;
}
