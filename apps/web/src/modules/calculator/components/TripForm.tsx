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
    <div className="space-y-2.5">
      {/* Trip details: platform, commission & distances */}
      <div className="space-y-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-road-100">
        <div>
          <Label>{t('Plataforma')}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ platform: p })}
                className={cn(
                  'press rounded-full px-4 py-2 text-sm font-semibold transition-colors min-h-[44px] ring-1',
                  form.platform === p
                    ? 'bg-brand-grad text-white shadow-brand ring-transparent'
                    : 'bg-white text-road-700 ring-road-200 hover:bg-road-50',
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
            <div className="flex rounded-full bg-road-100 p-0.5 ring-1 ring-road-200">
              {(['percent', 'fixed'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ commissionMode: m })}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-bold transition-colors',
                    form.commissionMode === m
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-road-500',
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
              className="mt-1.5 tabular"
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
              className="mt-1.5 tabular"
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
                className="press flex items-center gap-1.5 rounded-full bg-danger-500 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-danger-100"
              >
                <AppIcons.stop size={14} />{' '}
                {t('Detener ({km} km)', { km: tracker.distanceKm.toFixed(2) })}
              </button>
            ) : (
              <button
                type="button"
                onClick={tracker.start}
                className="press flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200"
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
            className="mt-1.5 tabular text-lg"
            placeholder="0"
          />
          {tracker.tracking && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              {t('Midiendo distancia… mantén la app abierta durante el viaje.')}
            </p>
          )}
          {tracker.error && <p className="mt-1.5 text-xs text-danger-500">{tracker.error}</p>}
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
            className="mt-1.5 tabular"
            placeholder="0"
          />
        </div>
      </div>

      {/* Headline input: the fare offered */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-white p-3 shadow-card ring-1 ring-brand-100">
        <Label htmlFor="fare" className="text-brand-800">
          {t('Tarifa ofrecida (C$)')}
        </Label>
        <Input
          id="fare"
          type="number"
          min={0}
          value={form.fareCharged || ''}
          onChange={(e) => onChange({ fareCharged: Number(e.target.value) })}
          className="mt-1.5 tabular h-14 text-2xl font-extrabold tracking-tight"
          placeholder="0"
        />
      </div>
    </div>
  );
}
