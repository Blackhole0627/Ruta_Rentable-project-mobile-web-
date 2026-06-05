import type { TripStatus } from '@shared/financial-model/profitability';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';

const config: Record<
  TripStatus,
  { label: string; bg: string; ring: string; emoji: string }
> = {
  profitable: {
    label: 'Rentable',
    bg: 'bg-brand-500',
    ring: 'ring-brand-300',
    emoji: '🟢',
  },
  acceptable: {
    label: 'Aceptable',
    bg: 'bg-amber-500',
    ring: 'ring-amber-300',
    emoji: '🟡',
  },
  not_profitable: {
    label: 'No rentable',
    bg: 'bg-danger-500',
    ring: 'ring-red-300',
    emoji: '🔴',
  },
};

export function TrafficLight({ status }: { status: TripStatus }) {
  const { t } = useI18n();
  const c = config[status];
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl p-6 text-white shadow-lg ring-4',
        c.bg,
        c.ring,
      )}
    >
      <span className="text-4xl">{c.emoji}</span>
      <span className="mt-2 text-2xl font-bold">{t(c.label)}</span>
    </div>
  );
}
