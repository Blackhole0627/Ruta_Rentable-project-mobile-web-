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
    <div className="min-h-screen bg-road-50 pb-24 pt-safe">
      {isMain && <TopNav />}
      {!isMain && (
        <header className="sticky top-0 z-40 flex items-center gap-1 border-b border-road-100 bg-white/95 px-2 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('Volver')}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-road-700 hover:bg-road-100"
          >
            <AppIcons.chevronLeft size={24} />
          </button>
          <span className="text-sm font-medium text-road-500">{t('Volver')}</span>
        </header>
      )}

      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
          <AppIcons.offline {...iconPropsSm} />
          {t('Sin conexión — puedes seguir calculando')}
        </div>
      )}
      <main className="mx-auto max-w-lg px-4 py-4">
        <Outlet />
      </main>
      <TrackingBanner />
      <BottomNav />
    </div>
  );
}
