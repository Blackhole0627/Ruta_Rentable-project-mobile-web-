import { create } from 'zustand';
import type { UserVehicle } from '@shared/types/vehicle.types';
import { db } from '../db/db';
import { queueDeletion, normalizeActiveVehicles } from '../sync/syncEngine';

interface VehicleState {
  vehicles: UserVehicle[];
  /** The currently active vehicle used by the calculator. */
  vehicle: UserVehicle | null;
  isLoading: boolean;
  loadVehicles: () => Promise<void>;
  saveVehicle: (vehicle: UserVehicle) => Promise<void>;
  setActiveVehicle: (id: string) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
}

function pickActive(vehicles: UserVehicle[]): UserVehicle | null {
  return vehicles.find((v) => v.isActive) ?? vehicles[0] ?? null;
}

export const useVehicleStore = create<VehicleState>((set) => ({
  vehicles: [],
  vehicle: null,
  isLoading: true,
  loadVehicles: async () => {
    set({ isLoading: true });
    await normalizeActiveVehicles();
    const vehicles = await db.vehicles.toArray();
    set({ vehicles, vehicle: pickActive(vehicles), isLoading: false });
  },
  saveVehicle: async (vehicle) => {
    // The saved/edited vehicle becomes the active one.
    const all = await db.vehicles.toArray();
    await Promise.all(
      all
        .filter((v) => v.id !== vehicle.id && v.isActive)
        .map((v) => db.vehicles.update(v.id, { isActive: false, updatedAt: new Date() })),
    );
    await db.vehicles.put({ ...vehicle, isActive: true, updatedAt: new Date() });
    const vehicles = await db.vehicles.toArray();
    set({ vehicles, vehicle: pickActive(vehicles) });
  },
  setActiveVehicle: async (id) => {
    const all = await db.vehicles.toArray();
    await Promise.all(
      all.map((v) =>
        db.vehicles.update(v.id, { isActive: v.id === id, updatedAt: new Date() }),
      ),
    );
    const vehicles = await db.vehicles.toArray();
    set({ vehicles, vehicle: pickActive(vehicles) });
  },
  deleteVehicle: async (id) => {
    await db.vehicles.delete(id);
    await queueDeletion('vehicles', id);
    let vehicles = await db.vehicles.toArray();
    // If we removed the active vehicle, promote another.
    if (vehicles.length && !vehicles.some((v) => v.isActive)) {
      await db.vehicles.update(vehicles[0].id, { isActive: true, updatedAt: new Date() });
      vehicles = await db.vehicles.toArray();
    }
    set({ vehicles, vehicle: pickActive(vehicles) });
  },
}));
