import { useMemo } from 'react';
import { calculateTrip } from '@/core/financial-model/tripCalculator';
import { calculateCostPerKm } from '@/core/financial-model/costPerKm';
import { useVehicleStore } from '@/core/store/useVehicleStore';
import { useSettingsStore } from '@/core/store/useSettingsStore';
import { useUserStore } from '@/core/store/useUserStore';
import type { Platform } from '@shared/types/trip.types';
import { PLATFORM_COMMISSIONS } from '@/core/constants/platforms';
import { DEFAULT_PARAMS } from '@/core/constants/defaultParams';

export interface CalculatorFormState {
  platform: Platform;
  /** How the commission is entered: a percentage or a fixed córdoba amount. */
  commissionMode: 'percent' | 'fixed';
  commissionPct: number;
  /** Fixed commission in C$ (used when commissionMode === 'fixed'). */
  commissionFixed: number;
  kmWithPassenger: number;
  deadKm: number;
  fareCharged: number;
}

/** Resolve the effective commission percentage from either entry mode. */
export function effectiveCommissionPct(
  form: CalculatorFormState,
  fallbackPct: number,
): number {
  if (form.commissionMode === 'fixed') {
    return form.fareCharged > 0 ? (form.commissionFixed / form.fareCharged) * 100 : 0;
  }
  return form.commissionPct ?? fallbackPct;
}

export function useCalculator(form: CalculatorFormState) {
  const { vehicle } = useVehicleStore();
  const { settings } = useSettingsStore();
  const { user } = useUserStore();

  return useMemo(() => {
    if (!vehicle || !settings) return null;

    const defaults =
      vehicle.unitType === 'car' ? DEFAULT_PARAMS.car : DEFAULT_PARAMS.motorcycle;

    const fuelPrice =
      vehicle.fuelPricePerUnit ||
      (user?.fuelUnit === 'gallon'
        ? settings.gasolinePerLiter * 3.785
        : settings.gasolinePerLiter);

    const costBreakdown = calculateCostPerKm({
      fuelPricePerUnit: fuelPrice,
      fuelEfficiency: vehicle.realKmPerLiter || defaults.estKmPerLiter,
      tireCost: vehicle.tireCost || defaults.tireCostNIO,
      tireLifeKm: vehicle.tireLifeKm || defaults.tireLifeKm,
      oilChangeCost: vehicle.oilChangeCost || defaults.oilChangeCostNIO,
      oilChangeFreqKm: vehicle.oilChangeFreqKm || defaults.oilChangeFreqKm,
      monthlyMaintenance: vehicle.monthlyMaintenance || defaults.monthlyMaintenanceNIO,
      monthlyKm: vehicle.monthlyKm || defaults.monthlyKm,
      vehicleValue: vehicle.vehicleValue || defaults.vehicleValueNIO,
      usefulLifeKm: vehicle.usefulLifeKm || defaults.usefulLifeKm,
      monthlyFixedCosts: vehicle.monthlyFixedCosts || defaults.monthlyFixedCostsNIO,
    });

    const commissionPct = effectiveCommissionPct(
      form,
      settings.commissions[form.platform] ?? PLATFORM_COMMISSIONS[form.platform],
    );

    return calculateTrip({
      kmWithPassenger: form.kmWithPassenger || 0,
      deadKm: form.deadKm || 0,
      fareCharged: form.fareCharged || 0,
      commissionPct,
      desiredMarginPct: settings.desiredMargin * 100,
      costBreakdown,
      thresholds: {
        profitableThreshold: settings.profitableThreshold,
        acceptableThreshold: settings.acceptableThreshold,
      },
    });
  }, [vehicle, settings, user, form]);
}
