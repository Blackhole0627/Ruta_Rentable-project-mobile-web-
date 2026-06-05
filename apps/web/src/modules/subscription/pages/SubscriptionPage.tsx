import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog } from '@/shared/components/ui/dialog';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { useSubscriptionStore } from '@/core/store/useSubscriptionStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDate } from '@/shared/utils/formatters';
import { fileToCompressedDataUrl } from '@/shared/utils/image';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { BANK_DETAILS } from '../bankDetails';

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { status } = useAuthStore();
  const { user } = useUserStore();
  const { plans, payments, isLoading, load, submitReceipt, unsubscribe } = useSubscriptionStore();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmUnsub, setConfirmUnsub] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [load]);

  if (status !== 'authenticated') {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{t('Suscripción')}</h1>
        <Card>
          <CardContent className="py-8 text-center text-road-600">
            {t('Inicia sesión para gestionar tu suscripción.')}
            <Button className="mt-4" onClick={() => navigate('/entrar')}>
              {t('Iniciar sesión')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && !plans.length) return <LoadingSkeleton variant="page" />;

  const currentPlan = user?.currentPlan ?? 'free';
  const currency = user?.currency ?? 'NIO';
  const selectedPlan = plans.find((p) => p.id === selected);
  const latest = payments[0];
  // One plan at a time: block new subscriptions while one is pending review or active.
  const isPending = latest?.status === 'pending';
  const hasActivePaid = user?.subscriptionStatus === 'active' && currentPlan !== 'free';

  const handleUnsubscribe = async () => {
    if (!confirmUnsub) {
      setConfirmUnsub(true);
      return;
    }
    setWorking(true);
    try {
      await unsubscribe();
    } finally {
      setWorking(false);
      setConfirmUnsub(false);
    }
  };

  // Status banner
  let banner: { variant: 'active' | 'pending' | 'rejected' | 'overdue'; text: string } | null =
    null;
  if (user?.subscriptionStatus === 'active') {
    banner = { variant: 'active', text: t('Suscripción activa') };
  } else if (latest?.status === 'pending') {
    banner = { variant: 'pending', text: t('Comprobante en revisión') };
  } else if (latest?.status === 'rejected') {
    banner = { variant: 'rejected', text: t('Comprobante rechazado. Intenta de nuevo.') };
  } else if (user?.subscriptionStatus === 'overdue') {
    banner = { variant: 'overdue', text: t('Pago vencido') };
  }

  const bannerStyles: Record<string, string> = {
    active: 'bg-brand-50 text-brand-800 border-brand-300',
    pending: 'bg-amber-50 text-amber-800 border-amber-300',
    rejected: 'bg-red-50 text-danger-600 border-danger-500/40',
    overdue: 'bg-red-50 text-danger-600 border-danger-500/40',
  };

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText(BANK_DETAILS.iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setWorking(true);
    try {
      setReceipt(await fileToCompressedDataUrl(file));
    } finally {
      setWorking(false);
    }
  };

  const closeDialog = () => {
    setSelected(null);
    setReceipt(null);
  };

  const handleSubmit = async () => {
    if (!selected || !receipt) return;
    setWorking(true);
    try {
      await submitReceipt(selected, receipt);
      closeDialog();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('Suscripción')}</h1>

      {banner && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium',
            bannerStyles[banner.variant],
          )}
        >
          <AppIcons.clock size={16} className="shrink-0" />
          {banner.text}
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <Card
              key={plan.id}
              className={isCurrent ? 'border-brand-500 ring-1 ring-brand-500' : undefined}
            >
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  {isCurrent ? (
                    <Badge variant="profitable">{t('Plan actual')}</Badge>
                  ) : (
                    <span className="text-right">
                      <span className="text-xl font-bold text-brand-700">
                        {formatCurrency(plan.priceNio ?? 0, currency, { compact: true })}
                      </span>
                      <span className="text-xs text-road-500">{t('/mes')}</span>
                    </span>
                  )}
                </div>
                <ul className="space-y-1 text-sm text-road-600">
                  {(plan.features ?? []).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <AppIcons.check size={14} className="text-brand-600" /> {f}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <AppIcons.check size={14} className="text-brand-600" />
                    {plan.calcLimit == null
                      ? t('Cálculos ilimitados')
                      : t('{n} cálculos', { n: plan.calcLimit })}
                  </li>
                </ul>
                {isCurrent && hasActivePaid ? (
                  <Button
                    variant="outline"
                    className="mt-2 w-full text-danger-500"
                    disabled={working}
                    onClick={handleUnsubscribe}
                  >
                    {confirmUnsub ? t('¿Confirmar cancelación?') : t('Cancelar suscripción')}
                  </Button>
                ) : !isCurrent && (plan.priceNio ?? 0) > 0 ? (
                  <Button
                    className="mt-2 w-full"
                    disabled={isPending || hasActivePaid}
                    onClick={() => setSelected(plan.id)}
                  >
                    {isPending
                      ? t('En revisión')
                      : hasActivePaid
                        ? t('Cancela tu plan actual primero')
                        : t('Suscribirme')}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {payments.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
              <AppIcons.billing {...iconPropsSm} /> {t('Historial de pagos')}
            </h3>
            <ul className="divide-y divide-road-100 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="block font-medium">
                      {formatCurrency(p.amount, currency, { compact: true })}
                    </span>
                    <span className="text-xs text-road-500">
                      {formatDate(new Date(p.paidAt))}
                    </span>
                  </span>
                  <Badge
                    variant={
                      p.status === 'confirmed'
                        ? 'profitable'
                        : p.status === 'rejected'
                          ? 'danger'
                          : 'default'
                    }
                  >
                    {p.status === 'confirmed'
                      ? t('Confirmado')
                      : p.status === 'rejected'
                        ? t('Rechazado')
                        : t('En revisión')}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Payment / bank-transfer dialog */}
      <Dialog
        open={!!selected}
        onClose={closeDialog}
        title={t('Pagar {plan}', { plan: selectedPlan?.name ?? '' })}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-brand-50 px-3 py-2 text-center">
            <span className="text-2xl font-extrabold text-brand-700">
              {formatCurrency(selectedPlan?.priceNio ?? 0, currency, { compact: true })}
            </span>
            <span className="text-sm text-road-500"> {t('/mes')}</span>
          </div>

          {/* Bank details */}
          <div className="space-y-2 rounded-xl border border-road-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-road-400">
              {t('Transfiere a esta cuenta')}
            </p>
            <Row label={t('Banco')} value={BANK_DETAILS.bank} />
            <Row label={t('Titular')} value={BANK_DETAILS.holder} />
            <Row label={t('Tipo de cuenta')} value={BANK_DETAILS.accountType} />
            <Row label={t('Moneda')} value={BANK_DETAILS.currency} />
            <div>
              <p className="text-xs text-road-500">IBAN</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md bg-road-100 px-2 py-1.5 text-sm font-semibold">
                  {BANK_DETAILS.iban}
                </code>
                <button
                  type="button"
                  onClick={copyIban}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <AppIcons.copy size={14} /> {copied ? t('Copiado') : t('Copiar')}
                </button>
              </div>
            </div>
          </div>

          {/* Upload comprobante */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-road-700">{t('Sube tu comprobante')}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {receipt ? (
              <div className="space-y-2">
                <img
                  src={receipt}
                  alt={t('Comprobante')}
                  className="max-h-56 w-full rounded-lg border border-road-200 object-contain"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-brand-600 underline"
                >
                  {t('Cambiar imagen')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={working}
                className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-road-300 py-6 text-road-500 hover:bg-road-50"
              >
                <AppIcons.upload size={24} />
                <span className="text-sm">{t('Toca para subir foto/captura')}</span>
              </button>
            )}
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={working || !receipt}>
            {working ? t('Enviando…') : t('Enviar para revisión')}
          </Button>
          <p className="text-center text-xs text-road-400">
            {t('El administrador revisará tu pago y activará tu cuenta.')}
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-road-500">{label}</span>
      <span className="text-right font-medium text-road-900">{value}</span>
    </div>
  );
}
