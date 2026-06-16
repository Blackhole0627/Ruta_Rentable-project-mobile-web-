import Dexie, { type Table } from 'dexie';
import type { UserProfile } from '@shared/types/user.types';
import type { UserVehicle, CatalogVehicle } from '@shared/types/vehicle.types';
import type { Trip } from '@shared/types/trip.types';
import type { UserRole } from '@shared/types/auth.types';
import type {
  SubscriptionPlan,
  Subscription,
  Payment,
} from '@shared/types/subscription.types';
import type { GlobalParameters, Announcement } from '@shared/types/admin.types';
import type { Cooperative, CoopMember } from '@shared/types/cooperative.types';
import type { AppNotification } from '@shared/types/notification.types';
import type { KycSubmission } from '@shared/types/kyc.types';
import type { Platform } from '@shared/types/trip.types';
import type { SettingsRecord } from '../db/schema';
import { DEFAULT_PARAMS } from '../constants/defaultParams';
import { VEHICLE_CATALOG } from '../constants/catalog';
import { ADMIN_EMAILS } from './config';

export type CloudUser = UserProfile & { email: string; role: UserRole };
export type CloudVehicle = UserVehicle & { userId: string };
export type CloudTrip = Trip & { userId: string };
export type CloudSettings = SettingsRecord & { userId: string };

export interface AuthRecord {
  email: string;
  userId: string;
  code?: string;
  role: UserRole;
  /** Name captured at signup, applied to the user row after OTP verification. */
  pendingName?: string;
}

export interface MetaRecord {
  key: string;
  value: string;
}

class CloudDB extends Dexie {
  users!: Table<CloudUser, string>;
  vehicles!: Table<CloudVehicle, string>;
  trips!: Table<CloudTrip, string>;
  settings!: Table<CloudSettings, string>;
  auth!: Table<AuthRecord, string>;
  plans!: Table<SubscriptionPlan, string>;
  subscriptions!: Table<Subscription, string>;
  payments!: Table<Payment, string>;
  params!: Table<GlobalParameters & { id: string }, string>;
  catalog!: Table<CatalogVehicle, string>;
  announcements!: Table<Announcement, string>;
  cooperatives!: Table<Cooperative, string>;
  coopMembers!: Table<CoopMember, string>;
  notifications!: Table<AppNotification, string>;
  kycSubmissions!: Table<KycSubmission, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('RutaRentableCloudDB');
    this.version(1).stores({
      users: 'id, email, subscriptionStatus, currentPlan',
      vehicles: 'id, userId, isActive',
      trips: 'id, userId, createdAt',
      settings: 'userId',
      auth: 'email, userId',
      plans: 'id',
      subscriptions: 'id, userId',
      payments: 'id, userId, paidAt',
      params: 'id',
      catalog: 'id, type',
      announcements: 'id, createdAt',
      meta: 'key',
    });
    this.version(2).stores({
      cooperatives: 'id, adminId',
      coopMembers: 'id, coopId, email, userId',
    });
    this.version(3).stores({
      notifications: 'id, userId, read, createdAt',
    });
    this.version(4).stores({
      kycSubmissions: 'id, userId, status, submittedAt',
    });
  }
}

export const cloudDb = new CloudDB();

const SEED_FLAG = 'seeded:v1';

const DEMO_NAMES = [
  'Juan Pérez',
  'María López',
  'Carlos Ramírez',
  'Ana Martínez',
  'Luis Gómez',
  'Rosa Castro',
  'Pedro Mendoza',
  'Elena Vargas',
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function buildDefaultParams(): GlobalParameters & { id: string } {
  return {
    id: 'global',
    gasolinePerLiter: DEFAULT_PARAMS.gasolinePerLiter,
    dieselPerLiter: DEFAULT_PARAMS.dieselPerLiter,
    commissions: { ...DEFAULT_PARAMS.commissions } as Record<Platform, number>,
    profitableThreshold: DEFAULT_PARAMS.profitableThreshold,
    acceptableThreshold: DEFAULT_PARAMS.acceptableThreshold,
    desiredMargin: DEFAULT_PARAMS.desiredMargin,
  };
}

function defaultPlans(): SubscriptionPlan[] {
  return [
    {
      id: 'free',
      name: 'Gratis',
      priceNio: 0,
      priceUsd: 0,
      calcLimit: 5,
      features: ['5 cálculos', 'Calculadora básica', 'Historial local'],
      capabilities: [],
      durationDays: 30,
      isActive: true,
    },
    {
      id: 'basic',
      name: 'Básico',
      priceNio: 120,
      priceUsd: 3.5,
      calcLimit: null,
      features: ['Cálculos ilimitados', 'Historial en la nube', 'Reportes'],
      capabilities: ['unlimitedCalc', 'reports', 'cloudSync'],
      durationDays: 30,
      isActive: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      priceNio: 250,
      priceUsd: 7,
      calcLimit: null,
      features: ['Todo lo de Básico', 'Múltiples vehículos', 'Punto de equilibrio'],
      capabilities: ['unlimitedCalc', 'reports', 'cloudSync', 'multiVehicle', 'breakEven'],
      durationDays: 30,
      isActive: true,
    },
    {
      id: 'coop',
      name: 'Cooperativa',
      priceNio: 1500,
      priceUsd: 42,
      calcLimit: null,
      features: ['Facturación grupal', 'Reportes de flota', 'Hasta 20 conductores'],
      capabilities: ['unlimitedCalc', 'reports', 'cloudSync', 'multiVehicle', 'breakEven', 'cooperative'],
      durationDays: 30,
      isActive: true,
    },
  ];
}

const DEMO_PLATFORMS: Platform[] = ['indrive', 'aventon', 'taxi', 'delivery', 'private'];

function buildDemoTrips(userId: string, count: number): CloudTrip[] {
  const trips: CloudTrip[] = [];
  for (let i = 0; i < count; i++) {
    const km = 4 + Math.round(Math.random() * 20);
    const dead = Math.round(Math.random() * 4);
    const totalKm = km + dead;
    const costPerKm = 9 + Math.random() * 3;
    const cost = totalKm * costPerKm;
    const fare = cost * (0.9 + Math.random() * 0.8);
    const platform = DEMO_PLATFORMS[i % DEMO_PLATFORMS.length];
    const commissionPct = DEFAULT_PARAMS.commissions[platform] ?? 0;
    const commissionAmount = fare * (commissionPct / 100);
    const totalTripCost = cost + commissionAmount;
    const netProfit = fare - totalTripCost;
    const margin = fare > 0 ? netProfit / fare : -1;
    const status =
      margin >= 0.25 ? 'profitable' : margin >= 0.1 ? 'acceptable' : 'not_profitable';
    const createdAt = new Date(Date.now() - i * 0.7 * 86_400_000);
    trips.push({
      id: crypto.randomUUID(),
      userId,
      createdAt,
      updatedAt: createdAt,
      platform,
      kmWithPassenger: km,
      deadKm: dead,
      totalKm,
      fareCharged: Math.round(fare),
      commissionPct,
      fuelCost: cost * 0.4,
      tiresCost: cost * 0.05,
      oilCost: cost * 0.05,
      maintenanceCost: cost * 0.12,
      depreciationCost: cost * 0.23,
      fixedCosts: cost * 0.15,
      commissionAmount,
      totalTripCost,
      netProfit,
      margin,
      status,
    });
  }
  return trips;
}

/** Idempotently seeds the mock cloud with demo drivers, plans, catalog & params. */
export async function ensureCloudSeed(): Promise<void> {
  const flag = await cloudDb.meta.get(SEED_FLAG);
  if (flag) return;

  await cloudDb.transaction(
    'rw',
    [
      cloudDb.plans,
      cloudDb.params,
      cloudDb.catalog,
      cloudDb.users,
      cloudDb.auth,
      cloudDb.trips,
      cloudDb.subscriptions,
      cloudDb.payments,
      cloudDb.announcements,
      cloudDb.meta,
    ],
    async () => {
      await cloudDb.plans.bulkPut(defaultPlans());
      await cloudDb.params.put(buildDefaultParams());
      await cloudDb.catalog.bulkPut(VEHICLE_CATALOG.map((v) => ({ ...v })));

      // Admin account (no demo trips).
      const adminEmail = ADMIN_EMAILS[0] ?? 'blackhole45808@gmail.com';
      const adminId = crypto.randomUUID();
      await cloudDb.users.put({
        id: adminId,
        name: 'Administrador',
        email: adminEmail,
        role: 'admin',
        currency: 'NIO',
        fuelUnit: 'liter',
        onboardingComplete: true,
        registeredAt: new Date(isoDaysAgo(120)),
        updatedAt: new Date(),
        subscriptionStatus: 'active',
        currentPlan: 'pro',
        freeCalculationsUsed: 0,
        kycStatus: 'verified',
      });
      await cloudDb.auth.put({ email: adminEmail.toLowerCase(), userId: adminId, role: 'admin' });

      // Demo drivers with trips + payments.
      const statuses: Array<UserProfile['subscriptionStatus']> = [
        'active',
        'active',
        'trial',
        'overdue',
        'active',
        'cancelled',
        'trial',
        'active',
      ];
      const plansForUser = ['basic', 'pro', 'free', 'basic', 'pro', 'basic', 'free', 'pro'];

      for (let i = 0; i < DEMO_NAMES.length; i++) {
        const userId = crypto.randomUUID();
        const email = `conductor${i + 1}@ejemplo.com`;
        const status = statuses[i];
        const plan = plansForUser[i];
        const registeredAt = new Date(isoDaysAgo(150 - i * 15));
        await cloudDb.users.put({
          id: userId,
          name: DEMO_NAMES[i],
          email,
          phone: `+505 8${(1000000 + i * 13571).toString().slice(0, 7)}`,
          role: 'driver',
          currency: 'NIO',
          fuelUnit: i % 3 === 0 ? 'gallon' : 'liter',
          onboardingComplete: true,
          registeredAt,
          updatedAt: new Date(isoDaysAgo(i)),
          subscriptionStatus: status,
          currentPlan: plan,
          freeCalculationsUsed: plan === 'free' ? Math.min(5, i + 1) : 0,
          // Grandfather existing paid demo drivers as verified so their active
          // plans stay effective; free-tier users need no KYC.
          kycStatus: plan !== 'free' ? 'verified' : 'none',
        });
        await cloudDb.auth.put({ email: email.toLowerCase(), userId, role: 'driver' });

        const trips = buildDemoTrips(userId, 8 + ((i * 5) % 22));
        await cloudDb.trips.bulkPut(trips);

        if (plan !== 'free' && status !== 'cancelled') {
          const monthsPaid = 1 + (i % 4);
          for (let m = 0; m < monthsPaid; m++) {
            const amount = plan === 'pro' ? 250 : plan === 'coop' ? 1500 : 120;
            await cloudDb.payments.put({
              id: crypto.randomUUID(),
              userId,
              amount,
              currency: 'NIO',
              method: 'transfer',
              status: 'confirmed',
              paidAt: isoDaysAgo(m * 30 + (i % 28)),
            });
          }
          await cloudDb.subscriptions.put({
            id: crypto.randomUUID(),
            userId,
            planId: plan,
            status: status === 'overdue' ? 'overdue' : 'active',
            startDate: registeredAt.toISOString().slice(0, 10),
          });
        }
      }

      await cloudDb.announcements.put({
        id: crypto.randomUUID(),
        title: 'Bienvenido a RutaRentable',
        body: 'Gracias por unirte. Calcula la rentabilidad de cada viaje antes de aceptarlo.',
        target: { kind: 'all' },
        sendAt: isoDaysAgo(30),
        createdAt: isoDaysAgo(30),
      });

      await cloudDb.meta.put({ key: SEED_FLAG, value: new Date().toISOString() });
    },
  );
}
