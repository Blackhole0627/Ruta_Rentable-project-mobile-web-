import type { TripStatus } from '@shared/financial-model/profitability';
import { Badge } from './ui/badge';
import { useI18n } from '@/core/i18n/i18n';

const labels: Record<TripStatus, string> = {
  profitable: 'Rentable',
  acceptable: 'Aceptable',
  not_profitable: 'No rentable',
};

const variants: Record<TripStatus, 'profitable' | 'acceptable' | 'danger'> = {
  profitable: 'profitable',
  acceptable: 'acceptable',
  not_profitable: 'danger',
};

export function StatusBadge({ status }: { status: TripStatus }) {
  const { t } = useI18n();
  return <Badge variant={variants[status]}>{t(labels[status])}</Badge>;
}
