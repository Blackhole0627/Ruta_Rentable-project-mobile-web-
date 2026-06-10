import type { UserProfile } from '@shared/types/user.types';
import type { UserVehicle, CatalogVehicle } from '@shared/types/vehicle.types';
import type { Trip } from '@shared/types/trip.types';
import type { AuthSession } from '@shared/types/auth.types';
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
  FleetDriverSummary,
  CooperativeParams,
  CoopInvite,
} from '@shared/types/cooperative.types';
import { MAX_COOP_DRIVERS } from '@shared/types/cooperative.types';
import type { AppNotification } from '@shared/types/notification.types';
import type { BackendAdapter, CloudSnapshot, DeletionRecord } from './types';
import { cloudDb, ensureCloudSeed, type CloudUser } from './cloudDb';
import { isAdminEmail } from './config';
import { loadStoredSession, storeSession, clearStoredSession } from './session';

const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function stripUserId<T extends { userId: string }>(record: T): Omit<T, 'userId'> {
  const { userId: _userId, ...rest } = record;
  void _userId;
  return rest;
}

/** Local Dexie-backed implementation of the backend — no network required. */
export class MockBackend implements BackendAdapter {
  readonly isMock = true;
  private session: AuthSession | null = null;

  constructor() {
    this.session = loadStoredSession();
  }

  private async ready() {
    await ensureCloudSeed();
  }

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  async requestOtp(email: string): Promise<{ devCode?: string }> {
    await this.ready();
    const normalized = email.trim().toLowerCase();
    const code = genCode();
    const existing = await cloudDb.auth.get(normalized);
    if (existing) {
      await cloudDb.auth.update(normalized, { code });
    } else {
      const userId = crypto.randomUUID();
      const role = isAdminEmail(normalized) ? 'admin' : 'driver';
      await cloudDb.auth.put({ email: normalized, userId, code, role });
    }
    return { devCode: code };
  }

  async verifyOtp(
    email: string,
    token: string,
    _purpose: 'login' | 'signup' | 'recovery' = 'login',
  ): Promise<AuthSession> {
    void _purpose; // the mock treats every OTP the same way.
    await this.ready();
    const normalized = email.trim().toLowerCase();
    const record = await cloudDb.auth.get(normalized);
    if (!record) throw new Error('Solicita un código primero.');
    // Accept the stored code or the universal dev code.
    if (record.code !== token.trim() && token.trim() !== '000000') {
      throw new Error('Código incorrecto.');
    }
    await cloudDb.auth.update(normalized, { code: undefined });
    const session = await this.issueSession(record.email, record.userId, record.role);
    // Apply the name captured at signup, now that the user row exists.
    if (record.pendingName) {
      await cloudDb.users.update(record.userId, { name: record.pendingName });
      await cloudDb.auth.update(normalized, { pendingName: undefined });
    }
    return session;
  }

  async signUp(name: string, email: string, password: string): Promise<AuthSession | null> {
    await this.ready();
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    const normalized = email.trim().toLowerCase();
    const code = genCode();
    let record = await cloudDb.auth.get(normalized);
    if (!record) {
      const userId = crypto.randomUUID();
      const role = isAdminEmail(normalized) ? 'admin' : 'driver';
      record = { email: normalized, userId, role };
    }
    record.code = code;
    record.pendingName = name.trim() || undefined;
    await cloudDb.auth.put(record);
    // Mirror Supabase "Confirm email": no session yet — the caller verifies the
    // 6-digit code next. (Surfaced as devCode in the UI for offline testing.)
    return null;
  }

  async resendVerification(email: string): Promise<{ devCode?: string }> {
    // Re-issue a fresh signup code (same path as requesting one).
    return this.requestOtp(email);
  }

  async updatePassword(_newPassword: string): Promise<void> {
    // The mock has no real password store; sign-in accepts any password ≥ 6.
    void _newPassword;
  }

  async signInWithGoogle(): Promise<AuthSession> {
    await this.ready();
    // Simulated Google account for offline/demo mode.
    const email = 'usuario.google@gmail.com';
    let record = await cloudDb.auth.get(email);
    if (!record) {
      const userId = crypto.randomUUID();
      const role = isAdminEmail(email) ? 'admin' : 'driver';
      record = { email, userId, role };
      await cloudDb.auth.put(record);
    }
    return this.issueSession(record.email, record.userId, record.role);
  }

  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    await this.ready();
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    const normalized = email.trim().toLowerCase();
    let record = await cloudDb.auth.get(normalized);
    if (!record) {
      const userId = crypto.randomUUID();
      const role = isAdminEmail(normalized) ? 'admin' : 'driver';
      record = { email: normalized, userId, role };
      await cloudDb.auth.put(record);
    }
    return this.issueSession(record.email, record.userId, record.role);
  }

  /** Ensures a cloud user row exists, then mints and persists a session. */
  private async issueSession(
    email: string,
    userId: string,
    role: 'driver' | 'admin',
  ): Promise<AuthSession> {
    let user = await cloudDb.users.get(userId);
    if (!user) {
      const now = new Date();
      const newUser: CloudUser = {
        id: userId,
        name: email.split('@')[0],
        email,
        role,
        currency: 'NIO',
        fuelUnit: 'liter',
        onboardingComplete: false,
        registeredAt: now,
        updatedAt: now,
        subscriptionStatus: 'trial',
        currentPlan: 'free',
        freeCalculationsUsed: 0,
      };
      await cloudDb.users.put(newUser);
      user = newUser;
    }

    const session: AuthSession = {
      user: { id: user.id, email, role },
      accessToken: `mock.${userId}.${Date.now()}`,
      expiresAt: Date.now() + SESSION_TTL,
    };
    this.session = session;
    storeSession(session);
    return session;
  }

  async requestPasswordRecovery(email: string): Promise<{ devCode?: string }> {
    // OTP-based: recovery is the same as requesting a fresh code.
    return this.requestOtp(email);
  }

  async sendWelcomeEmail(): Promise<void> {
    // No outbound email in offline/demo mode.
  }

  async signOut(): Promise<void> {
    this.session = null;
    clearStoredSession();
  }

  async deleteAccount(): Promise<void> {
    if (!this.session) return;
    const userId = this.session.user.id;
    const email = this.session.user.email.toLowerCase();
    await cloudDb.transaction(
      'rw',
      [
        cloudDb.users,
        cloudDb.vehicles,
        cloudDb.trips,
        cloudDb.settings,
        cloudDb.auth,
        cloudDb.subscriptions,
        cloudDb.payments,
      ],
      async () => {
        await cloudDb.users.delete(userId);
        await cloudDb.auth.delete(email);
        await cloudDb.settings.delete(userId);
        await cloudDb.vehicles.where('userId').equals(userId).delete();
        await cloudDb.trips.where('userId').equals(userId).delete();
        await cloudDb.subscriptions.where('userId').equals(userId).delete();
        await cloudDb.payments.where('userId').equals(userId).delete();
      },
    );
    await this.signOut();
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    await this.ready();
    const user = await cloudDb.users.get(userId);
    return user ? { ...user } : null;
  }

  async pullData(userId: string): Promise<CloudSnapshot> {
    await this.ready();
    const user = await cloudDb.users.get(userId);
    const vehicles = await cloudDb.vehicles.where('userId').equals(userId).toArray();
    const trips = await cloudDb.trips.where('userId').equals(userId).toArray();
    const settings = await cloudDb.settings.get(userId);

    const profile: UserProfile | null = user ? { ...user } : null;
    return {
      profile,
      vehicles: vehicles.map(stripUserId) as UserVehicle[],
      trips: trips.map(stripUserId) as Trip[],
      settings: settings ? stripUserId(settings) : null,
    };
  }

  async pushData(userId: string, snapshot: CloudSnapshot): Promise<void> {
    await this.ready();
    await cloudDb.transaction(
      'rw',
      [cloudDb.users, cloudDb.vehicles, cloudDb.trips, cloudDb.settings],
      async () => {
        if (snapshot.profile) {
          const existing = await cloudDb.users.get(userId);
          const merged: CloudUser = {
            ...(existing ?? ({} as CloudUser)),
            ...snapshot.profile,
            id: userId,
            email: existing?.email ?? snapshot.profile.email ?? '',
            role: existing?.role ?? snapshot.profile.role ?? 'driver',
          };
          await cloudDb.users.put(merged);
        }
        if (snapshot.vehicles.length) {
          await cloudDb.vehicles.bulkPut(
            snapshot.vehicles.map((v) => ({ ...v, userId })),
          );
        }
        if (snapshot.trips.length) {
          await cloudDb.trips.bulkPut(snapshot.trips.map((t) => ({ ...t, userId })));
        }
        if (snapshot.settings) {
          await cloudDb.settings.put({ ...snapshot.settings, userId });
        }
      },
    );
  }

  async deleteRecords(userId: string, deletions: DeletionRecord[]): Promise<void> {
    for (const d of deletions) {
      if (d.table === 'vehicles') {
        const v = await cloudDb.vehicles.get(d.id);
        if (v && v.userId === userId) await cloudDb.vehicles.delete(d.id);
      } else {
        const t = await cloudDb.trips.get(d.id);
        if (t && t.userId === userId) await cloudDb.trips.delete(d.id);
      }
    }
  }

  async listPlans(): Promise<SubscriptionPlan[]> {
    await this.ready();
    return cloudDb.plans.toArray();
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    await this.ready();
    const subs = await cloudDb.subscriptions.where('userId').equals(userId).toArray();
    return subs[0] ?? null;
  }

  async listPayments(userId: string): Promise<Payment[]> {
    await this.ready();
    const payments = await cloudDb.payments.where('userId').equals(userId).toArray();
    return payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }

  async recordPayment(payment: Payment): Promise<Payment> {
    await this.ready();
    await cloudDb.payments.put(payment);
    // Activate the subscription on confirmed payment.
    if (payment.status === 'confirmed') {
      const user = await cloudDb.users.get(payment.userId);
      if (user) {
        await cloudDb.users.update(payment.userId, {
          subscriptionStatus: 'active',
        });
      }
      const existing = await this.getSubscription(payment.userId);
      if (existing) {
        await cloudDb.subscriptions.update(existing.id, { status: 'active' });
      }
    }
    return payment;
  }

  async adminListUsers(): Promise<AdminUserRow[]> {
    await this.ready();
    const users = await cloudDb.users.toArray();
    const rows: AdminUserRow[] = [];
    for (const u of users) {
      if (u.role === 'admin') continue;
      const tripsCount = await cloudDb.trips.where('userId').equals(u.id).count();
      const payments = await cloudDb.payments.where('userId').equals(u.id).toArray();
      const revenue = payments
        .filter((p) => p.status === 'confirmed')
        .reduce((s, p) => s + p.amount, 0);
      rows.push({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        currentPlan: u.currentPlan ?? 'free',
        status: u.subscriptionStatus ?? 'trial',
        lastActive: (u.updatedAt ?? u.registeredAt).toISOString(),
        tripsCount,
        revenue,
        registeredAt: u.registeredAt.toISOString(),
      });
    }
    return rows.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }

  async adminGetMetrics(): Promise<AdminMetrics> {
    const rows = await this.adminListUsers();
    const payments = await cloudDb.payments.toArray();
    const confirmed = payments.filter((p) => p.status === 'confirmed');

    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = confirmed
      .filter((p) => monthKey(p.paidAt) === thisMonth)
      .reduce((s, p) => s + p.amount, 0);

    const newSignupsThisMonth = rows.filter(
      (r) => monthKey(r.registeredAt) === thisMonth,
    ).length;

    const activeUsers = rows.filter((r) => r.status === 'active').length;
    const trialUsers = rows.filter((r) => r.status === 'trial').length;
    const overdueAccounts = rows.filter((r) => r.status === 'overdue').length;
    const cancelled = rows.filter((r) => r.status === 'cancelled').length;
    const churnRate = rows.length ? cancelled / rows.length : 0;

    // Revenue & growth across the last 12 months.
    const revenueByMonth: { month: string; revenue: number }[] = [];
    const userGrowth: { month: string; users: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('es-NI', { month: 'short' });
      const rev = confirmed
        .filter((p) => monthKey(p.paidAt) === key)
        .reduce((s, p) => s + p.amount, 0);
      revenueByMonth.push({ month: label, revenue: rev });
      const usersUpTo = rows.filter((r) => r.registeredAt.slice(0, 7) <= key).length;
      userGrowth.push({ month: label, users: usersUpTo });
    }

    return {
      activeUsers,
      trialUsers,
      overdueAccounts,
      newSignupsThisMonth,
      monthlyRevenue,
      churnRate,
      revenueByMonth,
      userGrowth,
    };
  }

  async adminUpdateUserStatus(
    userId: string,
    status: AdminUserRow['status'],
  ): Promise<void> {
    await cloudDb.users.update(userId, { subscriptionStatus: status });
  }

  async adminListPlans(): Promise<SubscriptionPlan[]> {
    return this.listPlans();
  }

  async adminUpsertPlan(plan: SubscriptionPlan): Promise<SubscriptionPlan> {
    await this.ready();
    await cloudDb.plans.put(plan);
    return plan;
  }

  async adminGetParameters(): Promise<GlobalParameters> {
    await this.ready();
    const params = await cloudDb.params.get('global');
    if (!params) throw new Error('Parámetros globales no encontrados.');
    const { id: _id, ...rest } = params;
    void _id;
    return rest;
  }

  async adminUpdateParameters(params: GlobalParameters): Promise<void> {
    await cloudDb.params.put({ ...params, id: 'global' });
  }

  async adminListCatalog(): Promise<CatalogVehicle[]> {
    await this.ready();
    return cloudDb.catalog.toArray();
  }

  async adminUpsertCatalog(entry: CatalogVehicle): Promise<CatalogVehicle> {
    await this.ready();
    await cloudDb.catalog.put(entry);
    return entry;
  }

  async adminDeleteCatalog(id: string): Promise<void> {
    await cloudDb.catalog.delete(id);
  }

  async adminListAnnouncements(): Promise<Announcement[]> {
    await this.ready();
    const list = await cloudDb.announcements.toArray();
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async adminCreateAnnouncement(announcement: Announcement): Promise<Announcement> {
    await this.ready();
    await cloudDb.announcements.put(announcement);
    // Deliver immediately (no background scheduler) as in-app notifications to
    // the targeted drivers — otherwise an announcement is never seen by anyone.
    if (new Date(announcement.sendAt).getTime() <= Date.now()) {
      const users = await cloudDb.users.toArray();
      const target = announcement.target;
      for (const u of users) {
        if (u.role === 'admin') continue;
        const match =
          target.kind === 'all' ||
          (target.kind === 'plan' && (u.currentPlan ?? 'free') === target.plan) ||
          (target.kind === 'status' && (u.subscriptionStatus ?? 'trial') === target.status);
        if (match) {
          await this.notify(u.id, announcement.title, announcement.body, 'system', '/');
        }
      }
    }
    return announcement;
  }

  async adminListPayments(): Promise<AdminPaymentRow[]> {
    await this.ready();
    const payments = await cloudDb.payments.toArray();
    const rows: AdminPaymentRow[] = [];
    for (const p of payments) {
      const user = await cloudDb.users.get(p.userId);
      rows.push({ ...p, userName: user?.name, userEmail: user?.email });
    }
    return rows.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.paidAt.localeCompare(a.paidAt);
    });
  }

  async adminReviewPayment(id: string, approve: boolean): Promise<void> {
    await this.ready();
    const pay = await cloudDb.payments.get(id);
    if (!pay) return;
    await cloudDb.payments.update(id, { status: approve ? 'confirmed' : 'rejected' });
    if (approve) {
      await cloudDb.users.update(pay.userId, {
        subscriptionStatus: 'active',
        currentPlan: pay.planId,
        freeCalculationsUsed: 0,
        updatedAt: new Date(),
      });
      await this.notify(
        pay.userId,
        'Pago aprobado',
        'Tu suscripción está activa. ¡Gracias!',
        'system',
        '/suscripcion',
      );
    } else {
      await this.notify(
        pay.userId,
        'Pago rechazado',
        'No pudimos verificar tu comprobante. Intenta de nuevo.',
        'system',
        '/suscripcion',
      );
    }
  }

  // ---- Cooperatives / Fleets ----
  async getMyCooperative(userId: string): Promise<Cooperative | null> {
    await this.ready();
    let coop = await cloudDb.cooperatives.where('adminId').equals(userId).first();
    if (!coop) {
      // Only ACTIVE memberships count as "belonging" to a cooperative.
      const membership = await cloudDb.coopMembers
        .where('userId')
        .equals(userId)
        .filter((m) => m.status === 'active')
        .first();
      if (membership) coop = await cloudDb.cooperatives.get(membership.coopId);
    }
    if (!coop) return null;
    // The fleet is premium while the admin has a confirmed Cooperativa payment
    // within the last month (monthly expiry; mirrors the my_cooperative RPC).
    const admin = await cloudDb.users.get(coop.adminId);
    let subscriptionActive = false;
    if (admin && admin.currentPlan === 'coop') {
      const coopPlan = await cloudDb.plans.get('coop');
      const days = coopPlan?.durationDays && coopPlan.durationDays > 0 ? coopPlan.durationDays : 30;
      const cutoff = Date.now() - days * 86_400_000;
      const recent = await cloudDb.payments
        .where('userId')
        .equals(coop.adminId)
        .filter((p) => p.status === 'confirmed' && new Date(p.paidAt).getTime() > cutoff)
        .first();
      subscriptionActive = !!recent;
    }
    return { ...coop, subscriptionActive };
  }

  async listPendingInvites(userId: string): Promise<CoopInvite[]> {
    await this.ready();
    const user = await cloudDb.users.get(userId);
    const email = user?.email?.toLowerCase();
    const members = await cloudDb.coopMembers
      .filter(
        (m) =>
          m.status === 'invited' &&
          (m.userId === userId || (!!email && m.email === email)),
      )
      .toArray();
    const invites: CoopInvite[] = [];
    for (const m of members) {
      const coop = await cloudDb.cooperatives.get(m.coopId);
      if (coop) invites.push({ member: m, coop });
    }
    return invites;
  }

  async respondToInvite(memberId: string, accept: boolean): Promise<void> {
    await this.ready();
    if (accept) {
      await cloudDb.coopMembers.update(memberId, { status: 'active' });
    } else {
      await cloudDb.coopMembers.delete(memberId);
    }
  }

  async createCooperative(userId: string, name: string): Promise<Cooperative> {
    await this.ready();
    const coop: Cooperative = {
      id: crypto.randomUUID(),
      name: name.trim(),
      adminId: userId,
      createdAt: new Date().toISOString(),
    };
    await cloudDb.cooperatives.put(coop);
    const user = await cloudDb.users.get(userId);
    await cloudDb.coopMembers.put({
      id: crypto.randomUUID(),
      coopId: coop.id,
      email: (user?.email ?? '').toLowerCase(),
      userId,
      status: 'active',
      invitedAt: coop.createdAt,
    });
    return coop;
  }

  async updateCooperativeParams(coopId: string, params: CooperativeParams): Promise<void> {
    await cloudDb.cooperatives.update(coopId, { fleetParams: params });
  }

  async inviteDriver(coopId: string, email: string): Promise<CoopMember> {
    await this.ready();
    const normalized = email.trim().toLowerCase();

    // Only registered users can be invited.
    const user = await cloudDb.users.where('email').equals(normalized).first();
    if (!user) {
      throw new Error('No existe un usuario registrado con ese correo.');
    }

    const existing = await cloudDb.coopMembers
      .where('coopId')
      .equals(coopId)
      .filter((m) => m.email === normalized)
      .first();
    if (existing) return existing;

    const count = await cloudDb.coopMembers.where('coopId').equals(coopId).count();
    if (count >= MAX_COOP_DRIVERS) {
      throw new Error('La cooperativa ya alcanzó el máximo de 20 conductores.');
    }

    const member: CoopMember = {
      id: crypto.randomUUID(),
      coopId,
      email: normalized,
      userId: user.id,
      status: 'invited',
      invitedAt: new Date().toISOString(),
    };
    await cloudDb.coopMembers.put(member);

    // Deliver an in-app notification to the invited driver.
    const coop = await cloudDb.cooperatives.get(coopId);
    await this.notify(
      user.id,
      'Invitación a cooperativa',
      `Te invitaron a la flota "${coop?.name ?? 'Cooperativa'}". Toca para responder.`,
      'invite',
      '/cooperativa',
    );
    return member;
  }

  async removeMember(memberId: string): Promise<void> {
    await cloudDb.coopMembers.delete(memberId);
  }

  async leaveCooperative(userId: string, coopId: string): Promise<void> {
    await this.ready();
    const user = await cloudDb.users.get(userId);
    const email = user?.email?.toLowerCase();
    const members = await cloudDb.coopMembers
      .filter(
        (m) =>
          m.coopId === coopId &&
          (m.userId === userId || (!!email && m.email === email)),
      )
      .toArray();
    await Promise.all(members.map((m) => cloudDb.coopMembers.delete(m.id)));
  }

  async getFleetReport(coopId: string): Promise<FleetReport> {
    await this.ready();
    const coop = await cloudDb.cooperatives.get(coopId);
    if (!coop) throw new Error('Cooperativa no encontrada.');
    const members = await cloudDb.coopMembers.where('coopId').equals(coopId).toArray();

    const drivers: FleetDriverSummary[] = [];
    for (const m of members) {
      const user = m.userId
        ? await cloudDb.users.get(m.userId)
        : await cloudDb.users.where('email').equals(m.email).first();
      const trips = user
        ? await cloudDb.trips.where('userId').equals(user.id).toArray()
        : [];
      const totalProfit = trips.reduce((s, t) => s + t.netProfit, 0);
      const avgMargin = trips.length
        ? trips.reduce((s, t) => s + t.margin, 0) / trips.length
        : 0;
      drivers.push({
        memberId: m.id,
        userId: user?.id,
        email: m.email,
        name: user?.name ?? m.email.split('@')[0],
        status: m.status,
        tripsCount: trips.length,
        totalProfit,
        avgMargin,
        profitable: totalProfit > 0,
      });
    }

    const withTrips = drivers.filter((d) => d.tripsCount > 0);
    return {
      coop,
      totalProfit: drivers.reduce((s, d) => s + d.totalProfit, 0),
      totalTrips: drivers.reduce((s, d) => s + d.tripsCount, 0),
      profitableDrivers: withTrips.filter((d) => d.profitable).length,
      unprofitableDrivers: withTrips.filter((d) => !d.profitable).length,
      drivers,
    };
  }

  async recordGroupPayment(coopId: string, amount: number): Promise<void> {
    await this.ready();
    const coop = await cloudDb.cooperatives.get(coopId);
    if (!coop) return;
    await cloudDb.payments.put({
      id: crypto.randomUUID(),
      userId: coop.adminId,
      amount,
      currency: 'NIO',
      method: 'transfer',
      status: 'confirmed',
      paidAt: new Date().toISOString(),
    });
    await cloudDb.users.update(coop.adminId, { subscriptionStatus: 'active' });
  }

  // ---- Notifications ----
  private async notify(
    userId: string,
    title: string,
    body: string,
    kind: AppNotification['kind'],
    link?: string,
  ): Promise<void> {
    await cloudDb.notifications.put({
      id: crypto.randomUUID(),
      userId,
      title,
      body,
      kind,
      link,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  async listNotifications(userId: string): Promise<AppNotification[]> {
    await this.ready();
    const list = await cloudDb.notifications.where('userId').equals(userId).toArray();
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markNotificationRead(id: string): Promise<void> {
    await cloudDb.notifications.update(id, { read: true });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const list = await cloudDb.notifications.where('userId').equals(userId).toArray();
    await Promise.all(list.map((n) => cloudDb.notifications.update(n.id, { read: true })));
  }

  async deleteNotification(id: string): Promise<void> {
    await cloudDb.notifications.delete(id);
  }

  // ---- Admin: roles ----
  async adminSetUserRole(userId: string, role: 'driver' | 'admin'): Promise<void> {
    await cloudDb.users.update(userId, { role });
  }
}
