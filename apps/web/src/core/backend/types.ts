import type { UserProfile } from '@shared/types/user.types';
import type { UserVehicle, CatalogVehicle } from '@shared/types/vehicle.types';
import type { Trip } from '@shared/types/trip.types';
import type { AuthSession, UserRole } from '@shared/types/auth.types';
import type { AppNotification } from '@shared/types/notification.types';
import type {
  SubscriptionPlan,
  Subscription,
  Payment,
  AdminPaymentRow,
} from '@shared/types/subscription.types';
import type {
  AdminUserRow,
  AdminMetrics,
  GlobalParameters,
  Announcement,
} from '@shared/types/admin.types';
import type {
  Cooperative,
  CoopMember,
  FleetReport,
  CooperativeParams,
  CoopInvite,
} from '@shared/types/cooperative.types';
import type { SettingsRecord } from '../db/schema';

/** A full snapshot of one user's syncable data. */
export interface CloudSnapshot {
  profile: UserProfile | null;
  vehicles: UserVehicle[];
  trips: Trip[];
  settings: SettingsRecord | null;
}

export interface DeletionRecord {
  table: 'vehicles' | 'trips';
  id: string;
  at: number;
}

/**
 * Single abstraction over the Stage-2 backend. Two implementations exist:
 * a real Supabase adapter (when env credentials are present) and a local
 * mock adapter (Dexie-backed "cloud") so the entire S2 surface — auth, sync,
 * subscriptions, and the admin panel — runs without live credentials.
 */
export interface BackendAdapter {
  readonly isMock: boolean;

  // ---- Auth ----
  getSession(): Promise<AuthSession | null>;
  /** Request an OTP code by email. Mock returns the code for the dev UI. */
  requestOtp(email: string): Promise<{ devCode?: string }>;
  verifyOtp(email: string, token: string): Promise<AuthSession>;
  /** Email + password sign-in (used for admin to avoid OTP email limits). */
  signInWithPassword(email: string, password: string): Promise<AuthSession>;
  /** Create an account with name + email + password. Returns null if the email
   * needs confirmation (caller then verifies an OTP). */
  signUp(name: string, email: string, password: string): Promise<AuthSession | null>;
  /** Google OAuth. Real backend redirects (returns null); mock returns a session. */
  signInWithGoogle(): Promise<AuthSession | null>;
  requestPasswordRecovery(email: string): Promise<{ devCode?: string }>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;

  // ---- Data sync ----
  pullData(userId: string): Promise<CloudSnapshot>;
  pushData(userId: string, snapshot: CloudSnapshot): Promise<void>;
  deleteRecords(userId: string, deletions: DeletionRecord[]): Promise<void>;

  // ---- Subscriptions & payments ----
  listPlans(): Promise<SubscriptionPlan[]>;
  getSubscription(userId: string): Promise<Subscription | null>;
  listPayments(userId: string): Promise<Payment[]>;
  recordPayment(payment: Payment): Promise<Payment>;

  // ---- Admin ----
  adminListUsers(): Promise<AdminUserRow[]>;
  adminGetMetrics(): Promise<AdminMetrics>;
  adminUpdateUserStatus(
    userId: string,
    status: AdminUserRow['status'],
  ): Promise<void>;
  adminListPlans(): Promise<SubscriptionPlan[]>;
  adminUpsertPlan(plan: SubscriptionPlan): Promise<SubscriptionPlan>;
  adminGetParameters(): Promise<GlobalParameters>;
  adminUpdateParameters(params: GlobalParameters): Promise<void>;
  adminListCatalog(): Promise<CatalogVehicle[]>;
  adminUpsertCatalog(entry: CatalogVehicle): Promise<CatalogVehicle>;
  adminDeleteCatalog(id: string): Promise<void>;
  adminListAnnouncements(): Promise<Announcement[]>;
  adminCreateAnnouncement(announcement: Announcement): Promise<Announcement>;
  /** Manual bank-transfer payment review queue. */
  adminListPayments(): Promise<AdminPaymentRow[]>;
  adminReviewPayment(id: string, approve: boolean): Promise<void>;

  // ---- Cooperatives / Fleets (S3) ----
  /** The cooperative the user administers or belongs to, if any. */
  getMyCooperative(userId: string): Promise<Cooperative | null>;
  createCooperative(userId: string, name: string): Promise<Cooperative>;
  updateCooperativeParams(coopId: string, params: CooperativeParams): Promise<void>;
  inviteDriver(coopId: string, email: string): Promise<CoopMember>;
  removeMember(memberId: string): Promise<void>;
  /** Pending invitations for a driver to accept/reject. */
  listPendingInvites(userId: string): Promise<CoopInvite[]>;
  respondToInvite(memberId: string, accept: boolean): Promise<void>;
  /** A member leaves the cooperative they belong to. */
  leaveCooperative(userId: string, coopId: string): Promise<void>;
  getFleetReport(coopId: string): Promise<FleetReport>;
  recordGroupPayment(coopId: string, amount: number): Promise<void>;

  // ---- Notifications ----
  listNotifications(userId: string): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;

  // ---- Admin: roles ----
  adminSetUserRole(userId: string, role: UserRole): Promise<void>;
}
