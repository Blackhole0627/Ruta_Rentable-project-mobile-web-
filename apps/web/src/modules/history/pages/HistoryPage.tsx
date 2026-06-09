import { useEffect, useMemo, useState } from 'react';
import { useTripStore } from '@/core/store/useTripStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useSettingsStore } from '@/core/store/useSettingsStore';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDate, formatDateShort } from '@/shared/utils/formatters';
import { PLATFORM_LABELS, PLATFORMS } from '@/core/constants/platforms';
import type { TripStatus } from '@shared/financial-model/profitability';
import { classifyTrip } from '@shared/financial-model/profitability';
import type { Platform, Trip } from '@shared/types/trip.types';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { DatePicker } from '@/shared/components/ui/datepicker';
import { Select } from '@/shared/components/ui/select';
import { Dialog } from '@/shared/components/ui/dialog';
import { downloadCsv } from '@/shared/utils/export';
import { formatPercent } from '@/shared/utils/formatters';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';

type StatusFilter = TripStatus | 'all';

/** Recompute a trip's costs after editing, scaling stored per-km costs to new km. */
function recalcTrip(
  base: Trip,
  edits: { kmWithPassenger: number; deadKm: number; fareCharged: number; commissionPct: number },
  thresholds: { profitableThreshold: number; acceptableThreshold: number },
): Trip {
  const oldKm = base.totalKm || 1;
  const newKm = edits.kmWithPassenger + edits.deadKm;
  const scale = newKm / oldKm;
  const fuelCost = base.fuelCost * scale;
  const tiresCost = base.tiresCost * scale;
  const oilCost = base.oilCost * scale;
  const maintenanceCost = base.maintenanceCost * scale;
  const depreciationCost = base.depreciationCost * scale;
  const fixedCosts = base.fixedCosts * scale;
  const commissionAmount = edits.fareCharged * (edits.commissionPct / 100);
  const totalTripCost =
    fuelCost + tiresCost + oilCost + maintenanceCost + depreciationCost + fixedCosts + commissionAmount;
  const netProfit = edits.fareCharged - totalTripCost;
  const margin = edits.fareCharged > 0 ? netProfit / edits.fareCharged : -1;
  return {
    ...base,
    kmWithPassenger: edits.kmWithPassenger,
    deadKm: edits.deadKm,
    totalKm: newKm,
    fareCharged: edits.fareCharged,
    commissionPct: edits.commissionPct,
    fuelCost,
    tiresCost,
    oilCost,
    maintenanceCost,
    depreciationCost,
    fixedCosts,
    commissionAmount,
    totalTripCost,
    netProfit,
    margin,
    status: classifyTrip(margin, thresholds),
  };
}

export function HistoryPage() {
  const { trips, loadTrips, saveTrip, deleteTrip, isLoading } = useTripStore();
  const { user } = useUserStore();
  const { settings, loadSettings } = useSettingsStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editing, setEditing] = useState<Trip | null>(null);

  useEffect(() => {
    loadTrips();
    loadSettings();
  }, [loadTrips, loadSettings]);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (platformFilter !== 'all' && t.platform !== platformFilter) return false;
      const created = new Date(t.createdAt);
      if (fromDate && created < new Date(fromDate)) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (created > end) return false;
      }
      return true;
    });
  }, [trips, statusFilter, platformFilter, fromDate, toDate]);

  const totals = useMemo(
    () => ({
      count: filtered.length,
      income: filtered.reduce((s, t) => s + t.fareCharged, 0),
      profit: filtered.reduce((s, t) => s + t.netProfit, 0),
    }),
    [filtered],
  );

  const currency = user?.currency ?? 'NIO';
  const { t, lang } = useI18n();

  const statusLabel = (s: string) =>
    s === 'profitable' ? t('Rentable') : s === 'acceptable' ? t('Aceptable') : t('No rentable');

  const handleExportCsv = () => {
    downloadCsv(
      `viajes-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        t('Fecha'),
        t('Plataforma'),
        t('Km'),
        t('Tarifa'),
        t('Comisión %'),
        t('Costo total'),
        t('Ganancia'),
        t('Margen'),
        t('Estado'),
      ],
      filtered.map((trip) => [
        formatDateShort(new Date(trip.createdAt), lang),
        t(PLATFORM_LABELS[trip.platform as Platform]),
        trip.totalKm,
        trip.fareCharged.toFixed(2),
        trip.commissionPct,
        trip.totalTripCost.toFixed(2),
        trip.netProfit.toFixed(2),
        formatPercent(trip.margin),
        statusLabel(trip.status),
      ]),
    );
  };

  if (isLoading) return <LoadingSkeleton variant="list" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('Historial')}</h1>
        {trips.length > 0 && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-road-200 bg-white px-3 py-1.5 text-xs font-medium text-road-700"
          >
            <AppIcons.download size={14} /> Excel
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-white p-3 text-center text-sm shadow-sm">
        <div>
          <p className="text-road-500">{t('Viajes')}</p>
          <p className="font-bold">{totals.count}</p>
        </div>
        <div>
          <p className="text-road-500">{t('Ingresos')}</p>
          <p className="font-bold">{formatCurrency(totals.income, currency, { compact: true })}</p>
        </div>
        <div>
          <p className="text-road-500">{t('Ganancia')}</p>
          <p className="font-bold text-brand-600">
            {formatCurrency(totals.profit, currency, { compact: true })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'profitable', 'acceptable', 'not_profitable'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={cn(
              'min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium',
              statusFilter === f ? 'bg-brand-500 text-white' : 'border border-road-200 bg-white',
            )}
          >
            {f === 'all' ? t('Todos') : f === 'profitable' ? t('Rentables') : f === 'acceptable' ? t('Aceptables') : t('No rentables')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">{t('Plataforma')}</Label>
          <Select
            className="mt-1 h-10"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as Platform | 'all')}
          >
            <option value="all">{t('Todas las plataformas')}</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {t(PLATFORM_LABELS[p])}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t('Desde')}</Label>
          <DatePicker
            className="mt-1"
            value={fromDate}
            onChange={setFromDate}
            placeholder={t('Desde')}
          />
        </div>
        <div>
          <Label className="text-xs">{t('Hasta')}</Label>
          <DatePicker
            className="mt-1"
            value={toDate}
            onChange={setToDate}
            placeholder={t('Hasta')}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={AppIcons.history}
          title={t('Sin viajes')}
          description={t('Ajusta los filtros o calcula un viaje y presiona Guardar para verlo aquí.')}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((trip) => (
            <li key={trip.id} className="rounded-lg bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-road-500">{formatDate(new Date(trip.createdAt), lang)}</p>
                  <p className="font-medium">{t(PLATFORM_LABELS[trip.platform as Platform])}</p>
                  <p className="text-sm text-road-500">
                    {trip.totalKm} km · {formatCurrency(trip.fareCharged, currency, { compact: true })}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={trip.status} />
                  <p
                    className={cn(
                      'mt-1 font-bold',
                      trip.netProfit >= 0 ? 'text-brand-600' : 'text-danger-500',
                    )}
                  >
                    {formatCurrency(trip.netProfit, currency, { compact: true })}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2 border-t border-road-100 pt-2">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium text-road-600"
                  onClick={() => setEditing(trip)}
                >
                  <AppIcons.edit size={14} /> {t('Editar')}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium text-danger-500"
                  onClick={async () => {
                    await deleteTrip(trip.id);
                    toast.success(t('Viaje eliminado'));
                  }}
                >
                  <AppIcons.trash size={14} /> {t('Eliminar')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TripEditDialog
        key={editing?.id ?? 'none'}
        trip={editing}
        currency={currency}
        thresholds={{
          profitableThreshold: settings?.profitableThreshold ?? 0.25,
          acceptableThreshold: settings?.acceptableThreshold ?? 0.1,
        }}
        onClose={() => setEditing(null)}
        onSave={async (updated) => {
          await saveTrip(updated);
          setEditing(null);
          toast.success(t('Viaje actualizado'));
        }}
      />
    </div>
  );
}

function TripEditDialog({
  trip,
  currency,
  thresholds,
  onClose,
  onSave,
}: {
  trip: Trip | null;
  currency: 'NIO' | 'USD';
  thresholds: { profitableThreshold: number; acceptableThreshold: number };
  onClose: () => void;
  onSave: (t: Trip) => void;
}) {
  const { t } = useI18n();
  const [km, setKm] = useState(trip?.kmWithPassenger ?? 0);
  const [dead, setDead] = useState(trip?.deadKm ?? 0);
  const [fare, setFare] = useState(trip?.fareCharged ?? 0);
  const [pct, setPct] = useState(trip?.commissionPct ?? 0);

  if (!trip) return null;

  const preview = recalcTrip(
    trip,
    { kmWithPassenger: km, deadKm: dead, fareCharged: fare, commissionPct: pct },
    thresholds,
  );

  return (
    <Dialog open={!!trip} onClose={onClose} title={t('Editar viaje')}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('Km con pasajero')}</Label>
            <Input type="number" value={km} onChange={(e) => setKm(Number(e.target.value))} />
          </div>
          <div>
            <Label>{t('Km vacío')}</Label>
            <Input type="number" value={dead} onChange={(e) => setDead(Number(e.target.value))} />
          </div>
          <div>
            <Label>{t('Tarifa (C$)')}</Label>
            <Input type="number" value={fare} onChange={(e) => setFare(Number(e.target.value))} />
          </div>
          <div>
            <Label>{t('Comisión (%)')}</Label>
            <Input type="number" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-road-50 p-3 text-sm">
          <span>{t('Ganancia neta')}</span>
          <span className={cn('font-bold', preview.netProfit >= 0 ? 'text-brand-600' : 'text-danger-500')}>
            {formatCurrency(preview.netProfit, currency, { compact: true })}
          </span>
        </div>
        <Button className="w-full" onClick={() => onSave(preview)}>
          {t('Guardar cambios')}
        </Button>
      </div>
    </Dialog>
  );
}
