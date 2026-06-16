import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog } from '@/shared/components/ui/dialog';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { useSubscriptionStore } from '@/core/store/useSubscriptionStore';
import { useUserStore } from '@/core/store/useUserStore';
import { useAuthStore } from '@/core/store/useAuthStore';
import { BankTransferForm } from '../components/BankTransferForm';
import { KycSection } from '../components/KycSection';
import { isKycVerified } from '@/core/subscription/planAccess';
import { KYC_ENABLED } from '@/core/featureFlags';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDate } from '@/shared/utils/formatters';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';

type PayMethod = 'card' | 'transfer';

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { status } = useAuthStore();
  const { user } = useUserStore();
  const { plans, payments, isLoading, load, startPoketCheckout, submitReceipt, unsubscribe } =
    useSubscriptionStore();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('card');
  const [working, setWorking] = useState(false);
  const [confirmUnsub, setConfirmUnsub] = useState(false);

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
  const kycVerified = isKycVerified(user);
  const kycStatus = user?.kycStatus ?? 'none';
  const hasActivePaid =
    user?.subscriptionStatus === 'active' && currentPlan !== 'free' && kycVerified;
  // KYC is relevant once the driver shows paid intent (a paid current plan, an
  // in-flight paid payment, or an existing KYC record).
  const showKyc =
    KYC_ENABLED &&
    !!user &&
    (currentPlan !== 'free' ||
      kycStatus !== 'none' ||
      payments.some((p) => (p.planId ?? 'free') !== 'free'));

  const handleUnsubscribe = async () => {
    if (!confirmUnsub) {
      setConfirmUnsub(true);
      return;
    }
    setWorking(true);
    try {
      await unsubscribe();
      toast.info(t('Suscripción cancelada'));
    } finally {
      setWorking(false);
      setConfirmUnsub(false);
    }
  };

  // Status banner. A paid plan that isn't KYC-verified is gated, so KYC state
  // takes priority over the "active" message when a paid plan is involved.
  let banner: {
    variant: 'active' | 'pending' | 'rejected' | 'overdue' | 'kyc';
    text: string;
  } | null = null;
  if (currentPlan !== 'free' && !kycVerified) {
    banner = {
      variant: 'kyc',
      text:
        kycStatus === 'submitted'
          ? t('Pago recibido — verificación de identidad en revisión.')
          : kycStatus === 'rejected'
            ? t('Verificación rechazada. Reenvía tus documentos para activar tu plan.')
            : t('Completa la verificación de identidad para activar tu plan.'),
    };
  } else if (user?.subscriptionStatus === 'active') {
    banner = { variant: 'active', text: t('Suscripción activa') };
  } else if (latest?.status === 'pending') {
    banner = { variant: 'pending', text: t('Comprobante en revisión') };
  } else if (latest?.status === 'rejected') {
    banner = { variant: 'rejected', text: t('Pago rechazado. Intenta de nuevo.') };
  } else if (user?.subscriptionStatus === 'overdue') {
    banner = { variant: 'overdue', text: t('Pago vencido') };
  }

  const bannerStyles: Record<string, string> = {
    active: 'bg-brand-50 text-brand-800 border-brand-300',
    pending: 'bg-amber-50 text-amber-800 border-amber-300',
    rejected: 'bg-red-50 text-danger-600 border-danger-500/40',
    overdue: 'bg-red-50 text-danger-600 border-danger-500/40',
    kyc: 'bg-amber-50 text-amber-800 border-amber-300',
  };

  const closeDialog = () => {
    setSelected(null);
    setPayMethod('card');
  };

  const handlePay = async () => {
    if (!selected) return;
    setWorking(true);
    try {
      const { redirected } = await startPoketCheckout(selected);
      if (!redirected) {
        // Mock backend (no real gateway): payment simulated instantly.
        closeDialog();
        toast.success(t('Pago procesado. Tu suscripción está activa.'));
      }
      // When redirected === true the browser is already navigating to Poket.
    } catch {
      toast.error(t('No pudimos iniciar el pago. Intenta de nuevo.'));
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

      {showKyc && <KycSection />}

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
                    disabled={hasActivePaid}
                    onClick={() => setSelected(plan.id)}
                  >
                    {hasActivePaid
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
                        : t('En proceso')}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Payment dialog */}
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

          {!kycVerified && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AppIcons.shieldCheck size={16} className="mt-0.5 shrink-0" />
              <p>
                {t(
                  'Tras el pago deberás verificar tu identidad (KYC). Tu plan se activa cuando un administrador la apruebe.',
                )}
              </p>
            </div>
          )}

          <div className="flex rounded-lg border border-road-200 p-0.5 text-sm">
            <button
              type="button"
              className={cn(
                'flex-1 rounded-md py-2 font-medium transition-colors',
                payMethod === 'card' ? 'bg-brand-500 text-white' : 'text-road-600',
              )}
              onClick={() => setPayMethod('card')}
            >
              {t('Pagar con tarjeta')}
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded-md py-2 font-medium transition-colors',
                payMethod === 'transfer' ? 'bg-brand-500 text-white' : 'text-road-600',
              )}
              onClick={() => setPayMethod('transfer')}
            >
              {t('Transferencia bancaria')}
            </button>
          </div>

          {payMethod === 'card' ? (
            <>
              <div className="flex items-start gap-2 rounded-xl border border-road-200 p-3 text-sm text-road-600">
                <AppIcons.billing size={18} className="mt-0.5 shrink-0 text-brand-600" />
                <p>
                  {t(
                    'Paga de forma segura con tarjeta de crédito o débito. Tu suscripción se activa automáticamente al confirmar el pago.',
                  )}
                </p>
              </div>
              <Button className="w-full" onClick={handlePay} disabled={working}>
                {working ? t('Redirigiendo…') : t('Pagar con tarjeta')}
              </Button>
              <p className="text-center text-xs text-road-400">
                {t('Procesado por LAFISE Poket. No almacenamos los datos de tu tarjeta.')}
              </p>
            </>
          ) : (
            <BankTransferForm
              amount={selectedPlan?.priceNio ?? 0}
              currency={currency}
              disabled={working}
              onSubmit={async (receiptUrl) => {
                if (!selected) return;
                setWorking(true);
                try {
                  await submitReceipt(selected, receiptUrl);
                  closeDialog();
                  await load();
                  toast.success(t('Comprobante en revisión'));
                } catch {
                  toast.error(t('No pudimos enviar el comprobante. Intenta de nuevo.'));
                } finally {
                  setWorking(false);
                }
              }}
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}
