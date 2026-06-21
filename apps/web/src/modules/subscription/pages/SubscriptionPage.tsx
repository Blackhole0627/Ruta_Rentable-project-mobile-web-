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
      <div className="space-y-3">
        <header>
          <h1 className="text-lg font-extrabold tracking-tight text-road-900">
            {t('Suscripción')}
          </h1>
        </header>
        <Card className="ring-1 ring-road-100">
          <CardContent className="flex flex-col items-center gap-2.5 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-grad text-gold-900 shadow-sm">
              <AppIcons.crown size={24} />
            </span>
            <p className="text-sm text-road-500">
              {t('Inicia sesión para gestionar tu suscripción.')}
            </p>
            <Button className="w-full" onClick={() => navigate('/entrar')}>
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
    active: 'bg-brand-50 text-brand-800 ring-brand-200',
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    rejected: 'bg-danger-50 text-danger-700 ring-danger-100',
    overdue: 'bg-danger-50 text-danger-700 ring-danger-100',
    kyc: 'bg-amber-50 text-amber-800 ring-amber-200',
  };

  const bannerIcons: Record<string, typeof AppIcons.clock> = {
    active: AppIcons.success,
    pending: AppIcons.clock,
    rejected: AppIcons.alert,
    overdue: AppIcons.alert,
    kyc: AppIcons.shieldCheck,
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
    <div className="space-y-3">
      <header>
        <h1 className="text-lg font-extrabold tracking-tight text-road-900">
          {t('Suscripción')}
        </h1>
        <p className="mt-0.5 text-xs text-road-500">
          {t('Mejora tu plan para guardar viajes ilimitados y sincronizarlos en la nube.')}
        </p>
      </header>

      {banner && (
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium shadow-card ring-1',
            bannerStyles[banner.variant],
          )}
        >
          {(() => {
            const Icon = bannerIcons[banner.variant];
            return <Icon size={18} className="shrink-0" />;
          })()}
          {banner.text}
        </div>
      )}

      {showKyc && <KycSection />}

      <div className="space-y-2">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPaid = (plan.priceNio ?? 0) > 0;
          return (
            <Card
              key={plan.id}
              className={cn(
                'animate-slide-up-in overflow-hidden ring-1',
                isCurrent
                  ? 'ring-2 ring-brand-500 ring-road-100'
                  : isPaid
                    ? 'ring-gold-200'
                    : 'ring-road-100',
              )}
            >
              {isPaid && (
                <div className="flex items-center gap-1.5 bg-gold-grad px-3.5 py-1 text-xs font-bold text-gold-900">
                  <AppIcons.crown size={14} />
                  {t('Premium')}
                </div>
              )}
              <CardContent className="space-y-2 p-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold tracking-tight text-road-900">
                      {plan.name}
                    </h3>
                    {isCurrent && (
                      <Badge variant="profitable" className="mt-1">
                        {t('Plan actual')}
                      </Badge>
                    )}
                  </div>
                  {isPaid && (
                    <span className="shrink-0 text-right">
                      <span className="tabular text-xl font-extrabold tracking-tight text-road-900">
                        {formatCurrency(plan.priceNio ?? 0, currency, { compact: true })}
                      </span>
                      <span className="text-xs font-medium text-road-500">{t('/mes')}</span>
                    </span>
                  )}
                </div>
                <ul className="space-y-1 text-sm text-road-600">
                  {(plan.features ?? []).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <AppIcons.check size={16} className="shrink-0 text-brand-600" /> {f}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <AppIcons.check size={16} className="shrink-0 text-brand-600" />
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
                ) : !isCurrent && isPaid ? (
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
        <Card className="ring-1 ring-road-100">
          <CardContent className="p-3.5">
            <h3 className="mb-2.5 flex items-center gap-2 text-base font-bold text-road-900">
              <AppIcons.billing {...iconPropsSm} className="text-brand-600" />{' '}
              {t('Historial de pagos')}
            </h3>
            <ul className="divide-y divide-road-100 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span>
                    <span className="tabular block font-bold tracking-tight text-road-900">
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
        <div className="space-y-2.5">
          <div className="rounded-2xl bg-gradient-to-br from-gold-50 to-gold-100 px-3.5 py-3 text-center ring-1 ring-gold-200">
            <span className="tabular text-2xl font-extrabold tracking-tight text-gold-900">
              {formatCurrency(selectedPlan?.priceNio ?? 0, currency, { compact: true })}
            </span>
            <span className="text-sm font-medium text-gold-800"> {t('/mes')}</span>
          </div>

          {!kycVerified && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
              <AppIcons.shieldCheck size={18} className="mt-0.5 shrink-0" />
              <p>
                {t(
                  'Tras el pago deberás verificar tu identidad (KYC). Tu plan se activa cuando un administrador la apruebe.',
                )}
              </p>
            </div>
          )}

          <div className="flex gap-1 rounded-xl bg-road-100 p-1 text-sm">
            <button
              type="button"
              className={cn(
                'press min-h-[40px] flex-1 rounded-lg py-2 font-semibold transition-all',
                payMethod === 'card'
                  ? 'bg-white text-road-900 shadow-card'
                  : 'text-road-500',
              )}
              onClick={() => setPayMethod('card')}
            >
              {t('Pagar con tarjeta')}
            </button>
            <button
              type="button"
              className={cn(
                'press min-h-[40px] flex-1 rounded-lg py-2 font-semibold transition-all',
                payMethod === 'transfer'
                  ? 'bg-white text-road-900 shadow-card'
                  : 'text-road-500',
              )}
              onClick={() => setPayMethod('transfer')}
            >
              {t('Transferencia bancaria')}
            </button>
          </div>

          {payMethod === 'card' ? (
            <>
              <div className="flex items-start gap-2.5 rounded-2xl bg-white p-3 text-sm text-road-600 shadow-card ring-1 ring-road-100">
                <AppIcons.billing size={20} className="mt-0.5 shrink-0 text-brand-600" />
                <p>
                  {t(
                    'Paga de forma segura con tarjeta de crédito o débito. Tu suscripción se activa automáticamente al confirmar el pago.',
                  )}
                </p>
              </div>
              <Button className="w-full" size="lg" onClick={handlePay} disabled={working}>
                {working ? t('Redirigiendo…') : t('Pagar con tarjeta')}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-road-400">
                <AppIcons.lock size={13} className="shrink-0" />
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
