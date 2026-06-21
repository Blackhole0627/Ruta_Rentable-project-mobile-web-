import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { TopNav } from './TopNav';
import { TrackingBanner } from '../TrackingBanner';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { AppIcons, iconPropsSm } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

/** Tabs reachable from the bottom nav — these don't show a back arrow. */
const MAIN_TABS = ['/', '/historial', '/reportes', '/vehiculo', '/ajustes'];

export function MobileLayout() {
  const isOnline = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isMain = MAIN_TABS.includes(location.pathname);

  return (
    <div className="min-h-screen pb-24 pt-safe">
      {isMain && <TopNav />}
      {!isMain && (
        <header className="glass sticky top-0 z-40 flex items-center gap-2 border-b border-road-100/80 px-2 py-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('Volver')}
            className="press flex h-10 w-10 items-center justify-center rounded-full text-road-700 hover:bg-road-100 active:bg-road-200"
          >
            <AppIcons.chevronLeft size={24} />
          </button>
          <span className="text-[15px] font-semibold text-road-700">{t('Volver')}</span>
        </header>
      )}

      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
          <AppIcons.offline {...iconPropsSm} />
          {t('Sin conexión — puedes seguir calculando')}
        </div>
      )}
      <main className="mx-auto max-w-lg px-3 py-3">
        <Outlet />
      </main>
      <TrackingBanner />
      <BottomNav />
    </div>
  );
}
