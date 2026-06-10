import { create } from 'zustand';
import type { SettingsRecord } from '../db/schema';
import type { GlobalParameters } from '@shared/types/admin.types';
import { db, getOrCreateSettings } from '../db/db';
import { getBackend } from '../backend';

const backend = getBackend();

/** Map the admin's global parameters onto the local settings shape. */
function paramsToSettings(p: GlobalParameters): Omit<SettingsRecord, 'id'> {
  return {
    gasolinePerLiter: p.gasolinePerLiter,
    dieselPerLiter: p.dieselPerLiter,
    commissions: { ...p.commissions },
    profitableThreshold: p.profitableThreshold,
    acceptableThreshold: p.acceptableThreshold,
    desiredMargin: p.desiredMargin,
  };
}

interface SettingsState {
  settings: SettingsRecord | null;
  /** Admin-set recommended defaults (best-effort; may be null offline). */
  globalDefaults: GlobalParameters | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<SettingsRecord>) => Promise<void>;
  /** Overwrite the driver's settings with the admin's recommended values. */
  applyRecommended: () => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  globalDefaults: null,
  isLoading: true,
  loadSettings: async () => {
    set({ isLoading: true });
    // The admin's global defaults (fuel prices, commissions, thresholds).
    // Best-effort: offline / RLS failures just fall back to local defaults.
    const globalDefaults = await backend.adminGetParameters().catch(() => null);
    const existing = await db.settings.get('default');
    let settings: SettingsRecord;
    if (existing) {
      settings = existing;
    } else if (globalDefaults) {
      // Seed a brand-new driver from the admin's recommended values.
      settings = { id: 'default', ...paramsToSettings(globalDefaults) };
      await db.settings.put(settings);
    } else {
      settings = await getOrCreateSettings();
    }
    set({ settings, globalDefaults, isLoading: false });
  },
  updateSettings: async (partial) => {
    const current = get().settings ?? (await getOrCreateSettings());
    const updated = { ...current, ...partial };
    await db.settings.put(updated);
    set({ settings: updated });
  },
  applyRecommended: async () => {
    const params = await backend.adminGetParameters().catch(() => null);
    if (!params) return false;
    const current = get().settings ?? (await getOrCreateSettings());
    const updated = { ...current, ...paramsToSettings(params) };
    await db.settings.put(updated);
    set({ settings: updated, globalDefaults: params });
    return true;
  },
}));
