import { create } from 'zustand';
import type { CatalogVehicle } from '@shared/types/vehicle.types';
import { getBackend } from '../backend';
import { VEHICLE_CATALOG } from '../constants/catalog';

const backend = getBackend();

interface CatalogState {
  items: CatalogVehicle[];
  isLoading: boolean;
  load: () => Promise<void>;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  items: VEHICLE_CATALOG,
  isLoading: false,
  load: async () => {
    set({ isLoading: true });
    try {
      const items = await backend.listCatalog();
      set({ items: items.length > 0 ? items : VEHICLE_CATALOG, isLoading: false });
    } catch {
      set({ items: VEHICLE_CATALOG, isLoading: false });
    }
  },
}));
