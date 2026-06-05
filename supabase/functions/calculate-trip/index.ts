// Supabase Edge Function: calculate-trip
// Server-side re-validation of a trip calculation (FR-MOD / NFR-SEC).
// The canonical logic lives in shared/financial-model; this mirrors it so the
// server never trusts client-computed costs. In production, wire an import map
// to import the shared module directly instead of duplicating it here.
// Deploy: supabase functions deploy calculate-trip

interface CostBreakdown {
  fuelPerKm: number;
  tiresPerKm: number;
  oilPerKm: number;
  maintenancePerKm: number;
  depreciationPerKm: number;
  fixedCostsPerKm: number;
  totalPerKm: number;
}

interface TripInput {
  kmWithPassenger: number;
  deadKm: number;
  fareCharged: number;
  commissionPct: number;
  desiredMarginPct: number;
  costBreakdown: CostBreakdown;
  thresholds: { profitableThreshold: number; acceptableThreshold: number };
}

function calculateTrip(input: TripInput) {
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
    fuelCost + tireCost + oilCost + maintenanceCost + depreciationCost + fixedCost + commission;
  const netProfit = input.fareCharged - totalTripCost;
  const margin = input.fareCharged > 0 ? netProfit / input.fareCharged : -1;
  const m = input.desiredMarginPct / 100;
  const minimumFare = m < 1 ? totalTripCost / (1 - m) : totalTripCost * 2;
  const status =
    margin >= input.thresholds.profitableThreshold
      ? 'profitable'
      : margin >= input.thresholds.acceptableThreshold
        ? 'acceptable'
        : 'not_profitable';
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    const input = (await req.json()) as TripInput;
    const result = calculateTrip(input);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Bad request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
