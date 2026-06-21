import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TripForm } from '../components/TripForm';
import { ProfitabilityResult } from '../components/ProfitabilityResult';
import {
  useCalculator,
  effectiveCommissionPct,
  type CalculatorFormState,
} from '../hooks/useCalculator';
import { getBackend } from '@/core/backend';
import { useAuthStore } from '@/core/store/useAuthStore';
import { calculateCostPerKm } from '@/core/financial-model/costPerKm';
import { DEFAULT_PARAMS } from '@/core/constants/defaultParams';
import { useUserStore } from '@/core/store/useUserStore';
import { useVehicleStore } from '@/core/store/useVehicleStore';
import { useTripStore } from '@/core/store/useTripStore';
import { useSettingsStore } from '@/core/store/useSettingsStore';
import {
  useSubscriptionStore,
  isCalcLimitReached,
} from '@/core/store/useSubscriptionStore';
import { hasCapability, freeCalcsUsedThisMonth } from '@/core/subscription/planAccess';
import { PLATFORM_COMMISSIONS } from '@/core/constants/platforms';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/EmptyState';
import { Dialog } from '@/shared/components/ui/dialog';
import { ReminderBanners } from '@/shared/components/ReminderBanners';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import type { Trip } from '@shared/types/trip.types';

const initialForm = (platform: CalculatorFormState['platform']): CalculatorFormState => ({
  platform,
  commissionMode: 'percent',
  commissionPct: PLATFORM_COMMISSIONS[platform],
  commissionFixed: 0,
  kmWithPassenger: 0,
  deadKm: 0,
  fareCharged: 0,
});

export function CalculatorPage() {
  const navigate = useNavigate();
  const { user, recordCalculation } = useUserStore();
  const { vehicle } = useVehicleStore();
  const { settings } = useSettingsStore();
  const { saveTrip, loadTrips } = useTripStore();
  const { plans, load: loadPlans } = useSubscriptionStore();
  const { status } = useAuthStore();
  const backend = getBackend();
  const [form, setForm] = useState<CalculatorFormState>(initialForm('indrive'));
  const [showPaywall, setShowPaywall] = useState(false);
  const [saved, setSaved] = useState(false);
  const result = useCalculator(form);
  const { t } = useI18n();

  useEffect(() => {
    loadTrips();
    loadPlans();
  }, [loadTrips, loadPlans]);

  const isUnlimited = hasCapability(user, 'unlimitedCalc');
  const usedThisMonth = freeCalcsUsedThisMonth(user);
  const onFreePlan = !isUnlimited;
  const limitReached = isCalcLimitReached(user, usedThisMonth, plans);
  const freeLimit = plans.find((p) => p.id === 'free')?.calcLimit ?? null;
  const remaining = freeLimit != null && !isUnlimited ? Math.max(0, freeLimit - usedThisMonth) : null;

  const handleChange = (updates: Partial<CalculatorFormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...updates };
      if (updates.platform && updates.commissionPct === undefined) {
        next.commissionPct = PLATFORM_COMMISSIONS[updates.platform];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!result || !vehicle || !settings) return;
    if (limitReached) {
      setShowPaywall(true);
      return;
    }

    if (!backend.isMock && status === 'authenticated') {
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
      try {
        await backend.validateTripCalculation({
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
          clientResult: result,
        });
      } catch {
        toast.error(t('No se pudo validar el cálculo.'));
        return;
      }
    }

    const trip: Trip = {
      id: crypto.randomUUID(),
      vehicleId: vehicle.id,
      createdAt: new Date(),
      platform: form.platform,
      kmWithPassenger: form.kmWithPassenger,
      deadKm: form.deadKm,
      totalKm: result.realKm,
      fareCharged: form.fareCharged,
      commissionPct: effectiveCommissionPct(form, PLATFORM_COMMISSIONS[form.platform]),
      fuelCost: result.fuelCost,
      tiresCost: result.tireCost,
      oilCost: result.oilCost,
      maintenanceCost: result.maintenanceCost,
      depreciationCost: result.depreciationCost,
      fixedCosts: result.fixedCost,
      commissionAmount: result.commission,
      totalTripCost: result.totalTripCost,
      netProfit: result.netProfit,
      margin: result.margin,
      status: result.status,
    };
    await saveTrip(trip);
    if (onFreePlan) await recordCalculation();
    toast.success(t('Viaje guardado'));
    // Confirm the save with a tick, then clear the form for the next trip.
    setSaved(true);
    setTimeout(() => {
      setForm(initialForm(form.platform));
      setSaved(false);
    }, 1300);
  };

  if (!vehicle) {
    return (
      <EmptyState
        icon={AppIcons.car}
        title={t('Configura tu vehículo')}
        description={t('Necesitas registrar tu vehículo antes de calcular viajes.')}
        actionLabel={t('Ir a Mi Vehículo')}
        onAction={() => navigate('/vehiculo')}
      />
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-road-500">
            {t('Hola, {name}', { name: user?.name?.split(' ')[0] ?? t('conductor') })}
          </p>
          <h1 className="truncate text-lg font-extrabold tracking-tight text-road-900">
            {t('¿Vale la pena este viaje?')}
          </h1>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-road-700 shadow-card ring-1 ring-road-100">
          <AppIcons.car size={15} className="text-brand-600" />
          <span className="max-w-[110px] truncate">
            {vehicle.make} {vehicle.model}
          </span>
        </span>
      </header>

      <ReminderBanners />

      {onFreePlan && remaining != null && (
        <Link
          to="/suscripcion"
          className="press flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-gold-50 to-gold-100 px-3.5 py-2.5 text-sm shadow-card ring-1 ring-gold-200"
        >
          <span className="flex items-center gap-2.5 font-medium text-gold-900">
            <AppIcons.crown size={18} className="shrink-0 text-gold-600" />
            {t('Te quedan {n} cálculos gratis', { n: remaining })}
          </span>
          <span className="shrink-0 font-bold text-gold-800 underline">
            {t('Mejorar plan')}
          </span>
        </Link>
      )}

      <TripForm form={form} onChange={handleChange} />
      {result && form.fareCharged > 0 && (
        <>
          <ProfitabilityResult result={result} currency={user?.currency ?? 'NIO'} />
          <Button
            className={`w-full transition-colors ${
              saved ? 'bg-emerald-600 hover:bg-emerald-600' : ''
            }`}
            size="lg"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? (
              <span className="flex items-center justify-center gap-2">
                <AppIcons.check size={20} strokeWidth={3} className="animate-tick-pop" />
                {t('Guardado')}
              </span>
            ) : (
              t('Guardar viaje')
            )}
          </Button>
        </>
      )}
      {!settings && (
        <p className="text-center text-sm text-road-400">
          <Link to="/ajustes" className="text-brand-600 underline">
            {t('Configura precios de combustible')}
          </Link>
        </p>
      )}

      <Dialog
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        title={t('Límite de cálculos alcanzado')}
      >
        <div className="space-y-3 text-center">
          <AppIcons.crown size={40} className="mx-auto text-amber-500" />
          <p className="text-sm text-road-600">
            {t(
              'Has usado tus cálculos gratis. Suscríbete a un plan para guardar viajes ilimitados y sincronizarlos en la nube.',
            )}
          </p>
          <Button className="w-full" onClick={() => navigate('/suscripcion')}>
            {t('Ver planes')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
