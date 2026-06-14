import { useEffect, useRef } from 'react';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { PLATFORMS, PLATFORM_LABELS } from '@/core/constants/platforms';
import type { CalculatorFormState } from '../hooks/useCalculator';
import { cn } from '@/shared/utils/cn';
import { useTripTrackerStore } from '@/core/store/useTripTrackerStore';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

interface TripFormProps {
  form: CalculatorFormState;
  onChange: (updates: Partial<CalculatorFormState>) => void;
}

export function TripForm({ form, onChange }: TripFormProps) {
  const { t } = useI18n();
  const tracker = useTripTrackerStore();
  const appliedRef = useRef(0);

  // When a measurement ends (here or from the floating banner on any screen),
  // drop the distance into the km field. Persists until the driver changes it.
  useEffect(() => {
    if (tracker.lastResult > 0 && tracker.lastResult !== appliedRef.current) {
      appliedRef.current = tracker.lastResult;
      onChange({ kmWithPassenger: tracker.lastResult });
    }
  }, [tracker.lastResult, onChange]);

  const handleStop = () => {
    const distance = tracker.stop();
    if (typeof distance === 'number' && distance > 0) {
      appliedRef.current = distance;
      onChange({ kmWithPassenger: distance });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{t('Plataforma')}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ platform: p })}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px]',
                form.platform === p
                  ? 'bg-brand-500 text-white'
                  : 'bg-white border border-road-200 text-road-700',
              )}
            >
              {t(PLATFORM_LABELS[p])}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="commission">
            {form.commissionMode === 'fixed' ? t('Comisión (C$)') : t('Comisión (%)')}
          </Label>
          <div className="flex rounded-lg border border-road-200 p-0.5">
            {(['percent', 'fixed'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ commissionMode: m })}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                  form.commissionMode === m ? 'bg-brand-500 text-white' : 'text-road-500',
                )}
              >
                {m === 'percent' ? '%' : 'C$'}
              </button>
            ))}
          </div>
        </div>
        {form.commissionMode === 'fixed' ? (
          <Input
            id="commission"
            type="number"
            min={0}
            value={form.commissionFixed || ''}
            onChange={(e) => onChange({ commissionFixed: Number(e.target.value) })}
            className="mt-1"
            placeholder="0"
          />
        ) : (
          <Input
            id="commission"
            type="number"
            min={0}
            max={100}
            value={form.commissionPct}
            onChange={(e) => onChange({ commissionPct: Number(e.target.value) })}
            className="mt-1"
          />
        )}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="km">{t('Km con pasajero')}</Label>
          {tracker.tracking ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1.5 rounded-full bg-danger-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <AppIcons.stop size={14} />{' '}
              {t('Detener ({km} km)', { km: tracker.distanceKm.toFixed(2) })}
            </button>
          ) : (
            <button
              type="button"
              onClick={tracker.start}
              className="flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700"
            >
              <AppIcons.gps size={14} /> {t('Medir con GPS')}
            </button>
          )}
        </div>
        <Input
          id="km"
          type="number"
          min={0}
          step={0.1}
          value={form.kmWithPassenger || ''}
          onChange={(e) => onChange({ kmWithPassenger: Number(e.target.value) })}
          className="mt-1 text-lg"
          placeholder="0"
        />
        {tracker.tracking && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            {t('Midiendo distancia… mantén la app abierta durante el viaje.')}
          </p>
        )}
        {tracker.error && <p className="mt-1 text-xs text-danger-500">{tracker.error}</p>}
      </div>
      <div>
        <Label htmlFor="dead">{t('Km vacíos (hasta recoger)')}</Label>
        <Input
          id="dead"
          type="number"
          min={0}
          step={0.1}
          value={form.deadKm || ''}
          onChange={(e) => onChange({ deadKm: Number(e.target.value) })}
          className="mt-1"
          placeholder="0"
        />
      </div>
      <div>
        <Label htmlFor="fare">{t('Tarifa ofrecida (C$)')}</Label>
        <Input
          id="fare"
          type="number"
          min={0}
          value={form.fareCharged || ''}
          onChange={(e) => onChange({ fareCharged: Number(e.target.value) })}
          className="mt-1 text-2xl font-bold h-14"
          placeholder="0"
        />
      </div>
    </div>
  );
}
