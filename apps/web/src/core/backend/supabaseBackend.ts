import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '@shared/types/user.types';
import type { UserVehicle, CatalogVehicle } from '@shared/types/vehicle.types';
import type { Trip } from '@shared/types/trip.types';
import type { AuthSession, UserRole } from '@shared/types/auth.types';
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
import type { Platform } from '@shared/types/trip.types';
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
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import type { BackendAdapter, CloudSnapshot, DeletionRecord } from './types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_WEB_CLIENT_ID, isAdminEmail } from './config';
import { DEFAULT_PARAMS } from '../constants/defaultParams';

let googleNativeReady = false;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function rowToCoop(r: Row): Cooperative {
  return {
    id: r.id,
    name: r.name,
    adminId: r.admin_id,
    createdAt: r.created_at,
    fleetParams: r.fleet_params ?? undefined,
  };
}

function vehicleToRow(v: UserVehicle, userId: string): Row {
  return {
    id: v.id,
    user_id: userId,
    unit_type: v.unitType,
    make: v.make,
    model: v.model,
    real_km_per_liter: v.realKmPerLiter,
    vehicle_value: v.vehicleValue,
    useful_life_km: v.usefulLifeKm,
    maintenance_per_km: v.monthlyMaintenance,
    tires_per_km: v.tireCost,
    oil_cost: v.oilChangeCost,
    oil_freq_km: v.oilChangeFreqKm,
    monthly_fixed_costs: v.monthlyFixedCosts,
    monthly_km: v.monthlyKm,
    is_active: v.isActive,
    updated_at: (v.updatedAt ?? new Date()).toISOString(),
  };
}

function rowToVehicle(r: Row): UserVehicle {
  return {
    id: r.id,
    unitType: r.unit_type,
    make: r.make,
    model: r.model,
    realKmPerLiter: Number(r.real_km_per_liter) || 0,
    fuelPricePerUnit: Number(r.fuel_price_per_unit) || 0,
    tireCost: Number(r.tires_per_km) || 0,
    tireLifeKm: Number(r.tire_life_km) || 0,
    oilChangeCost: Number(r.oil_cost) || 0,
    oilChangeFreqKm: Number(r.oil_freq_km) || 0,
    monthlyMaintenance: Number(r.maintenance_per_km) || 0,
    monthlyKm: Number(r.monthly_km) || 0,
    vehicleValue: Number(r.vehicle_value) || 0,
    usefulLifeKm: Number(r.useful_life_km) || 0,
    monthlyFixedCosts: Number(r.monthly_fixed_costs) || 0,
    isActive: !!r.is_active,
    createdAt: r.created_at ? new Date(r.created_at) : new Date(),
    updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
  };
}

function tripToRow(t: Trip, userId: string): Row {
  return {
    id: t.id,
    user_id: userId,
    vehicle_id: t.vehicleId,
    created_at: t.createdAt.toISOString(),
    platform: t.platform,
    km_with_passenger: t.kmWithPassenger,
    dead_km: t.deadKm,
    total_km: t.totalKm,
    fare_charged: t.fareCharged,
    commission_pct: t.commissionPct,
    fuel_cost: t.fuelCost,
    tires_cost: t.tiresCost,
    oil_cost: t.oilCost,
    maintenance_cost: t.maintenanceCost,
    depreciation_cost: t.depreciationCost,
    fixed_costs: t.fixedCosts,
    commission_amount: t.commissionAmount,
    total_trip_cost: t.totalTripCost,
    net_profit: t.netProfit,
    margin: t.margin,
    status: t.status,
    notes: t.notes,
    updated_at: (t.updatedAt ?? t.createdAt).toISOString(),
  };
}

function rowToTrip(r: Row): Trip {
  return {
    id: r.id,
    vehicleId: r.vehicle_id ?? undefined,
    createdAt: new Date(r.created_at),
    platform: r.platform,
    kmWithPassenger: Number(r.km_with_passenger),
    deadKm: Number(r.dead_km),
    totalKm: Number(r.total_km),
    fareCharged: Number(r.fare_charged),
    commissionPct: Number(r.commission_pct),
    fuelCost: Number(r.fuel_cost),
    tiresCost: Number(r.tires_cost),
    oilCost: Number(r.oil_cost),
    maintenanceCost: Number(r.maintenance_cost),
    depreciationCost: Number(r.depreciation_cost),
    fixedCosts: Number(r.fixed_costs),
    commissionAmount: Number(r.commission_amount),
    totalTripCost: Number(r.total_trip_cost),
    netProfit: Number(r.net_profit),
    margin: Number(r.margin),
    status: r.status,
    notes: r.notes ?? undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(r.created_at),
  };
}

/** Real Supabase implementation. Requires migrations to be applied. */
export class SupabaseBackend implements BackendAdapter {
  readonly isMock = false;
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  }

  private async role(email: string): Promise<UserRole> {
    return isAdminEmail(email) ? 'admin' : 'driver';
  }

  async getSession(): Promise<AuthSession | null> {
    const { data } = await this.client.auth.getSession();
    const s = data.session;
    if (!s?.user?.email) return null;
    return {
      user: { id: s.user.id, email: s.user.email, role: await this.role(s.user.email) },
      accessToken: s.access_token,
      expiresAt: (s.expires_at ?? 0) * 1000,
    };
  }

  async requestOtp(email: string): Promise<{ devCode?: string }> {
    const { error } = await this.client.auth.signInWithOtp({ email });
    if (error) throw error;
    return {};
  }

  async verifyOtp(
    email: string,
    token: string,
    purpose: 'login' | 'signup' | 'recovery' = 'login',
  ): Promise<AuthSession> {
    // Map our purpose to Supabase's email OTP types. Passwordless login uses
    // 'email'; account confirmation uses 'signup'; password reset uses 'recovery'.
    const type = purpose === 'signup' ? 'signup' : purpose === 'recovery' ? 'recovery' : 'email';
    const { data, error } = await this.client.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type,
    });
    if (error) throw error;
    const s = data.session;
    if (!s?.user?.email) throw new Error('No se pudo iniciar sesión.');
    return {
      user: { id: s.user.id, email: s.user.email, role: await this.role(s.user.email) },
      accessToken: s.access_token,
      expiresAt: (s.expires_at ?? 0) * 1000,
    };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const s = data.session;
    if (!s?.user?.email) throw new Error('No se pudo iniciar sesión.');
    return {
      user: { id: s.user.id, email: s.user.email, role: await this.role(s.user.email) },
      accessToken: s.access_token,
      expiresAt: (s.expires_at ?? 0) * 1000,
    };
  }

  async signUp(name: string, email: string, password: string): Promise<AuthSession | null> {
    const trimmed = email.trim();
    const { data, error } = await this.client.auth.signUp({
      email: trimmed,
      password,
      options: { data: { name: name.trim(), full_name: name.trim() } },
    });
    if (error) {
      // The email already has an account (commonly an UNCONFIRMED one from a
      // previous attempt). Re-send the signup code and let the caller continue
      // to the OTP step instead of dead-ending on a 422. If the account is
      // already confirmed, the resend fails and we surface the original error.
      const msg = (error.message ?? '').toLowerCase();
      const alreadyExists =
        error.status === 422 ||
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('user already');
      if (alreadyExists) {
        const { error: resendErr } = await this.client.auth.resend({
          type: 'signup',
          email: trimmed,
        });
        if (!resendErr) return null; // → caller shows the OTP screen
      }
      throw error;
    }
    const s = data.session;
    // With "Confirm email" enabled, signUp returns no session and Supabase
    // emails a confirmation code. The caller then verifies it (purpose 'signup').
    // If confirmation is disabled, a session comes back and we log in directly.
    if (!s?.user?.email) return null;
    return {
      user: { id: s.user.id, email: s.user.email, role: await this.role(s.user.email) },
      accessToken: s.access_token,
      expiresAt: (s.expires_at ?? 0) * 1000,
    };
  }

  async resendVerification(email: string): Promise<{ devCode?: string }> {
    const { error } = await this.client.auth.resend({ type: 'signup', email: email.trim() });
    if (error) throw error;
    return {};
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async signInWithGoogle(): Promise<AuthSession | null> {
    // Native (Android): show Google's own account-picker, get an ID token, and
    // exchange it with Supabase — no browser redirect, the user stays in-app.
    if (Capacitor.isNativePlatform()) {
      if (!googleNativeReady) {
        await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
        googleNativeReady = true;
      }
      // No `scopes` here on purpose: requesting extra OAuth scopes triggers the
      // plugin's authorization flow (which needs MainActivity changes). For a
      // plain sign-in we only need the ID token — email/profile are already in it.
      const res = await SocialLogin.login({
        provider: 'google',
        options: {},
      });
      const idToken =
        'idToken' in res.result ? res.result.idToken : null;
      if (!idToken) throw new Error('No se obtuvo el token de Google.');
      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
      const s = data.session;
      if (!s?.user?.email) throw new Error('No se pudo iniciar sesión con Google.');
      return {
        user: { id: s.user.id, email: s.user.email, role: await this.role(s.user.email) },
        accessToken: s.access_token,
        expiresAt: (s.expires_at ?? 0) * 1000,
      };
    }

    // Web: standard OAuth redirect; the session is picked up on return.
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return null;
  }

  async requestPasswordRecovery(email: string): Promise<{ devCode?: string }> {
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return {};
  }

  async sendWelcomeEmail(): Promise<void> {
    // Server-side Edge Function (uses the Resend API key as a secret). The
    // caller treats this as best-effort, so swallow failures here too.
    await this.client.functions.invoke('send-welcome');
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async deleteAccount(): Promise<void> {
    // Account deletion runs server-side (Edge Function with the service role).
    const { error } = await this.client.functions.invoke('delete-account');
    if (error) throw error;
    await this.signOut();
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    // Always scope to the authenticated user (robust against local id mismatch).
    const { data: authData } = await this.client.auth.getUser();
    const uid = authData.user?.id ?? userId;
    const { data } = await this.client.from('users').select('*').eq('id', uid).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name ?? '',
      currency: data.currency ?? 'NIO',
      fuelUnit: data.fuel_unit ?? 'liter',
      onboardingComplete: true,
      registeredAt: new Date(data.registered_at),
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      subscriptionStatus: data.subscription_status ?? undefined,
      currentPlan: data.current_plan ?? undefined,
      freeCalculationsUsed: data.free_calculations_used ?? 0,
    };
  }

  async pullData(userId: string): Promise<CloudSnapshot> {
    const [profileRes, vehiclesRes, tripsRes] = await Promise.all([
      this.client.from('users').select('*').eq('id', userId).maybeSingle(),
      this.client.from('user_vehicles').select('*').eq('user_id', userId),
      this.client.from('trips').select('*').eq('user_id', userId),
    ]);

    const profile: UserProfile | null = profileRes.data
      ? {
          id: profileRes.data.id,
          name: profileRes.data.name ?? '',
          currency: profileRes.data.currency ?? 'NIO',
          fuelUnit: profileRes.data.fuel_unit ?? 'liter',
          onboardingComplete: true,
          registeredAt: new Date(profileRes.data.registered_at),
          email: profileRes.data.email ?? undefined,
          phone: profileRes.data.phone ?? undefined,
          subscriptionStatus: profileRes.data.subscription_status ?? undefined,
          currentPlan: profileRes.data.current_plan ?? undefined,
          freeCalculationsUsed: profileRes.data.free_calculations_used ?? 0,
        }
      : null;

    return {
      profile,
      vehicles: (vehiclesRes.data ?? []).map(rowToVehicle),
      trips: (tripsRes.data ?? []).map(rowToTrip),
      settings: null,
    };
  }

  async pushData(userId: string, snapshot: CloudSnapshot): Promise<void> {
    if (snapshot.profile) {
      await this.client.from('users').upsert({
        id: userId,
        name: snapshot.profile.name,
        email: snapshot.profile.email,
        currency: snapshot.profile.currency,
        fuel_unit: snapshot.profile.fuelUnit,
        free_calculations_used: snapshot.profile.freeCalculationsUsed ?? 0,
        updated_at: new Date().toISOString(),
      });
    }
    if (snapshot.vehicles.length) {
      await this.client
        .from('user_vehicles')
        .upsert(snapshot.vehicles.map((v) => vehicleToRow(v, userId)));
    }
    if (snapshot.trips.length) {
      await this.client
        .from('trips')
        .upsert(snapshot.trips.map((t) => tripToRow(t, userId)));
    }
  }

  async deleteRecords(userId: string, deletions: DeletionRecord[]): Promise<void> {
    for (const d of deletions) {
      const table = d.table === 'vehicles' ? 'user_vehicles' : 'trips';
      await this.client.from(table).delete().eq('id', d.id).eq('user_id', userId);
    }
  }

  async listPlans(): Promise<SubscriptionPlan[]> {
    const { data } = await this.client.from('plans').select('*').eq('is_active', true);
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      name: r.name,
      priceNio: Number(r.price_nio) || 0,
      priceUsd: Number(r.price_usd) || 0,
      calcLimit: r.calc_limit,
      features: Array.isArray(r.features) ? r.features : [],
      capabilities: Array.isArray(r.capabilities) ? r.capabilities : undefined,
      durationDays: r.duration_days ?? undefined,
      isActive: !!r.is_active,
    }));
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    const { data } = await this.client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      planId: data.plan_id,
      status: data.status,
      startDate: data.start_date,
      endDate: data.end_date ?? undefined,
    };
  }

  async listPayments(userId: string): Promise<Payment[]> {
    // Always scope to the authenticated user (robust against local id mismatch).
    const { data: authData } = await this.client.auth.getUser();
    const uid = authData.user?.id ?? userId;
    const { data } = await this.client
      .from('payments')
      .select('*')
      .eq('user_id', uid)
      .order('paid_at', { ascending: false });
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      userId: r.user_id,
      subscriptionId: r.subscription_id ?? undefined,
      planId: r.plan_id ?? undefined,
      amount: Number(r.amount),
      currency: r.currency,
      method: r.method ?? 'transfer',
      status: r.status,
      receiptUrl: r.receipt_url ?? undefined,
      paidAt: r.paid_at,
    }));
  }

  async recordPayment(payment: Payment): Promise<Payment> {
    // Use the authenticated uid so the RLS WITH CHECK (user_id = auth.uid()) passes.
    const { data: authData } = await this.client.auth.getUser();
    const uid = authData.user?.id ?? payment.userId;
    const { error } = await this.client.from('payments').insert({
      id: payment.id,
      user_id: uid,
      subscription_id: payment.subscriptionId,
      plan_id: payment.planId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      receipt_url: payment.receiptUrl,
      paid_at: payment.paidAt,
    });
    if (error) throw error;
    return { ...payment, userId: uid };
  }

  async adminListPayments(): Promise<AdminPaymentRow[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*, users(name, email)')
      .order('paid_at', { ascending: false });
    if (error) throw error;
    const rows: AdminPaymentRow[] = (data ?? []).map((r: Row) => ({
      id: r.id,
      userId: r.user_id,
      planId: r.plan_id ?? undefined,
      amount: Number(r.amount),
      currency: r.currency,
      method: r.method ?? 'transfer',
      status: r.status,
      receiptUrl: r.receipt_url ?? undefined,
      paidAt: r.paid_at,
      userName: r.users?.name ?? undefined,
      userEmail: r.users?.email ?? undefined,
    }));
    // Pending first, then newest.
    return rows.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.paidAt.localeCompare(a.paidAt);
    });
  }

  async adminReviewPayment(id: string, approve: boolean): Promise<void> {
    const { data: pay } = await this.client
      .from('payments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!pay) return;
    await this.client
      .from('payments')
      .update({ status: approve ? 'confirmed' : 'rejected' })
      .eq('id', id);
    if (approve) {
      await this.client
        .from('users')
        .update({
          subscription_status: 'active',
          current_plan: pay.plan_id ?? undefined,
          free_calculations_used: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pay.user_id);
      await this.createNotification(
        pay.user_id,
        'Pago aprobado',
        'Tu suscripción está activa. ¡Gracias!',
        'system',
        '/suscripcion',
      );
    } else {
      await this.createNotification(
        pay.user_id,
        'Pago rechazado',
        'No pudimos verificar tu comprobante. Intenta de nuevo.',
        'system',
        '/suscripcion',
      );
    }
  }

  async adminListUsers(): Promise<AdminUserRow[]> {
    const { data } = await this.client.rpc('admin_list_users');
    return (data ?? []) as AdminUserRow[];
  }

  async adminGetMetrics(): Promise<AdminMetrics> {
    const { data } = await this.client.rpc('admin_metrics');
    const m = (data ?? {}) as Partial<AdminMetrics>;
    // Normalize so missing/empty fields never crash the charts.
    return {
      activeUsers: m.activeUsers ?? 0,
      trialUsers: m.trialUsers ?? 0,
      overdueAccounts: m.overdueAccounts ?? 0,
      newSignupsThisMonth: m.newSignupsThisMonth ?? 0,
      monthlyRevenue: m.monthlyRevenue ?? 0,
      churnRate: m.churnRate ?? 0,
      revenueByMonth: Array.isArray(m.revenueByMonth) ? m.revenueByMonth : [],
      userGrowth: Array.isArray(m.userGrowth) ? m.userGrowth : [],
    };
  }

  async adminUpdateUserStatus(
    userId: string,
    status: AdminUserRow['status'],
  ): Promise<void> {
    await this.client.from('users').update({ subscription_status: status }).eq('id', userId);
  }

  async adminListPlans(): Promise<SubscriptionPlan[]> {
    return this.listPlans();
  }

  async adminUpsertPlan(plan: SubscriptionPlan): Promise<SubscriptionPlan> {
    await this.client.from('plans').upsert({
      id: plan.id,
      name: plan.name,
      price_nio: plan.priceNio,
      price_usd: plan.priceUsd,
      calc_limit: plan.calcLimit,
      features: plan.features,
      capabilities: plan.capabilities ?? [],
      duration_days: plan.durationDays ?? 30,
      is_active: plan.isActive,
    });
    return plan;
  }

  async adminGetParameters(): Promise<GlobalParameters> {
    const { data } = await this.client
      .from('parameters')
      .select('*')
      .eq('scope', 'global');
    const map = new Map<string, string>();
    (data ?? []).forEach((r: Row) => map.set(r.key, r.value));
    const num = (k: string, d: number) => Number(map.get(k) ?? d);
    return {
      gasolinePerLiter: num('gasolinePerLiter', DEFAULT_PARAMS.gasolinePerLiter),
      dieselPerLiter: num('dieselPerLiter', DEFAULT_PARAMS.dieselPerLiter),
      commissions: { ...DEFAULT_PARAMS.commissions } as Record<Platform, number>,
      profitableThreshold: num('profitableThreshold', DEFAULT_PARAMS.profitableThreshold),
      acceptableThreshold: num('acceptableThreshold', DEFAULT_PARAMS.acceptableThreshold),
      desiredMargin: num('desiredMargin', DEFAULT_PARAMS.desiredMargin),
    };
  }

  async adminUpdateParameters(params: GlobalParameters): Promise<void> {
    const rows = [
      { scope: 'global', user_id: null, key: 'gasolinePerLiter', value: String(params.gasolinePerLiter) },
      { scope: 'global', user_id: null, key: 'dieselPerLiter', value: String(params.dieselPerLiter) },
      { scope: 'global', user_id: null, key: 'profitableThreshold', value: String(params.profitableThreshold) },
      { scope: 'global', user_id: null, key: 'acceptableThreshold', value: String(params.acceptableThreshold) },
      { scope: 'global', user_id: null, key: 'desiredMargin', value: String(params.desiredMargin) },
    ];
    // Global rows have user_id = NULL, which the UNIQUE(scope,user_id,key)
    // constraint treats as distinct — so upsert can't match. Delete then insert.
    const keys = rows.map((r) => r.key);
    await this.client
      .from('parameters')
      .delete()
      .eq('scope', 'global')
      .is('user_id', null)
      .in('key', keys);
    const { error } = await this.client.from('parameters').insert(rows);
    if (error) throw error;
  }

  async adminListCatalog(): Promise<CatalogVehicle[]> {
    const { data } = await this.client.from('vehicle_catalog').select('*');
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      type: r.unit_type,
      make: r.make,
      model: r.model,
      category: r.category ?? undefined,
      fuelType: r.fuel_type,
      estKmPerLiter: Number(r.est_km_per_liter) || 0,
    }));
  }

  async adminUpsertCatalog(entry: CatalogVehicle): Promise<CatalogVehicle> {
    await this.client.from('vehicle_catalog').upsert({
      id: entry.id,
      unit_type: entry.type,
      make: entry.make,
      model: entry.model,
      category: entry.category,
      fuel_type: entry.fuelType,
      est_km_per_liter: entry.estKmPerLiter,
    });
    return entry;
  }

  async adminDeleteCatalog(id: string): Promise<void> {
    await this.client.from('vehicle_catalog').delete().eq('id', id);
  }

  async adminListAnnouncements(): Promise<Announcement[]> {
    const { data } = await this.client
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      target: r.target,
      sendAt: r.send_at,
      createdAt: r.created_at,
    }));
  }

  async adminCreateAnnouncement(announcement: Announcement): Promise<Announcement> {
    await this.client.from('announcements').insert({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      target: announcement.target,
      send_at: announcement.sendAt,
      created_at: announcement.createdAt,
    });
    return announcement;
  }

  // ---- Cooperatives / Fleets ----
  async getMyCooperative(userId: string): Promise<Cooperative | null> {
    void userId; // resolved server-side via auth.uid()/email in the RPC.
    const { data, error } = await this.client.rpc('my_cooperative');
    if (error) throw error;
    if (!data) return null;
    const c = data as {
      id: string;
      name: string;
      adminId: string;
      createdAt: string;
      fleetParams?: CooperativeParams;
      subscriptionActive?: boolean;
    };
    return {
      id: c.id,
      name: c.name,
      adminId: c.adminId,
      createdAt: c.createdAt,
      fleetParams: c.fleetParams ?? undefined,
      subscriptionActive: !!c.subscriptionActive,
    };
  }

  async listPendingInvites(userId: string): Promise<CoopInvite[]> {
    void userId; // matched server-side via auth.uid()/email in the RPC.
    // SECURITY DEFINER RPC matches by auth id OR email and bypasses RLS.
    const { data, error } = await this.client.rpc('my_pending_invites');
    if (error) throw error;
    return (data ?? []) as CoopInvite[];
  }

  async respondToInvite(memberId: string, accept: boolean): Promise<void> {
    if (accept) {
      // Rebind user_id to the actual auth id so membership resolves correctly.
      const { data: authData } = await this.client.auth.getUser();
      await this.client
        .from('coop_members')
        .update({ status: 'active', user_id: authData.user?.id })
        .eq('id', memberId);
    } else {
      await this.client.from('coop_members').delete().eq('id', memberId);
    }
  }

  async createCooperative(userId: string, name: string): Promise<Cooperative> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const { error: coopErr } = await this.client
      .from('cooperatives')
      .insert({ id, name: name.trim(), admin_id: userId, created_at: createdAt });
    if (coopErr) throw coopErr;
    const { error: memErr } = await this.client.from('coop_members').insert({
      id: crypto.randomUUID(),
      coop_id: id,
      user_id: userId,
      status: 'active',
      invited_at: createdAt,
    });
    if (memErr) throw memErr;
    return { id, name: name.trim(), adminId: userId, createdAt };
  }

  async updateCooperativeParams(coopId: string, params: CooperativeParams): Promise<void> {
    await this.client.from('cooperatives').update({ fleet_params: params }).eq('id', coopId);
  }

  async inviteDriver(coopId: string, email: string): Promise<CoopMember> {
    const normalized = email.trim().toLowerCase();
    // RLS hides other users' rows, so look up via a SECURITY DEFINER RPC.
    const { data: foundId } = await this.client.rpc('find_user_id_by_email', {
      p_email: normalized,
    });
    if (!foundId) {
      throw new Error('No existe un usuario registrado con ese correo.');
    }
    const { count } = await this.client
      .from('coop_members')
      .select('*', { count: 'exact', head: true })
      .eq('coop_id', coopId);
    if ((count ?? 0) >= MAX_COOP_DRIVERS) {
      throw new Error('La cooperativa ya alcanzó el máximo de 20 conductores.');
    }
    const userId = foundId as string;
    const member: CoopMember = {
      id: crypto.randomUUID(),
      coopId,
      email: normalized,
      userId,
      status: 'invited',
      invitedAt: new Date().toISOString(),
    };
    await this.client.from('coop_members').insert({
      id: member.id,
      coop_id: coopId,
      email: normalized,
      user_id: userId,
      status: 'invited',
      invited_at: member.invitedAt,
    });
    const { data: coopRow } = await this.client
      .from('cooperatives')
      .select('name')
      .eq('id', coopId)
      .maybeSingle();
    await this.createNotification(
      userId,
      'Invitación a cooperativa',
      `Te invitaron a la flota "${coopRow?.name ?? 'Cooperativa'}". Toca para responder.`,
      'invite',
      '/cooperativa',
    );
    return member;
  }

  async removeMember(memberId: string): Promise<void> {
    await this.client.from('coop_members').delete().eq('id', memberId);
  }

  async leaveCooperative(userId: string, coopId: string): Promise<void> {
    void userId; // resolved server-side via auth.uid()/email in the RPC.
    // A direct delete only matches user_id = auth.uid() (and RLS hides the rest),
    // so a driver invited by email could never leave. The SECURITY DEFINER RPC
    // removes the membership by the same predicate as my_cooperative.
    const { error } = await this.client.rpc('leave_cooperative', { p_coop_id: coopId });
    if (error) throw error;
  }

  async getFleetReport(coopId: string): Promise<FleetReport> {
    const { data: coopRow } = await this.client
      .from('cooperatives')
      .select('*')
      .eq('id', coopId)
      .maybeSingle();
    if (!coopRow) throw new Error('Cooperativa no encontrada.');
    const { data: members } = await this.client
      .from('coop_members')
      .select('*')
      .eq('coop_id', coopId);

    const drivers: FleetDriverSummary[] = [];
    for (const m of members ?? []) {
      let trips: Row[] = [];
      if (m.user_id) {
        const { data } = await this.client
          .from('trips')
          .select('net_profit, margin')
          .eq('user_id', m.user_id);
        trips = data ?? [];
      }
      const totalProfit = trips.reduce((s, t) => s + Number(t.net_profit || 0), 0);
      const avgMargin = trips.length
        ? trips.reduce((s, t) => s + Number(t.margin || 0), 0) / trips.length
        : 0;
      drivers.push({
        memberId: m.id,
        userId: m.user_id ?? undefined,
        email: m.email ?? '',
        name: (m.email ?? '').split('@')[0] || 'Conductor',
        status: m.status,
        tripsCount: trips.length,
        totalProfit,
        avgMargin,
        profitable: totalProfit > 0,
      });
    }

    const withTrips = drivers.filter((d) => d.tripsCount > 0);
    return {
      coop: rowToCoop(coopRow),
      totalProfit: drivers.reduce((s, d) => s + d.totalProfit, 0),
      totalTrips: drivers.reduce((s, d) => s + d.tripsCount, 0),
      profitableDrivers: withTrips.filter((d) => d.profitable).length,
      unprofitableDrivers: withTrips.filter((d) => !d.profitable).length,
      drivers,
    };
  }

  async recordGroupPayment(coopId: string, amount: number): Promise<void> {
    const { data: coopRow } = await this.client
      .from('cooperatives')
      .select('admin_id')
      .eq('id', coopId)
      .maybeSingle();
    if (!coopRow) return;
    await this.client.from('payments').insert({
      id: crypto.randomUUID(),
      user_id: coopRow.admin_id,
      amount,
      currency: 'NIO',
      method: 'transfer',
      status: 'confirmed',
      paid_at: new Date().toISOString(),
    });
  }

  // ---- Notifications ----
  private async createNotification(
    userId: string,
    title: string,
    body: string,
    kind: AppNotification['kind'],
    link?: string,
  ): Promise<void> {
    await this.client.from('notifications').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      body,
      kind,
      link,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  async listNotifications(userId: string): Promise<AppNotification[]> {
    const { data } = await this.client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      body: r.body,
      kind: r.kind,
      link: r.link ?? undefined,
      read: !!r.read,
      createdAt: r.created_at,
    }));
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.client.from('notifications').update({ read: true }).eq('id', id);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.client
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
  }

  async deleteNotification(id: string): Promise<void> {
    await this.client.from('notifications').delete().eq('id', id);
  }

  // ---- Admin: roles ----
  async adminSetUserRole(userId: string, role: UserRole): Promise<void> {
    await this.client.from('users').update({ role }).eq('id', userId);
  }
}
