import type { CostBreakdown } from './costPerKm';
import { classifyTrip, type TripStatus } from './profitability';

export interface TripInput {
  kmWithPassenger: number;
  deadKm: number;
  fareCharged: number;
  commissionPct: number;
  desiredMarginPct: number;
  costBreakdown: CostBreakdown;
  thresholds: {
    profitableThreshold: number;
    acceptableThreshold: number;
  };
}

export interface TripResult {
  realKm: number;
  commission: number;
  fuelCost: number;
  tireCost: number;
  oilCost: number;
  maintenanceCost: number;
  depreciationCost: number;
  fixedCost: number;
  totalTripCost: number;
  netProfit: number;
  margin: number;
  minimumFare: number;
  status: TripStatus;
}

export function calculateTrip(input: TripInput): TripResult {
  const realKm = input.kmWithPassenger + input.deadKm;
  const commission = input.fareCharged * (input.commissionPct / 100);
  const c = input.costBreakdown;

  const fuelCost = realKm * c.fuelPerKm;
  const tireCost = realKm * c.tiresPerKm;
  const oilCost = realKm * c.oilPerKm;
  const maintenanceCost = realKm * c.maintenancePerKm;
  const depreciationCost = realKm * c.depreciationPerKm;
  const fixedCost = realKm * c.fixedCostsPerKm;

  const totalTripCost =
    fuelCost +
    tireCost +
    oilCost +
    maintenanceCost +
    depreciationCost +
    fixedCost +
    commission;

  const netProfit = input.fareCharged - totalTripCost;
  const margin = input.fareCharged > 0 ? netProfit / input.fareCharged : -1;

  const desiredMarginDecimal = input.desiredMarginPct / 100;
  const minimumFare =
    desiredMarginDecimal < 1
      ? totalTripCost / (1 - desiredMarginDecimal)
      : totalTripCost * 2;

  const status = classifyTrip(margin, input.thresholds);

  return {
    realKm,
    commission,
    fuelCost,
    tireCost,
    oilCost,
    maintenanceCost,
    depreciationCost,
    fixedCost,
    totalTripCost,
    netProfit,
    margin,
    minimumFare,
    status,
  };
}
