import type { TripStatus } from '@shared/financial-model/profitability';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { AppIcons } from '@/shared/constants/icons';

const config: Record<
  TripStatus,
  { label: string; sub: string; grad: string; glow: string; icon: LucideIcon }
> = {
  profitable: {
    label: 'Rentable',
    sub: 'Buen viaje, acéptalo',
    grad: 'from-brand-500 to-brand-700',
    glow: 'shadow-[0_16px_40px_-12px_rgba(5,150,105,0.55)]',
    icon: AppIcons.success,
  },
  acceptable: {
    label: 'Aceptable',
    sub: 'Margen justo, tú decides',
    grad: 'from-amber-400 to-amber-600',
    glow: 'shadow-[0_16px_40px_-12px_rgba(217,119,6,0.5)]',
    icon: AppIcons.alert,
  },
  not_profitable: {
    label: 'No rentable',
    sub: 'Mejor recházalo',
    grad: 'from-danger-500 to-danger-700',
    glow: 'shadow-[0_16px_40px_-12px_rgba(225,29,72,0.5)]',
    icon: AppIcons.close,
  },
};

export function TrafficLight({ status }: { status: TripStatus }) {
  const { t } = useI18n();
  const c = config[status];
  const Icon = c.icon;
  return (
    <div
      className={cn(
        'animate-slide-up-in relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white',
        c.grad,
        c.glow,
      )}
    >
      {/* Soft sheen for depth. */}
      <span className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
        <Icon size={26} strokeWidth={2.4} className="text-white" />
      </span>
      <span className="relative min-w-0">
        <span className="block text-xl font-extrabold leading-tight tracking-tight">
          {t(c.label)}
        </span>
        <span className="block text-xs font-medium text-white/85">{t(c.sub)}</span>
      </span>
    </div>
  );
}
