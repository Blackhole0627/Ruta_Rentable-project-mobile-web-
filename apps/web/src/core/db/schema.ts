import type { UserProfile } from '@shared/types/user.types';
import type { UserVehicle } from '@shared/types/vehicle.types';
import type { Trip } from '@shared/types/trip.types';

export interface SettingsRecord {
  id: string;
  gasolinePerLiter: number;
  dieselPerLiter: number;
  commissions: Record<string, number>;
  profitableThreshold: number;
  acceptableThreshold: number;
  desiredMargin: number;
}

/** Local outbox row recording a deletion to be pushed to the cloud on next sync. */
export interface LocalDeletion {
  id?: number;
  table: 'vehicles' | 'trips';
  recordId: string;
  at: number;
}

export interface DbSchema {
  users: UserProfile;
  vehicles: UserVehicle;
  trips: Trip & { id: string };
  settings: SettingsRecord;
  deletions: LocalDeletion;
}

export const DB_NAME = 'RutaRentableDB';
