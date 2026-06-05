import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTripStore } from '@/core/store/useTripStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useVehicleStore } from '@/core/store/useVehicleStore';
import { formatCurrency } from '@/shared/utils/currency';
import { formatPercent } from '@/shared/utils/formatters';
import { PLATFORM_LABELS, PLATFORMS } from '@/core/constants/platforms';
import { startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { cn } from '@/shared/utils/cn';
import type { TripStatus } from '@shared/financial-model/profitability';
import { downloadCsv, printReport } from '@/shared/utils/export';
import { AppIcons } from '@/shared/constants/icons';
import type { Platform } from '@shared/types/trip.types';
import { useI18n } from '@/core/i18n/i18n';

type Period = 'day' | 'week' | 'month';

const STATUS_COLORS: Record<TripStatus, string> = {
  profitable: '#22c55e',
  acceptable: '#f59e0b',
  not_profitable: '#ef4444',
};

const PERIOD_TO_MONTH: Record<Period, number> = { day: 30, week: 4.345, month: 1 };

export function ReportsPage() {
  const { trips, loadTrips, isLoading } = useTripStore();
  const { user } = useUserStore();
  const { vehicle, loadVehicles } = useVehicleStore();
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('week');

  useEffect(() => {
    loadTrips();
    loadVehicles();
  }, [loadTrips, loadVehicles]);

  const filtered = useMemo(() => {
    const now = new Date();
    const start =
      period === 'day' ? startOfDay(now) : period === 'week' ? startOfWeek(now) : startOfMonth(now);
    return trips.filter((t) => isAfter(new Date(t.createdAt), start));
  }, [trips, period]);

  const kpis = useMemo(() => {
    const income = filtered.reduce((s, t) => s + t.fareCharged, 0);
    const costs = filtered.reduce((s, t) => s + t.totalTripCost, 0);
    const profit = filtered.reduce((s, t) => s + t.netProfit, 0);
    const km = filtered.reduce((s, t) => s + t.totalKm, 0);
    const avgMargin = filtered.length ? filtered.reduce((s, t) => s + t.margin, 0) / filtered.length : 0;
    const best = filtered.reduce((b, t) => (t.netProfit > (b?.netProfit ?? -Infinity) ? t : b), filtered[0]);
    const worst = filtered.reduce((w, t) => (t.netProfit < (w?.netProfit ?? Infinity) ? t : w), filtered[0]);
    return { income, costs, profit, km, count: filtered.length, avgMargin, best, worst };
  }, [filtered]);

  const breakEven = useMemo(() => {
    const monthlyFixed = vehicle?.monthlyFixedCosts ?? 0;
    if (!monthlyFixed || filtered.length === 0) return null;
    // Contribution = profit with the amortized fixed-cost portion added back.
    const avgContribution =
      filtered.reduce((s, t) => s + t.netProfit + t.fixedCosts, 0) / filtered.length;
    const projectedMonthlyTrips = filtered.length * PERIOD_TO_MONTH[period];
    const tripsNeeded =
      avgContribution > 0 ? Math.ceil(monthlyFixed / avgContribution) : null;
    return {
      monthlyFixed,
      avgContribution,
      tripsNeeded,
      projectedMonthlyTrips: Math.round(projectedMonthlyTrips),
      covered: tripsNeeded != null && projectedMonthlyTrips >= tripsNeeded,
    };
  }, [filtered, vehicle, period]);

  const profitByDay = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t) => {
      const key = new Date(t.createdAt).toLocaleDateString('es-NI', { weekday: 'short' });
      map.set(key, (map.get(key) ?? 0) + t.netProfit);
    });
    return Array.from(map.entries()).map(([day, profit]) => ({ day, profit }));
  }, [filtered]);

  const byPlatform = useMemo(() => {
    return PLATFORMS.map((p) => {
      const platformTrips = filtered.filter((t) => t.platform === p);
      const avg =
        platformTrips.length > 0
          ? platformTrips.reduce((s, t) => s + t.netProfit, 0) / platformTrips.length
          : 0;
      return { platform: PLATFORM_LABELS[p], profit: avg };
    }).filter((d) => d.profit !== 0);
  }, [filtered]);

  const statusDist = useMemo(() => {
    const counts: Record<TripStatus, number> = {
      profitable: 0,
      acceptable: 0,
      not_profitable: 0,
    };
    filtered.forEach((t) => {
      counts[t.status]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name === 'profitable' ? t('Rentable') : name === 'acceptable' ? t('Aceptable') : t('No rentable'),
        value,
        fill: STATUS_COLORS[name as keyof typeof STATUS_COLORS],
      }));
  }, [filtered, t]);

  const periodLabel = period === 'day' ? t('Hoy') : period === 'week' ? t('Semana') : t('Mes');

  const handleExportCsv = () => {
    downloadCsv(
      `reporte-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Fecha', 'Plataforma', 'Km', 'Tarifa', 'Costo', 'Ganancia', 'Margen', 'Estado'],
      filtered.map((t) => [
        new Date(t.createdAt).toLocaleDateString('es-NI'),
        PLATFORM_LABELS[t.platform as Platform],
        t.totalKm,
        t.fareCharged.toFixed(2),
        t.totalTripCost.toFixed(2),
        t.netProfit.toFixed(2),
        formatPercent(t.margin),
        t.status,
      ]),
    );
  };

  const handleExportPdf = () => {
    const currency = user?.currency ?? 'NIO';
    const kpiCards = [
      { label: t('Ingresos'), value: formatCurrency(kpis.income, currency, { compact: true }) },
      { label: t('Costos'), value: formatCurrency(kpis.costs, currency, { compact: true }) },
      { label: t('Ganancia'), value: formatCurrency(kpis.profit, currency, { compact: true }) },
      { label: t('Margen prom.'), value: formatPercent(kpis.avgMargin) },
      { label: t('Km totales'), value: kpis.km.toFixed(0) },
      { label: t('Viajes'), value: String(kpis.count) },
    ]
      .map((k) => `<div class="kpi"><div class="label">${k.label}</div><div class="value">${k.value}</div></div>`)
      .join('');
    const platformRows = byPlatform
      .map((p) => `<tr><td>${p.platform}</td><td>${formatCurrency(p.profit, currency, { compact: true })}</td></tr>`)
      .join('');
    printReport(
      `${t('Reportes')} ${periodLabel} — RutaRentable`,
      `<h1>${t('Reportes')} — ${periodLabel}</h1>
       <div class="sub">${new Date().toLocaleDateString('es-NI')}</div>
       <div class="kpis">${kpiCards}</div>
       <h3>${t('Ganancia promedio por plataforma')}</h3>
       <table><thead><tr><th>${t('Plataforma')}</th><th>${t('Ganancia')}</th></tr></thead>
       <tbody>${platformRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>`,
    );
  };

  if (isLoading) return <LoadingSkeleton variant="page" />;

  const currency = user?.currency ?? 'NIO';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('Reportes')}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-road-200 bg-white px-3 py-1.5 text-xs font-medium text-road-700"
          >
            <AppIcons.download size={14} /> Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-lg border border-road-200 bg-white px-3 py-1.5 text-xs font-medium text-road-700"
          >
            <AppIcons.pdf size={14} /> PDF
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        {(['day', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium min-h-[44px]',
              period === p ? 'bg-brand-500 text-white' : 'bg-white border border-road-200',
            )}
          >
            {p === 'day' ? t('Hoy') : p === 'week' ? t('Semana') : t('Mes')}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          { label: t('Ingresos'), value: formatCurrency(kpis.income, currency, { compact: true }) },
          { label: t('Costos'), value: formatCurrency(kpis.costs, currency, { compact: true }) },
          { label: t('Ganancia'), value: formatCurrency(kpis.profit, currency, { compact: true }) },
          { label: t('Margen prom.'), value: formatPercent(kpis.avgMargin) },
          { label: t('Km totales'), value: kpis.km.toFixed(0) },
          { label: t('Viajes'), value: String(kpis.count) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-road-500">{k.label}</p>
            <p className="font-bold">{k.value}</p>
          </div>
        ))}
      </div>
      {breakEven && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-brand-800">{t('Punto de equilibrio mensual')}</p>
          <p className="mt-1 text-xs text-road-600">
            {t('Viajes al mes para cubrir tus costos fijos de {fixed}.', {
              fixed: formatCurrency(breakEven.monthlyFixed, currency, { compact: true }),
            })}
          </p>
          {breakEven.tripsNeeded == null ? (
            <p className="mt-2 text-sm font-medium text-danger-500">
              {t('Con la ganancia promedio actual no se alcanza el equilibrio. Sube tarifas o reduce costos.')}
            </p>
          ) : (
            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-brand-700">{breakEven.tripsNeeded}</p>
                <p className="text-xs text-road-500">{t('viajes/mes necesarios')}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{breakEven.projectedMonthlyTrips}</p>
                <p className="text-xs text-road-500">{t('tu ritmo proyectado')}</p>
                <span
                  className={cn(
                    'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                    breakEven.covered ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-900',
                  )}
                >
                  {breakEven.covered ? t('Cubres tus costos') : t('Por debajo del equilibrio')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {kpis.best && kpis.worst && kpis.count > 0 && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-road-500">{t('Mejor viaje')}</p>
            <p className="font-bold text-brand-600">
              {formatCurrency(kpis.best.netProfit, currency, { compact: true })}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-road-500">{t('Peor viaje')}</p>
            <p className="font-bold text-danger-500">
              {formatCurrency(kpis.worst.netProfit, currency, { compact: true })}
            </p>
          </div>
        </div>
      )}

      {profitByDay.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">{t('Ganancia por día')}</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={profitByDay}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} />
              <Bar dataKey="profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {statusDist.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">{t('Distribución')}</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" innerRadius={40} outerRadius={60}>
                {statusDist.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {byPlatform.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">{t('Ganancia por plataforma')}</p>
          <ResponsiveContainer width="100%" height={byPlatform.length * 36}>
            <BarChart data={byPlatform} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="platform" width={70} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), currency)} />
              <Bar dataKey="profit" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
