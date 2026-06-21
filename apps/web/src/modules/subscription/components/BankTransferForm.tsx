import { useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { BANK_DETAILS } from '../bankDetails';
import { fileToCompressedDataUrl } from '@/shared/utils/image';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';
import { toast } from '@/core/store/useToastStore';

interface BankTransferFormProps {
  amount: number;
  currency: 'NIO' | 'USD';
  disabled?: boolean;
  onSubmit: (receiptUrl: string) => Promise<void>;
}

export function BankTransferForm({ amount, currency, disabled, onSubmit }: BankTransferFormProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(t('Copiado'));
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(t('No se pudo copiar'));
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await fileToCompressedDataUrl(file);
      setReceiptUrl(url);
    } catch {
      toast.error(t('No se pudo leer el archivo.'));
    }
  };

  const rows = [
    { label: t('Banco'), value: BANK_DETAILS.bank },
    { label: t('Titular'), value: BANK_DETAILS.holder },
    { label: t('Tipo de cuenta'), value: BANK_DETAILS.accountType },
    { label: 'IBAN', value: BANK_DETAILS.iban },
    { label: t('Monto'), value: `${amount} ${currency}` },
  ];

  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl bg-white p-3 text-sm shadow-card ring-1 ring-road-100">
        <p className="mb-2.5 flex items-center gap-2 font-bold text-road-900">
          <AppIcons.billing size={18} className="text-brand-600" />
          {t('Transfiere a esta cuenta')}
        </p>
        <dl className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2 border-t border-road-100 pt-2 first:border-t-0 first:pt-0"
            >
              <dt className="text-road-500">{row.label}</dt>
              <dd className="flex items-center gap-2 text-right font-semibold text-road-900">
                <span className="tabular truncate">{row.value}</span>
                {row.label !== t('Monto') && (
                  <button
                    type="button"
                    className="press inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200"
                    onClick={() => copy(row.label, row.value)}
                  >
                    {copied === row.label ? (
                      <AppIcons.check size={13} />
                    ) : (
                      <AppIcons.copy size={13} />
                    )}
                    {copied === row.label ? t('Copiado') : t('Copiar')}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-road-900">{t('Sube tu comprobante')}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="press flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-road-200 bg-road-50 p-4 text-sm text-road-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
        >
          {receiptUrl ? (
            <>
              <img
                src={receiptUrl}
                alt={t('Comprobante')}
                className="max-h-32 rounded-xl shadow-card"
              />
              <span className="font-semibold text-brand-600">{t('Cambiar imagen')}</span>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card ring-1 ring-road-100">
                <AppIcons.upload size={24} />
              </span>
              <span className="font-medium">{t('Toca para subir foto/captura')}</span>
            </>
          )}
        </button>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={disabled || working || !receiptUrl}
        onClick={async () => {
          if (!receiptUrl) return;
          setWorking(true);
          try {
            await onSubmit(receiptUrl);
            setReceiptUrl(null);
          } finally {
            setWorking(false);
          }
        }}
      >
        {working ? t('Procesando…') : t('Enviar para revisión')}
      </Button>
      <p className="text-center text-xs text-road-400">
        {t('El administrador revisará tu pago y activará tu cuenta.')}
      </p>
    </div>
  );
}
