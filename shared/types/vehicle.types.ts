export type UnitType = 'car' | 'motorcycle';
export type FuelType = 'gasoline' | 'diesel' | 'electric';

export interface CatalogVehicle {
  id: string;
  type: UnitType;
  make: string;
  model: string;
  year?: string;
  fuelType: FuelType;
  estKmPerLiter: number;
  category?: string;
}

export interface UserVehicle {
  id: string;
  unitType: UnitType;
  make: string;
  model: string;
  catalogId?: string;
  realKmPerLiter: number;
  fuelPricePerUnit: number;
  tireCost: number;
  tireLifeKm: number;
  oilChangeCost: number;
  oilChangeFreqKm: number;
  monthlyMaintenance: number;
  monthlyKm: number;
  vehicleValue: number;
  usefulLifeKm: number;
  monthlyFixedCosts: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
