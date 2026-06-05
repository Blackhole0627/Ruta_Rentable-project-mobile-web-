export type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'cancelled';

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceNio?: number;
  priceUsd?: number;
  /** null = unlimited calculations */
  calcLimit?: number | null;
  features?: string[];
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
