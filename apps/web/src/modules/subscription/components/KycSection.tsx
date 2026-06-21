import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Dialog } from '@/shared/components/ui/dialog';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import { useKycStore } from '@/core/store/useKycStore';
import { useUserStore } from '@/core/store/useUserStore';
import { KycForm } from './KycForm';
import type { KycStatus } from '@shared/types/kyc.types';
import type { LucideIcon } from 'lucide-react';

/**
 * Driver-facing KYC block shown in the subscription section. Renders the
 * current verification state and lets the driver submit (or re-submit after a
 * rejection) their identity documents. A paid plan only activates once an admin
 * approves this.
 */
export function KycSection() {
  const { t } = useI18n();
  const user = useUserStore((s) => s.user);
  const { submission, load, submit } = useKycStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  // Prefer the live submission status; fall back to the profile flag.
  const status: KycStatus = submission?.status ?? user?.kycStatus ?? 'none';

  const styles: Record<KycStatus, string> = {
    none: 'ring-amber-200 bg-amber-50 text-amber-800',
    submitted: 'ring-amber-200 bg-amber-50 text-amber-800',
    verified: 'ring-brand-200 bg-brand-50 text-brand-800',
    rejected: 'ring-danger-100 bg-danger-50 text-danger-700',
  };

  const meta: Record<KycStatus, { icon: LucideIcon; title: string; body: string }> = {
    none: {
      icon: AppIcons.shieldCheck,
      title: t('Verificación de identidad requerida'),
      body: t('Antes de activar un plan de pago debes verificar tu identidad (KYC).'),
    },
    submitted: {
      icon: AppIcons.clock,
      title: t('Verificación en revisión'),
      body: t('Recibimos tus documentos. Un administrador los está revisando.'),
    },
    verified: {
      icon: AppIcons.success,
      title: t('Identidad verificada'),
      body: t('Tu identidad está verificada. Tu plan de pago puede activarse.'),
    },
    rejected: {
      icon: AppIcons.alert,
      title: t('Verificación rechazada'),
      body: submission?.rejectionReason
        ? t('Motivo: {reason}', { reason: submission.rejectionReason })
        : t('No pudimos verificar tu identidad. Corrige tus datos y vuelve a enviar.'),
    },
  };

  const m = meta[status];
  const Icon = m.icon;
  const canSubmit = status === 'none' || status === 'rejected';

  const onSubmit = async (
    ...args: Parameters<ReturnType<typeof useKycStore.getState>['submit']>
  ) => {
    try {
      await submit(...args);
      setOpen(false);
      toast.success(t('Verificación enviada. Te avisaremos cuando esté lista.'));
    } catch {
      toast.error(t('No pudimos enviar tu verificación. Intenta de nuevo.'));
    }
  };

  return (
    <Card className="ring-1 ring-road-100">
      <CardContent className="space-y-2 p-3.5">
        <h3 className="flex items-center gap-2 text-base font-bold text-road-900">
          <AppIcons.shieldCheck size={18} className="text-brand-600" />
          {t('Verificación de identidad (KYC)')}
        </h3>
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm ring-1',
            styles[status],
          )}
        >
          <Icon size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{m.title}</p>
            <p className="text-xs opacity-90">{m.body}</p>
          </div>
        </div>
        {canSubmit && (
          <Button className="w-full" onClick={() => setOpen(true)}>
            {status === 'rejected' ? t('Reenviar verificación') : t('Verificar mi identidad')}
          </Button>
        )}
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title={t('Verificación de identidad (KYC)')}>
        <KycForm onSubmit={onSubmit} />
      </Dialog>
    </Card>
  );
}
