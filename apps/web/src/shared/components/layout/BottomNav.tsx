import { NavLink, useLocation } from 'react-router-dom';
import { AppIcons, iconProps } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';

const links = [
  { to: '/', label: 'Calcular', icon: AppIcons.calculator, end: true },
  { to: '/historial', label: 'Historial', icon: AppIcons.history, end: false },
  { to: '/reportes', label: 'Reportes', icon: AppIcons.reports, end: false },
  { to: '/vehiculo', label: 'Vehículo', icon: AppIcons.vehicle, end: false },
  { to: '/ajustes', label: 'Ajustes', icon: AppIcons.settings, end: false },
] as const;

export function BottomNav() {
  const location = useLocation();
  const { t } = useI18n();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
      aria-label="Navegación principal"
    >
      <div className="mx-auto max-w-lg px-2">
        <div
          className={cn(
            'flex items-stretch justify-around gap-0.5 rounded-2xl px-1 py-1.5',
            'bg-white/95 shadow-[0_-2px_16px_rgba(15,23,42,0.08),0_4px_24px_rgba(15,23,42,0.06)]',
            'ring-1 ring-road-200/60 backdrop-blur-md',
          )}
        >
          {links.map(({ to, label, icon: Icon, end }) => {
            const isActive = end
              ? location.pathname === '/'
              : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="relative flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center"
              >
                <span
                  className={cn(
                    'absolute inset-x-1 top-1 bottom-1 rounded-2xl transition-all duration-200 ease-out',
                    isActive
                      ? 'bg-brand-500/12 scale-100 opacity-100'
                      : 'scale-90 opacity-0',
                  )}
                />
                <span
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 px-2 py-1',
                    isActive ? 'text-brand-700' : 'text-road-500',
                  )}
                >
                  <Icon
                    {...iconProps}
                    className={cn(
                      'transition-all duration-200',
                      isActive && 'text-brand-600 scale-105',
                    )}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-tight tracking-wide',
                      isActive && 'font-semibold text-brand-800',
                    )}
                  >
                    {t(label)}
                  </span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
      <div className="h-2 bg-gradient-to-t from-road-50/80 to-transparent" />
    </nav>
  );
}
