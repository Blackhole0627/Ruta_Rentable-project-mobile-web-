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

export type PaymentMethod = 'transfer' | 'wallet' | 'cash' | 'poket' | 'other';

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

  // ---- Automatic gateway (LAFISE Poket) fields ----
  /** Gateway that owns this payment, e.g. 'poket'. Absent for manual transfers. */
  provider?: string;
  /** Poket PayLink id (its `id` / webhook `external_link_id`). The webhook
   * correlates a payment event back to this row through it. */
  externalLinkId?: string;
  /** Poket attempt id (`try_id`) recorded once a payment attempt finishes. */
  externalPaymentId?: string;
  /** Raw provider status (e.g. 'Created' | 'Authorized' | 'Failed'). */
  providerStatus?: string;
  /** Hosted Poket checkout URL the driver is redirected to. */
  checkoutUrl?: string;
}

/** A payment submission as seen by the admin review queue. */
export interface AdminPaymentRow extends Payment {
  userName?: string;
  userEmail?: string;
  planName?: string;
}
