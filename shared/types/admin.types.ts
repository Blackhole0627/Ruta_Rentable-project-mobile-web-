import type { SubscriptionStatus } from './subscription.types';
import type { Platform } from './trip.types';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  currentPlan: string;
  status: SubscriptionStatus;
  lastActive?: string; // ISO datetime
  tripsCount: number;
  revenue: number; // total confirmed payments (NIO)
  registeredAt: string; // ISO datetime
}

export interface AdminMetrics {
  activeUsers: number;
  trialUsers: number;
  overdueAccounts: number;
  newSignupsThisMonth: number;
  monthlyRevenue: number; // NIO, current month confirmed payments
  churnRate: number; // 0..1
  revenueByMonth: { month: string; revenue: number }[];
  userGrowth: { month: string; users: number }[];
}

/** Global parameters editable by the owner and applied to all drivers. */
export interface GlobalParameters {
  gasolinePerLiter: number;
  dieselPerLiter: number;
  commissions: Record<Platform, number>;
  profitableThreshold: number; // decimal
  acceptableThreshold: number; // decimal
  desiredMargin: number; // decimal
}

export type AnnouncementTarget =
  | { kind: 'all' }
  | { kind: 'plan'; plan: string }
  | { kind: 'status'; status: SubscriptionStatus };

export interface Announcement {
  id: string;
  title: string;
  body: string;
  target: AnnouncementTarget;
  /** ISO datetime; if in the future the announcement is scheduled. */
  sendAt: string;
  createdAt: string;
}
