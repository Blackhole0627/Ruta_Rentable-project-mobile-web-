import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getBackend } from '@/core/backend';
import type { AdminMetrics } from '@shared/types/admin.types';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { formatCurrency } from '@/shared/utils/currency';
import { formatPercent } from '@/shared/utils/formatters';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import type { LucideIcon } from 'lucide-react';

const backend = getBackend();

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-road-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-road-500">{label}</span>
        <Icon size={18} className={accent ?? 'text-road-400'} />
      </div>
      <p className="mt-2 text-2xl font-bold text-road-900">{value}</p>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);

  useEffect(() => {
    backend.adminGetMetrics().then(setMetrics);
  }, []);

  if (!metrics) return <LoadingSkeleton variant="cards" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label={t('Usuarios activos')}
          value={String(metrics.activeUsers)}
          icon={AppIcons.users}
          accent="text-brand-500"
        />
        <KpiCard
          label={t('Ingresos del mes')}
          value={formatCurrency(metrics.monthlyRevenue, 'NIO', { compact: true })}
          icon={AppIcons.billing}
          accent="text-brand-500"
        />
        <KpiCard
          label={t('Nuevos este mes')}
          value={String(metrics.newSignupsThisMonth)}
          icon={AppIcons.plus}
        />
        <KpiCard label={t('En prueba')} value={String(metrics.trialUsers)} icon={AppIcons.account} />
        <KpiCard
          label={t('Vencidos')}
          value={String(metrics.overdueAccounts)}
          icon={AppIcons.bell}
          accent="text-danger-500"
        />
        <KpiCard
          label={t('Tasa de cancelación')}
          value={formatPercent(metrics.churnRate)}
          icon={AppIcons.reports}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-road-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-road-700">
            {t('Ingresos (últimos 12 meses)')}
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metrics.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), 'NIO', { compact: true })} />
              <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-road-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-road-700">{t('Crecimiento de usuarios')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={metrics.userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
