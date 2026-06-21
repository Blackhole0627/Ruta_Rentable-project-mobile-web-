import { useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import { DatePicker } from '@/shared/components/ui/datepicker';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';
import type {
  KycDocumentKey,
  KycPersonalData,
  KycRiskAnswers,
  KycSubmissionInput,
  KycFileUpload,
} from '@shared/types/kyc.types';

interface KycFormProps {
  disabled?: boolean;
  onSubmit: (input: KycSubmissionInput, files: KycFileUpload[]) => Promise<void>;
}

const ACCEPT = 'image/*,application/pdf';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

/** Document slots for an individual. `selfie` is optional. */
const DOC_SLOTS: { key: KycDocumentKey; label: string; optional?: boolean }[] = [
  { key: 'idFront', label: 'Cédula (frente)' },
  { key: 'idBack', label: 'Cédula (reverso)' },
  { key: 'driverLicense', label: 'Licencia de conducir' },
  { key: 'proofOfAddress', label: 'Comprobante de domicilio' },
  { key: 'selfie', label: 'Selfie (opcional)', optional: true },
];

const emptyPersonal: KycPersonalData = {
  fullName: '',
  dateOfBirth: '',
  nationality: 'Nicaragüense',
  homeAddress: '',
  occupation: '',
  idNumber: '',
};

const emptyRisk: KycRiskAnswers = {
  economicActivity: '',
  sourceOfFunds: '',
  expectedMonthlyVolume: '',
  isPep: false,
};

/** A single document upload tile (image preview or PDF filename). */
function DocUpload({
  label,
  file,
  disabled,
  onPick,
}: {
  label: string;
  file: File | undefined;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const isImage = file?.type.startsWith('image/');
  const previewUrl = isImage && file ? URL.createObjectURL(file) : null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-road-800">{t(label)}</p>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className={cn(
          'press flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed p-3 text-center text-sm transition-colors disabled:opacity-50',
          file
            ? 'border-brand-300 bg-brand-50/40 text-road-500'
            : 'border-road-200 bg-road-50 text-road-500 hover:border-brand-400 hover:bg-brand-50/40',
        )}
      >
        {file ? (
          isImage && previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt={t(label)}
                className="max-h-28 rounded-xl shadow-card"
              />
              <span className="font-semibold text-brand-600">{t('Cambiar archivo')}</span>
            </>
          ) : (
            <>
              <AppIcons.pdf size={26} className="text-brand-600" />
              <span className="max-w-full truncate text-road-700">{file.name}</span>
              <span className="font-semibold text-brand-600">{t('Cambiar archivo')}</span>
            </>
          )
        ) : (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card ring-1 ring-road-100">
              <AppIcons.upload size={20} />
            </span>
            <span className="font-medium">{t('Subir foto o PDF')}</span>
          </>
        )}
      </button>
    </div>
  );
}

export function KycForm({ disabled, onSubmit }: KycFormProps) {
  const { t } = useI18n();
  const [personal, setPersonal] = useState<KycPersonalData>(emptyPersonal);
  const [risk, setRisk] = useState<KycRiskAnswers>(emptyRisk);
  const [files, setFiles] = useState<Partial<Record<KycDocumentKey, File>>>({});
  const [working, setWorking] = useState(false);

  const setP = (k: keyof KycPersonalData, v: string) =>
    setPersonal((prev) => ({ ...prev, [k]: v }));
  const setR = (k: keyof KycRiskAnswers, v: string | boolean) =>
    setRisk((prev) => ({ ...prev, [k]: v }));

  const pickFile = (key: KycDocumentKey, file: File | undefined) => {
    if (!file) {
      setFiles((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t('El archivo supera el tamaño máximo (8 MB).'));
      return;
    }
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const requiredDocsMissing = DOC_SLOTS.filter((s) => !s.optional).some((s) => !files[s.key]);
  const personalMissing =
    !personal.fullName.trim() ||
    !personal.dateOfBirth ||
    !personal.nationality.trim() ||
    !personal.homeAddress.trim() ||
    !personal.occupation.trim() ||
    !personal.idNumber.trim();
  const riskMissing =
    !risk.economicActivity.trim() ||
    !risk.sourceOfFunds.trim() ||
    !risk.expectedMonthlyVolume.trim();
  const canSubmit = !personalMissing && !riskMissing && !requiredDocsMissing;

  const submit = async () => {
    if (!canSubmit) {
      toast.error(t('Completa todos los campos obligatorios y los documentos.'));
      return;
    }
    const uploads: KycFileUpload[] = (Object.keys(files) as KycDocumentKey[])
      .filter((k) => files[k])
      .map((k) => ({ key: k, file: files[k] as File }));
    setWorking(true);
    try {
      await onSubmit({ subjectType: 'individual', personal, risk }, uploads);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2.5 rounded-2xl bg-brand-50 px-3.5 py-2.5 text-xs text-brand-800 ring-1 ring-brand-200">
        <AppIcons.shieldCheck size={18} className="mt-0.5 shrink-0" />
        {t(
          'Por regulación contra el lavado de dinero (UAF), verificamos tu identidad antes de activar un plan de pago. Tus documentos se guardan de forma privada y cifrada.',
        )}
      </p>

      {/* Subject type — individual only for now; company coming later. */}
      <div>
        <p className="mb-2 text-sm font-semibold text-road-900">{t('Tipo de solicitante')}</p>
        <div className="flex gap-1 rounded-xl bg-road-100 p-1 text-sm">
          <span className="min-h-[40px] flex-1 rounded-lg bg-white py-2 text-center font-semibold text-road-900 shadow-card">
            {t('Persona individual')}
          </span>
          <span
            className="min-h-[40px] flex-1 cursor-not-allowed rounded-lg py-2 text-center font-medium text-road-300"
            title={t('Próximamente')}
          >
            {t('Empresa')}
          </span>
        </div>
      </div>

      {/* Personal data */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-road-900">{t('Datos personales')}</h4>
        <div>
          <Label htmlFor="kyc-name">{t('Nombre completo')}</Label>
          <Input
            id="kyc-name"
            value={personal.fullName}
            disabled={disabled}
            onChange={(e) => setP('fullName', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="kyc-dob">{t('Fecha de nacimiento')}</Label>
            <div className="mt-1">
              <DatePicker
                value={personal.dateOfBirth}
                placeholder={t('Selecciona una fecha')}
                onChange={(v) => setP('dateOfBirth', v)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="kyc-nat">{t('Nacionalidad')}</Label>
            <Input
              id="kyc-nat"
              value={personal.nationality}
              disabled={disabled}
              onChange={(e) => setP('nationality', e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="kyc-id">{t('Número de cédula')}</Label>
          <Input
            id="kyc-id"
            value={personal.idNumber}
            disabled={disabled}
            placeholder="001-000000-0000A"
            onChange={(e) => setP('idNumber', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="kyc-addr">{t('Dirección de domicilio')}</Label>
          <Textarea
            id="kyc-addr"
            value={personal.homeAddress}
            disabled={disabled}
            onChange={(e) => setP('homeAddress', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="kyc-occ">{t('Ocupación')}</Label>
          <Input
            id="kyc-occ"
            value={personal.occupation}
            disabled={disabled}
            onChange={(e) => setP('occupation', e.target.value)}
          />
        </div>
      </section>

      {/* Documents */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-road-900">{t('Documentos')}</h4>
        {DOC_SLOTS.map((slot) => (
          <DocUpload
            key={slot.key}
            label={slot.label}
            file={files[slot.key]}
            disabled={disabled}
            onPick={(f) => pickFile(slot.key, f)}
          />
        ))}
      </section>

      {/* Risk questionnaire */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-road-900">{t('Cuestionario de riesgo')}</h4>
        <div>
          <Label htmlFor="kyc-act">{t('Actividad económica')}</Label>
          <Input
            id="kyc-act"
            value={risk.economicActivity}
            disabled={disabled}
            placeholder={t('Ej. transporte de pasajeros')}
            onChange={(e) => setR('economicActivity', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="kyc-funds">{t('Origen de los fondos')}</Label>
          <Input
            id="kyc-funds"
            value={risk.sourceOfFunds}
            disabled={disabled}
            placeholder={t('Ej. ingresos por viajes')}
            onChange={(e) => setR('sourceOfFunds', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="kyc-vol">{t('Volumen mensual estimado')}</Label>
          <Input
            id="kyc-vol"
            value={risk.expectedMonthlyVolume}
            disabled={disabled}
            placeholder={t('Ej. C$ 20,000 - 40,000')}
            onChange={(e) => setR('expectedMonthlyVolume', e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 shadow-card ring-1 ring-road-100">
          <div className="pr-3">
            <p className="text-sm font-medium text-road-800">
              {t('¿Eres una Persona Expuesta Políticamente (PEP)?')}
            </p>
            <p className="text-xs text-road-500">
              {t('Cargos públicos o relación cercana con uno.')}
            </p>
          </div>
          <Switch
            checked={risk.isPep}
            onCheckedChange={(v) => setR('isPep', v)}
            label={t('PEP')}
          />
        </div>
      </section>

      <Button className="w-full" size="lg" disabled={disabled || working || !canSubmit} onClick={submit}>
        {working ? t('Enviando…') : t('Enviar para verificación')}
      </Button>
      <p className="text-center text-xs text-road-400">
        {t('Un administrador revisará tu información. Te avisaremos cuando esté lista.')}
      </p>
    </div>
  );
}
