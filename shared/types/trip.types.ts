import type { TripStatus } from '../financial-model/profitability';

// 'uber' is kept only so historical trips still resolve; it's no longer offered
// (Uber doesn't operate in Nicaragua — replaced by 'aventon').
export type Platform =
  | 'indrive'
  | 'aventon'
  | 'uber'
  | 'taxi'
  | 'private'
  | 'delivery'
  | 'other';

export interface Trip {
  id: string;
  vehicleId?: string;
  createdAt: Date;
  platform: Platform;
  kmWithPassenger: number;
  deadKm: number;
  totalKm: number;
  fareCharged: number;
  commissionPct: number;
  fuelCost: number;
  tiresCost: number;
  oilCost: number;
  maintenanceCost: number;
  depreciationCost: number;
  fixedCosts: number;
  commissionAmount: number;
  totalTripCost: number;
  netProfit: number;
  margin: number;
  status: TripStatus;
  notes?: string;
  /** Stage 2 — set whenever the trip is created or edited; used for sync conflict resolution. */
  updatedAt?: Date;
}
