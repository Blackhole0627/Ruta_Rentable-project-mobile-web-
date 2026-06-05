import { create } from 'zustand';
import type { SettingsRecord } from '../db/schema';
import { db, getOrCreateSettings } from '../db/db';

interface SettingsState {
  settings: SettingsRecord | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<SettingsRecord>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: true,
  loadSettings: async () => {
    set({ isLoading: true });
    const settings = await getOrCreateSettings();
    set({ settings, isLoading: false });
  },
  updateSettings: async (partial) => {
    const current = get().settings ?? (await getOrCreateSettings());
    const updated = { ...current, ...partial };
    await db.settings.put(updated);
    set({ settings: updated });
  },
}));
