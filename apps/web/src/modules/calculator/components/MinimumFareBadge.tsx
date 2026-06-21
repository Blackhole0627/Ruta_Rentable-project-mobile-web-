import { formatCurrency } from '@/shared/utils/currency';
import type { Currency } from '@shared/types/user.types';
import { AppIcons } from '@/shared/constants/icons';
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
    <div className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-road-800 to-road-900 px-3.5 py-3 text-white shadow-card">
      <span className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-gold-400/10 blur-2xl" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
          <AppIcons.calculator size={18} className="text-gold-300" />
        </span>
        <p className="text-xs font-medium text-road-300">{t('Acepta al menos')}</p>
      </div>
      <p className="tabular relative text-xl font-extrabold tracking-tight">
        {formatCurrency(minimumFare, currency)}
      </p>
    </div>
  );
}
