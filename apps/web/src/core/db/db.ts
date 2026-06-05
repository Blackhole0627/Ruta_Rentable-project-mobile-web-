import Dexie, { type Table } from 'dexie';
import type { UserProfile } from '@shared/types/user.types';
import type { UserVehicle } from '@shared/types/vehicle.types';
import type { Trip } from '@shared/types/trip.types';
import type { SettingsRecord, LocalDeletion } from './schema';
import { DB_NAME } from './schema';
import { DEFAULT_PARAMS } from '../constants/defaultParams';

export class RutaRentableDB extends Dexie {
  users!: Table<UserProfile, string>;
  vehicles!: Table<UserVehicle, string>;
  trips!: Table<Trip, string>;
  settings!: Table<SettingsRecord, string>;
  deletions!: Table<LocalDeletion, number>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      users: 'id',
      vehicles: 'id, isActive',
      trips: 'id, createdAt, status, platform',
      settings: 'id',
    });
    this.version(2).stores({
      users: 'id',
      vehicles: 'id, isActive',
      trips: 'id, createdAt, status, platform',
      settings: 'id',
      deletions: '++id, table',
    });
  }
}

export const db = new RutaRentableDB();

export async function getOrCreateSettings(): Promise<SettingsRecord> {
  const existing = await db.settings.get('default');
  if (existing) return existing;

  const defaults: SettingsRecord = {
    id: 'default',
    gasolinePerLiter: DEFAULT_PARAMS.gasolinePerLiter,
    dieselPerLiter: DEFAULT_PARAMS.dieselPerLiter,
    commissions: { ...DEFAULT_PARAMS.commissions },
    profitableThreshold: DEFAULT_PARAMS.profitableThreshold,
    acceptableThreshold: DEFAULT_PARAMS.acceptableThreshold,
    desiredMargin: DEFAULT_PARAMS.desiredMargin,
  };
  await db.settings.put(defaults);
  return defaults;
}
