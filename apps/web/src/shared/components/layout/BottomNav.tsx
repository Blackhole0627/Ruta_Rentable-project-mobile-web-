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
      <div className="mx-auto max-w-lg px-3">
        <div
          className={cn(
            'glass flex items-stretch justify-around gap-0.5 rounded-[1.25rem] px-1.5 py-1',
            'shadow-nav ring-1 ring-road-200/60',
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
                className="press relative flex min-h-[50px] min-w-[56px] flex-1 flex-col items-center justify-center"
              >
                {/* Active pill — soft emerald wash behind the icon. */}
                <span
                  className={cn(
                    'absolute inset-x-1 top-1 bottom-1 rounded-2xl bg-gradient-to-b from-brand-500/15 to-brand-600/10 ring-1 ring-brand-500/15 transition-all duration-200 ease-out',
                    isActive ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
                  )}
                />
                {/* Active indicator dot above the tab. */}
                <span
                  className={cn(
                    'absolute top-0.5 h-1 w-1 rounded-full bg-brand-500 transition-all duration-200',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 px-2 py-0.5 transition-colors',
                    isActive ? 'text-brand-700' : 'text-road-400',
                  )}
                >
                  <Icon
                    {...iconProps}
                    className={cn(
                      'transition-all duration-200',
                      isActive && 'text-brand-600 scale-110',
                    )}
                    strokeWidth={isActive ? 2.4 : 1.75}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-tight tracking-wide',
                      isActive && 'font-bold text-brand-800',
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
      <div className="h-2" />
    </nav>
  );
}
