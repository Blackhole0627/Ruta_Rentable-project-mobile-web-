export type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'cancelled';

/** Feature flags a plan can unlock. The admin toggles these per plan and the
 * app gates real features off them (see core/subscription/planAccess). */
export type PlanCapability =
  | 'unlimitedCalc'
  | 'reports'
  | 'cloudSync'
  | 'multiVehicle'
  | 'breakEven'
  | 'cooperative';

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceNio?: number;
  priceUsd?: number;
  /** null = unlimited calculations */
  calcLimit?: number | null;
  /** Marketing bullet points shown on the plan card. */
  features?: string[];
  /** Features this plan actually unlocks (admin-controlled gating). */
  capabilities?: PlanCapability[];
  /** Days a paid cycle lasts before it expires (default 30). */
  durationDays?: number;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string; // ISO date
  endDate?: string; // ISO date
}

export type PaymentMethod = 'transfer' | 'wallet' | 'cash' | 'other';

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  /** Plan the user is paying for (used to activate on approval). */
  planId?: string;
  amount: number;
  currency: 'NIO' | 'USD';
  method: PaymentMethod;
  status: 'confirmed' | 'pending' | 'rejected';
  receiptUrl?: string;
  paidAt: string; // ISO datetime
}

/** A payment submission as seen by the admin review queue. */
export interface AdminPaymentRow extends Payment {
  userName?: string;
  userEmail?: string;
  planName?: string;
}
