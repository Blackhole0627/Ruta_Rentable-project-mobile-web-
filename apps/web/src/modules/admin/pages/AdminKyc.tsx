import { useEffect, useState } from 'react';
import { getBackend } from '@/core/backend';
import type {
  AdminKycRow,
  KycDocumentKey,
  KycStatus,
} from '@shared/types/kyc.types';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Select } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Dialog } from '@/shared/components/ui/dialog';
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton';
import { formatDate } from '@/shared/utils/formatters';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';

const backend = getBackend();

const DOC_LABELS: Record<KycDocumentKey, string> = {
  idFront: 'Cédula (frente)',
  idBack: 'Cédula (reverso)',
  driverLicense: 'Licencia de conducir',
  proofOfAddress: 'Comprobante de domicilio',
  selfie: 'Selfie',
  articlesOfIncorporation: 'Acta constitutiva',
  legalRepId: 'ID del representante legal',
};

const STATUS_BADGE: Record<KycStatus, { variant: 'profitable' | 'danger' | 'default'; label: string }> = {
  none: { variant: 'default', label: 'Sin enviar' },
  submitted: { variant: 'default', label: 'En revisión' },
  verified: { variant: 'profitable', label: 'Verificado' },
  rejected: { variant: 'danger', label: 'Rechazado' },
};

/** Is this document ref a PDF (vs an image)? Works for both storage paths and
 * inline data URLs. */
function isPdf(ref: string): boolean {
  return /\.pdf($|\?)/i.test(ref) || ref.startsWith('data:application/pdf');
}

export function AdminKyc() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminKycRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [active, setActive] = useState<AdminKycRow | null>(null);
  const [docUrls, setDocUrls] = useState<Partial<Record<KycDocumentKey, string>>>({});
  const [zoom, setZoom] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => backend.adminListKyc().then(setRows);

  useEffect(() => {
    reload();
  }, []);

  // Resolve document refs to viewable (signed) URLs when a submission opens.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const entries = Object.entries(active.documents) as [KycDocumentKey, string][];
      const resolved: Partial<Record<KycDocumentKey, string>> = {};
      for (const [key, ref] of entries) {
        try {
          resolved[key] = await backend.getKycDocumentUrl(ref);
        } catch {
          /* skip unreadable doc */
        }
      }
      if (!cancelled) setDocUrls(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const openDetail = (row: AdminKycRow) => {
    setDocUrls({}); // drop the previous applicant's docs while new ones resolve
    setActive(row);
  };

  const closeDetail = () => {
    setActive(null);
    setDocUrls({});
    setRejecting(false);
    setReason('');
  };

  const review = async (approve: boolean) => {
    if (!active) return;
    if (!approve && !reason.trim()) {
      toast.error(t('Indica el motivo del rechazo.'));
      return;
    }
    setBusy(true);
    try {
      await backend.adminReviewKyc(active.id, approve, reason.trim() || undefined);
      await reload();
      closeDetail();
      toast.success(approve ? t('Verificación aprobada') : t('Verificación rechazada'));
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <LoadingSkeleton variant="table" />;

  const pending = rows.filter((r) => r.status === 'submitted');
  const filtered =
    statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-road-900">{t('Verificación KYC')}</h1>
          <p className="text-sm text-road-500">
            {t('{n} pendientes de revisión', { n: pending.length })}
          </p>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="all">{t('Todos los estados')}</option>
          <option value="submitted">{t('En revisión')}</option>
          <option value="verified">{t('Verificado')}</option>
          <option value="rejected">{t('Rechazado')}</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-road-200 bg-white py-12 text-center text-road-400">
          {t('Sin solicitudes todavía')}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const badge = STATUS_BADGE[r.status];
            return (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-xl border border-road-200 bg-white p-3 sm:flex-row sm:items-center"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  <AppIcons.shieldCheck size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-road-900">
                    {r.userName || r.userEmail || t('Conductor')}
                  </p>
                  <p className="truncate text-xs text-road-500">{r.userEmail}</p>
                  <p className="mt-0.5 text-xs text-road-400">
                    {t(r.subjectType === 'company' ? 'Empresa' : 'Persona individual')} ·{' '}
                    {formatDate(new Date(r.submittedAt))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={badge.variant}>{t(badge.label)}</Badge>
                  <Button variant="outline" onClick={() => openDetail(r)}>
                    {t('Revisar')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail / review */}
      <Dialog
        open={!!active}
        onClose={closeDetail}
        title={t('Solicitud de verificación')}
      >
        {active && (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-road-900">
                {active.userName || active.userEmail || t('Conductor')}
              </p>
              <p className="text-xs text-road-500">{active.userEmail}</p>
            </div>

            {/* Personal data */}
            {active.personal && (
              <section className="space-y-1 rounded-lg border border-road-200 p-3 text-sm">
                <h4 className="mb-1 font-semibold text-road-800">{t('Datos personales')}</h4>
                <Field label={t('Nombre completo')} value={active.personal.fullName} />
                <Field label={t('Fecha de nacimiento')} value={active.personal.dateOfBirth} />
                <Field label={t('Nacionalidad')} value={active.personal.nationality} />
                <Field label={t('Número de cédula')} value={active.personal.idNumber} />
                <Field label={t('Dirección de domicilio')} value={active.personal.homeAddress} />
                <Field label={t('Ocupación')} value={active.personal.occupation} />
              </section>
            )}

            {/* Risk questionnaire */}
            <section className="space-y-1 rounded-lg border border-road-200 p-3 text-sm">
              <h4 className="mb-1 font-semibold text-road-800">{t('Cuestionario de riesgo')}</h4>
              <Field label={t('Actividad económica')} value={active.risk.economicActivity} />
              <Field label={t('Origen de los fondos')} value={active.risk.sourceOfFunds} />
              <Field label={t('Volumen mensual estimado')} value={active.risk.expectedMonthlyVolume} />
              <Field label={t('PEP')} value={active.risk.isPep ? t('Sí') : t('No')} />
            </section>

            {/* Documents */}
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-road-800">{t('Documentos')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(active.documents) as [KycDocumentKey, string][]).map(
                  ([key, ref]) => {
                    const url = docUrls[key];
                    const pdf = isPdf(ref);
                    return (
                      <div key={key} className="rounded-lg border border-road-200 p-2">
                        <p className="mb-1 text-[11px] font-medium text-road-600">
                          {t(DOC_LABELS[key] ?? key)}
                        </p>
                        {!url ? (
                          <div className="flex h-20 items-center justify-center text-road-300">
                            <AppIcons.spinner size={18} className="animate-spin" />
                          </div>
                        ) : pdf ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-20 flex-col items-center justify-center gap-1 text-xs text-brand-600"
                          >
                            <AppIcons.pdf size={24} />
                            {t('Abrir PDF')}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setZoom(url)}
                            className="block h-20 w-full overflow-hidden rounded"
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </section>

            {/* Actions */}
            {active.status === 'submitted' ? (
              rejecting ? (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    placeholder={t('Motivo del rechazo')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => setRejecting(false)}
                    >
                      {t('Cancelar')}
                    </Button>
                    <Button
                      className="flex-1 bg-danger-500 hover:bg-danger-600"
                      disabled={busy}
                      onClick={() => review(false)}
                    >
                      {t('Confirmar rechazo')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-danger-500"
                    disabled={busy}
                    onClick={() => setRejecting(true)}
                  >
                    {t('Rechazar')}
                  </Button>
                  <Button className="flex-1" disabled={busy} onClick={() => review(true)}>
                    <AppIcons.check size={16} /> {t('Aprobar')}
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-1">
                <Badge variant={STATUS_BADGE[active.status].variant}>
                  {t(STATUS_BADGE[active.status].label)}
                </Badge>
                {active.status === 'rejected' && active.rejectionReason && (
                  <p className="text-xs text-danger-600">
                    {t('Motivo: {reason}', { reason: active.rejectionReason })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Image zoom — must sit above the detail Dialog (z-[100]). */}
      {zoom && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-road-900/90 p-4"
          onClick={() => setZoom(null)}
          role="presentation"
        >
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-road-500">{label}</span>
      <span className="text-right font-medium text-road-900">{value || '—'}</span>
    </div>
  );
}
