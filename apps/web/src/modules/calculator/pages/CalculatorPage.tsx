import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TripForm } from '../components/TripForm';
import { ProfitabilityResult } from '../components/ProfitabilityResult';
import { useCalculator, type CalculatorFormState } from '../hooks/useCalculator';
import { useUserStore } from '@/core/store/useUserStore';
import { useVehicleStore } from '@/core/store/useVehicleStore';
import { useTripStore } from '@/core/store/useTripStore';
import { useSettingsStore } from '@/core/store/useSettingsStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import {
  useSubscriptionStore,
  isCalcLimitReached,
} from '@/core/store/useSubscriptionStore';
import { PLATFORM_COMMISSIONS } from '@/core/constants/platforms';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/EmptyState';
import { Dialog } from '@/shared/components/ui/dialog';
import { ReminderBanners } from '@/shared/components/ReminderBanners';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import type { Trip } from '@shared/types/trip.types';

const initialForm = (platform: CalculatorFormState['platform']): CalculatorFormState => ({
  platform,
  commissionPct: PLATFORM_COMMISSIONS[platform],
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
  const { status } = useAuthStore();
  const { plans, load: loadPlans } = useSubscriptionStore();
  const [form, setForm] = useState<CalculatorFormState>(initialForm('indrive'));
  const [showPaywall, setShowPaywall] = useState(false);
  const [saved, setSaved] = useState(false);
  const result = useCalculator(form);
  const { t } = useI18n();

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (status === 'authenticated') loadPlans();
  }, [status, loadPlans]);

  const isAuthed = status === 'authenticated';
  const onFreePlan = (user?.currentPlan ?? 'free') === 'free';
  const limitReached =
    isAuthed && isCalcLimitReached(user?.currentPlan, user?.freeCalculationsUsed, plans);
  const freeLimit = plans.find((p) => p.id === 'free')?.calcLimit ?? null;
  const remaining =
    freeLimit != null ? Math.max(0, freeLimit - (user?.freeCalculationsUsed ?? 0)) : null;

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
    if (!result || !vehicle) return;
    if (limitReached) {
      setShowPaywall(true);
      return;
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
      commissionPct: form.commissionPct,
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
    if (isAuthed && onFreePlan) await recordCalculation();
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
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-road-900">
          {t('Hola, {name}', { name: user?.name?.split(' ')[0] ?? t('conductor') })}
        </h1>
        <p className="text-sm text-road-500">
          {vehicle.make} {vehicle.model}
        </p>
      </header>

      <ReminderBanners />

      {isAuthed && onFreePlan && remaining != null && (
        <div className="flex items-center justify-between rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          <span>{t('Te quedan {n} cálculos gratis', { n: remaining })}</span>
          <Link to="/suscripcion" className="font-semibold underline">
            {t('Mejorar plan')}
          </Link>
        </div>
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
