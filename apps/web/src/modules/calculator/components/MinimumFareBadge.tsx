import { formatCurrency } from '@/shared/utils/currency';
import type { Currency } from '@shared/types/user.types';
import { useI18n } from '@/core/i18n/i18n';

export function MinimumFareBadge({
  minimumFare,
  currency,
}: {
  minimumFare: number;
  currency: Currency;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg bg-road-900 px-4 py-3 text-center text-white">
      <p className="text-xs text-road-300">{t('Acepta al menos')}</p>
      <p className="text-2xl font-bold">{formatCurrency(minimumFare, currency)}</p>
    </div>
  );
}
