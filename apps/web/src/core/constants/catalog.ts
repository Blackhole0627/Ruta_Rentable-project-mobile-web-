import type { CatalogVehicle } from '@shared/types/vehicle.types';
import carSeed from '../../../../../supabase/seed/vehicles.json';
import motoSeed from '../../../../../supabase/seed/motorcycles.json';

type CarSeed = (typeof carSeed)[number];
type MotoSeed = (typeof motoSeed)[number];

const cars: CatalogVehicle[] = (carSeed as CarSeed[]).map((v, i) => ({
  id: `c${String(i + 1).padStart(3, '0')}`,
  type: 'car' as const,
  make: v.make,
  model: v.model,
  category: v.category,
  fuelType: v.fuelType as CatalogVehicle['fuelType'],
  estKmPerLiter: v.estKmPerLiter,
}));

const motorcycles: CatalogVehicle[] = (motoSeed as MotoSeed[]).map((v, i) => ({
  id: `m${String(i + 1).padStart(3, '0')}`,
  type: 'motorcycle' as const,
  make: v.make,
  model: v.model,
  fuelType: v.fuelType as CatalogVehicle['fuelType'],
  estKmPerLiter: v.estKmPerLiter,
}));

export const VEHICLE_CATALOG: CatalogVehicle[] = [...cars, ...motorcycles];

export function getCatalogByType(type: 'car' | 'motorcycle', catalog = VEHICLE_CATALOG) {
  return catalog.filter((v) => v.type === type);
}

export function findCatalogVehicle(id: string, catalog = VEHICLE_CATALOG) {
  return catalog.find((v) => v.id === id);
}
