import { create } from 'zustand';
import type { Trip } from '@shared/types/trip.types';
import { db } from '../db/db';
import { queueDeletion } from '../sync/syncEngine';

interface TripState {
  trips: Trip[];
  isLoading: boolean;
  loadTrips: () => Promise<void>;
  saveTrip: (trip: Trip) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
}

async function reloadTrips(): Promise<Trip[]> {
  return db.trips.orderBy('createdAt').reverse().toArray();
}

export const useTripStore = create<TripState>((set) => ({
  trips: [],
  isLoading: true,
  loadTrips: async () => {
    set({ isLoading: true });
    set({ trips: await reloadTrips(), isLoading: false });
  },
  saveTrip: async (trip) => {
    await db.trips.put({ ...trip, updatedAt: new Date() });
    set({ trips: await reloadTrips() });
  },
  deleteTrip: async (id) => {
    await db.trips.delete(id);
    await queueDeletion('trips', id);
    set({ trips: await reloadTrips() });
  },
}));
