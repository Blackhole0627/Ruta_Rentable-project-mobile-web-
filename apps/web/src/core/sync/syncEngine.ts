import { db } from '../db/db';
import { getBackend } from '../backend';
import type { CloudSnapshot, DeletionRecord } from '../backend';
import type { UserVehicle } from '@shared/types/vehicle.types';
import type { Trip } from '@shared/types/trip.types';
import type { UserProfile } from '@shared/types/user.types';

function vehicleTs(v: UserVehicle): number {
  return new Date(v.updatedAt ?? v.createdAt).getTime();
}
function tripTs(t: Trip): number {
  return new Date(t.updatedAt ?? t.createdAt).getTime();
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

export async function readLocalSnapshot(): Promise<CloudSnapshot> {
  const [users, vehicles, trips, settings] = await Promise.all([
    db.users.toArray(),
    db.vehicles.toArray(),
    db.trips.toArray(),
    db.settings.get('default'),
  ]);
  return {
    profile: users[0] ?? null,
    vehicles,
    trips,
    settings: settings ?? null,
  };
}

/**
 * Reconcile local Dexie data with the cloud for `userId`.
 * Order: flush deletions → pull & merge (last-write-wins) → push union.
 */
export async function syncNow(userId: string): Promise<SyncResult> {
  const backend = getBackend();

  // 0. Account-switch guard: if the local data belongs to a DIFFERENT
  // authenticated account, clear it first so one user's vehicles/trips never
  // leak into (or get pushed to) another account.
  const localProfile = (await db.users.toArray())[0];
  if (localProfile && localProfile.email && localProfile.id !== userId) {
    await db.transaction(
      'rw',
      [db.vehicles, db.trips, db.settings, db.users, db.deletions],
      async () => {
        await db.vehicles.clear();
        await db.trips.clear();
        await db.settings.clear();
        await db.users.clear();
        await db.deletions.clear();
      },
    );
  }

  // 1. Flush queued deletions to the cloud.
  const deletions = await db.deletions.toArray();
  if (deletions.length) {
    const payload: DeletionRecord[] = deletions.map((d) => ({
      table: d.table,
      id: d.recordId,
      at: d.at,
    }));
    await backend.deleteRecords(userId, payload);
    await db.deletions.clear();
  }

  // 2. Pull cloud, merge newer records into local.
  const cloud = await backend.pullData(userId);
  const local = await readLocalSnapshot();
  let pulled = 0;

  const localVehicles = new Map(local.vehicles.map((v) => [v.id, v]));
  for (const cv of cloud.vehicles) {
    const lv = localVehicles.get(cv.id);
    if (!lv || vehicleTs(cv) > vehicleTs(lv)) {
      await db.vehicles.put(cv);
      pulled++;
    }
  }

  const localTrips = new Map(local.trips.map((t) => [t.id, t]));
  for (const ct of cloud.trips) {
    const lt = localTrips.get(ct.id);
    if (!lt || tripTs(ct) > tripTs(lt)) {
      await db.trips.put(ct);
      pulled++;
    }
  }

  if (cloud.profile) {
    const lp = local.profile;
    const cloudTs = cloud.profile.updatedAt
      ? new Date(cloud.profile.updatedAt).getTime()
      : 0;
    const localTs = lp?.updatedAt ? new Date(lp.updatedAt).getTime() : 0;
    if (!lp || cloudTs >= localTs) {
      const merged: UserProfile = {
        ...(lp ?? ({} as UserProfile)),
        ...cloud.profile,
        id: userId,
        onboardingComplete: lp?.onboardingComplete || cloud.profile.onboardingComplete,
      };
      // Replace any prior local profile id with the authenticated id.
      if (lp && lp.id !== userId) await db.users.delete(lp.id);
      await db.users.put(merged);
    }
  }

  if (cloud.settings) {
    await db.settings.put({ ...cloud.settings, id: 'default' });
  }

  // 3. Push the merged union back to the cloud.
  const union = await readLocalSnapshot();
  await backend.pushData(userId, union);

  return { pulled, pushed: union.vehicles.length + union.trips.length };
}

/** Queue a deletion so it propagates to the cloud on the next sync. */
export async function queueDeletion(
  table: 'vehicles' | 'trips',
  recordId: string,
): Promise<void> {
  await db.deletions.add({ table, recordId, at: Date.now() });
}
