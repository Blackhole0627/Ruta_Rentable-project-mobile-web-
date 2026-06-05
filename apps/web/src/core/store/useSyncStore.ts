import { create } from 'zustand';
import { syncNow } from '../sync/syncEngine';
import { useUserStore } from './useUserStore';
import { useVehicleStore } from './useVehicleStore';
import { useTripStore } from './useTripStore';
import { useSettingsStore } from './useSettingsStore';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  /** Authenticated user id, set by the auth store. */
  userId: string | null;
  setUserId: (id: string | null) => void;
  sync: () => Promise<void>;
}

async function reloadAllStores(): Promise<void> {
  await Promise.all([
    useUserStore.getState().loadUser(),
    useVehicleStore.getState().loadVehicles(),
    useTripStore.getState().loadTrips(),
    useSettingsStore.getState().loadSettings(),
  ]);
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  lastSyncedAt: null,
  error: null,
  userId: null,
  setUserId: (id) => set({ userId: id }),
  sync: async () => {
    const userId = get().userId;
    if (!userId) return;
    set({ status: 'syncing', error: null });
    try {
      await syncNow(userId);
      await reloadAllStores();
      set({ status: 'done', lastSyncedAt: Date.now() });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Error de sincronización',
      });
    }
  },
}));
