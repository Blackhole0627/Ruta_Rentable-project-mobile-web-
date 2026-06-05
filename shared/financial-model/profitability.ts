export type TripStatus = 'profitable' | 'acceptable' | 'not_profitable';

export interface ProfitabilityThresholds {
  profitableThreshold: number;
  acceptableThreshold: number;
}

export function classifyTrip(
  margin: number,
  thresholds: ProfitabilityThresholds,
): TripStatus {
  if (margin >= thresholds.profitableThreshold) return 'profitable';
  if (margin >= thresholds.acceptableThreshold) return 'acceptable';
  return 'not_profitable';
}
