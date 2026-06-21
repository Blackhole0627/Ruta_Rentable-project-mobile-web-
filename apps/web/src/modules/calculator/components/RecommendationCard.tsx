import type { TripStatus } from '@shared/financial-model/profitability';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { AppIcons } from '@/shared/constants/icons';

const messages: Record<
  TripStatus,
  { text: string; icon: LucideIcon; wrap: string; chip: string; body: string }
> = {
  profitable: {
    icon: AppIcons.success,
    text: 'Viaje rentable. Puedes aceptar.',
    wrap: 'bg-brand-50 ring-brand-100',
    chip: 'bg-white text-brand-600 ring-brand-100',
    body: 'text-brand-800',
  },
  acceptable: {
    icon: AppIcons.alert,
    text: 'Margen bajo. Negocia o acepta si necesitas.',
    wrap: 'bg-amber-50 ring-amber-100',
    chip: 'bg-white text-amber-600 ring-amber-100',
    body: 'text-amber-800',
  },
  not_profitable: {
    icon: AppIcons.close,
    text: 'Viaje no rentable. Rechaza o contraoferta.',
    wrap: 'bg-danger-50 ring-danger-100',
    chip: 'bg-white text-danger-600 ring-danger-100',
    body: 'text-danger-700',
  },
};

export function RecommendationCard({ status }: { status: TripStatus }) {
  const { t } = useI18n();
  const m = messages[status];
  const Icon = m.icon;
  return (
    <div className={cn('flex items-center gap-2 rounded-2xl p-3 ring-1', m.wrap)}>
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-card ring-1',
          m.chip,
        )}
      >
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <p className={cn('text-sm font-semibold', m.body)}>{t(m.text)}</p>
    </div>
  );
}
