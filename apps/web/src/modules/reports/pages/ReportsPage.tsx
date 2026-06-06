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
  CartesianGrid,
  Legend,
} from 'recharts';
import { useTripStore } from '@/core/store/useTripStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useVehicleStore } from '@/core/store/useVehicleStore';
import { formatCurrency } from '@/shared/utils/currency';
import { formatPercent, formatDateShort } from '@/shared/utils/formatters';
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
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-US' : 'es-NI';
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
    const sums = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    filtered.forEach((tr) => {
      const d = new Date(tr.createdAt).getDay(); // 0=Sun … 6=Sat
      sums[d] += tr.netProfit;
      counts[d] += 1;
    });
    // Conventional Mon→Sun layout with weekday labels in the active language.
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order
      .map((d) => {
        const ref = new Date(2024, 0, 7 + d); // Jan 7 2024 is a Sunday
        return {
          day: ref.toLocaleDateString(locale, { weekday: 'short' }),
          profit: Math.round(sums[d]),
          count: counts[d],
        };
      })
      .filter((e) => e.count > 0);
  }, [filtered, locale]);

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

  const statusLabel = (s: string) =>
    s === 'profitable' ? t('Rentable') : s === 'acceptable' ? t('Aceptable') : t('No rentable');

  const handleExportCsv = () => {
    downloadCsv(
      `reporte-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
      [t('Fecha'), t('Plataforma'), t('Km'), t('Tarifa'), t('Costo total'), t('Ganancia'), t('Margen'), t('Estado')],
      filtered.map((tr) => [
        formatDateShort(new Date(tr.createdAt), lang),
        t(PLATFORM_LABELS[tr.platform as Platform]),
        tr.totalKm,
        tr.fareCharged.toFixed(2),
        tr.totalTripCost.toFixed(2),
        tr.netProfit.toFixed(2),
        formatPercent(tr.margin),
        statusLabel(tr.status),
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
    const tripRows = filtered
      .slice(0, 60)
      .map(
        (tr) =>
          `<tr><td>${formatDateShort(new Date(tr.createdAt), lang)}</td>` +
          `<td>${t(PLATFORM_LABELS[tr.platform as Platform])}</td>` +
          `<td>${tr.totalKm}</td>` +
          `<td>${formatCurrency(tr.fareCharged, currency, { compact: true })}</td>` +
          `<td>${formatCurrency(tr.netProfit, currency, { compact: true })}</td>` +
          `<td>${statusLabel(tr.status)}</td></tr>`,
      )
      .join('');
    printReport(
      `${t('Reportes')} — ${periodLabel}`,
      `<h1>${t('Reportes')} — ${periodLabel}</h1>
       <div class="sub">${t('Resumen')}</div>
       <div class="kpis">${kpiCards}</div>
       <h3>${t('Ganancia promedio por plataforma')}</h3>
       <table><thead><tr><th>${t('Plataforma')}</th><th>${t('Ganancia')}</th></tr></thead>
       <tbody>${platformRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
       <h3>${t('Reporte de viajes')}</h3>
       <table><thead><tr><th>${t('Fecha')}</th><th>${t('Plataforma')}</th><th>${t('Km')}</th><th>${t('Tarifa')}</th><th>${t('Ganancia')}</th><th>${t('Estado')}</th></tr></thead>
       <tbody>${tripRows || '<tr><td colspan="6">—</td></tr>'}</tbody></table>`,
      { lang, watermark: 'RutaRentable' },
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
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-road-700">{t('Ganancia por día')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={profitByDay} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#16a34a" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                width={48}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(v) => formatCurrency(Number(v), currency, { compact: true })}
              />
              <Tooltip
                cursor={{ fill: 'rgba(34,197,94,0.08)' }}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v) => [formatCurrency(Number(v), currency), t('Ganancia')]}
              />
              <Bar dataKey="profit" fill="url(#barGreen)" radius={[6, 6, 0, 0]} maxBarSize={46} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {statusDist.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-road-700">{t('Distribución')}</p>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={statusDist}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                strokeWidth={0}
                label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false}
              >
                {statusDist.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v, n) => [`${v} ${t('Viajes').toLowerCase()}`, String(n)]}
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {byPlatform.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-road-700">{t('Ganancia por plataforma')}</p>
          <ResponsiveContainer width="100%" height={byPlatform.length * 44 + 16}>
            <BarChart data={byPlatform} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(v) => formatCurrency(Number(v), currency, { compact: true })}
              />
              <YAxis
                type="category"
                dataKey="platform"
                width={76}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(34,197,94,0.08)' }}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v) => [formatCurrency(Number(v), currency), t('Ganancia')]}
              />
              <Bar dataKey="profit" fill="#22c55e" radius={[0, 6, 6, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
