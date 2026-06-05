export interface VehicleParams {
  fuelPricePerUnit: number;
  fuelEfficiency: number;
  tireCost: number;
  tireLifeKm: number;
  oilChangeCost: number;
  oilChangeFreqKm: number;
  monthlyMaintenance: number;
  monthlyKm: number;
  vehicleValue: number;
  usefulLifeKm: number;
  monthlyFixedCosts: number;
}

export interface CostBreakdown {
  fuelPerKm: number;
  tiresPerKm: number;
  oilPerKm: number;
  maintenancePerKm: number;
  depreciationPerKm: number;
  fixedCostsPerKm: number;
  totalPerKm: number;
}

export function calculateCostPerKm(params: VehicleParams): CostBreakdown {
  if (params.fuelEfficiency <= 0) throw new Error('fuelEfficiency must be > 0');
  if (params.tireLifeKm <= 0) throw new Error('tireLifeKm must be > 0');
  if (params.oilChangeFreqKm <= 0) throw new Error('oilChangeFreqKm must be > 0');
  if (params.monthlyKm <= 0) throw new Error('monthlyKm must be > 0');
  if (params.usefulLifeKm <= 0) throw new Error('usefulLifeKm must be > 0');

  const fuelPerKm = params.fuelPricePerUnit / params.fuelEfficiency;
  const tiresPerKm = params.tireCost / params.tireLifeKm;
  const oilPerKm = params.oilChangeCost / params.oilChangeFreqKm;
  const maintenancePerKm = params.monthlyMaintenance / params.monthlyKm;
  const depreciationPerKm = params.vehicleValue / params.usefulLifeKm;
  const fixedCostsPerKm = params.monthlyFixedCosts / params.monthlyKm;

  const totalPerKm =
    fuelPerKm +
    tiresPerKm +
    oilPerKm +
    maintenancePerKm +
    depreciationPerKm +
    fixedCostsPerKm;

  return {
    fuelPerKm,
    tiresPerKm,
    oilPerKm,
    maintenancePerKm,
    depreciationPerKm,
    fixedCostsPerKm,
    totalPerKm,
  };
}
