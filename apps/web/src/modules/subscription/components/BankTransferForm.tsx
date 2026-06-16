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
    <div className="space-y-4">
      <div className="rounded-lg border border-road-200 bg-road-50 p-3 text-sm">
        <p className="mb-2 font-semibold text-road-800">{t('Transfiere a esta cuenta')}</p>
        <dl className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-2">
              <dt className="text-road-500">{row.label}</dt>
              <dd className="flex items-center gap-1 text-right font-medium text-road-900">
                {row.value}
                {row.label !== t('Monto') && (
                  <button
                    type="button"
                    className="text-brand-600 hover:underline"
                    onClick={() => copy(row.label, row.value)}
                  >
                    {copied === row.label ? t('Copiado') : t('Copiar')}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-road-800">{t('Sube tu comprobante')}</p>
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
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-road-300 bg-white p-6 text-sm text-road-500 hover:border-brand-400"
        >
          {receiptUrl ? (
            <>
              <img src={receiptUrl} alt={t('Comprobante')} className="max-h-32 rounded-lg" />
              <span className="text-brand-600">{t('Cambiar imagen')}</span>
            </>
          ) : (
            <>
              <AppIcons.upload size={28} className="text-road-400" />
              {t('Toca para subir foto/captura')}
            </>
          )}
        </button>
      </div>

      <Button
        className="w-full"
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
