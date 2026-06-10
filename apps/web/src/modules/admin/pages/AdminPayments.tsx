import { useEffect, useState } from 'react';
import { getBackend } from '@/core/backend';
import type { AdminPaymentRow, SubscriptionPlan } from '@shared/types/subscription.types';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Select } from '@/shared/components/ui/select';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDate } from '@/shared/utils/formatters';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';

const backend = getBackend();

export function AdminPayments() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminPaymentRow[] | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => backend.adminListPayments().then(setRows);

  useEffect(() => {
    reload();
    backend.adminListPlans().then(setPlans);
  }, []);

  const planName = (id?: string) => plans.find((p) => p.id === id)?.name ?? id ?? '—';

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await backend.adminReviewPayment(id, approve);
      await reload();
      toast.success(approve ? t('Pago aprobado') : t('Pago rechazado'));
    } finally {
      setBusy(null);
    }
  };

  if (!rows) return <LoadingSkeleton variant="table" />;

  const pending = rows.filter((r) => r.status === 'pending');
  const filtered =
    planFilter === 'all' ? rows : rows.filter((r) => (r.planId ?? '') === planFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-road-900">{t('Pagos')}</h1>
          <p className="text-sm text-road-500">
            {t('{n} pendientes de revisión', { n: pending.length })}
          </p>
        </div>
        <Select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="w-44"
        >
          <option value="all">{t('Todos los planes')}</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-road-200 bg-white py-12 text-center text-road-400">
          {t('Sin pagos todavía')}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-road-200 bg-white p-3 sm:flex-row sm:items-center"
            >
              {/* Receipt thumbnail */}
              {p.receiptUrl ? (
                <button
                  type="button"
                  onClick={() => setZoom(p.receiptUrl!)}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-road-200"
                >
                  <img src={p.receiptUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-road-100 text-road-300">
                  <AppIcons.image size={22} />
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-road-900">
                    {p.userName || p.userEmail || t('Conductor')}
                  </p>
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                    {planName(p.planId)}
                  </span>
                </div>
                <p className="truncate text-xs text-road-500">{p.userEmail}</p>
                <p className="mt-0.5 text-sm">
                  <span className="font-bold text-brand-700">
                    {formatCurrency(p.amount, p.currency, { compact: true })}
                  </span>
                  <span className="text-road-400"> · {formatDate(new Date(p.paidAt))}</span>
                </p>
              </div>

              {/* Actions / status */}
              {p.status === 'pending' ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    className="text-danger-500"
                    disabled={busy === p.id}
                    onClick={() => review(p.id, false)}
                  >
                    {t('Rechazar')}
                  </Button>
                  <Button disabled={busy === p.id} onClick={() => review(p.id, true)}>
                    <AppIcons.check size={16} /> {t('Aprobar')}
                  </Button>
                </div>
              ) : (
                <Badge variant={p.status === 'confirmed' ? 'profitable' : 'danger'}>
                  {p.status === 'confirmed' ? t('Aprobado') : t('Rechazado')}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receipt zoom */}
      {zoom && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-road-900/80 p-4"
          onClick={() => setZoom(null)}
          role="presentation"
        >
          <img src={zoom} alt={t('Comprobante')} className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
