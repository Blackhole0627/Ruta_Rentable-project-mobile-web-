import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DriverRoutes } from './routes/DriverRoutes';
import { useUserStore } from './core/store/useUserStore';
import { useVehicleStore } from './core/store/useVehicleStore';
import { useSettingsStore } from './core/store/useSettingsStore';
import { useAuthStore } from './core/store/useAuthStore';
import { useSyncStore } from './core/store/useSyncStore';
import { useOnlineStatus } from './shared/hooks/useOnlineStatus';
import { runMigrations } from './core/db/migrations';
import { LoadingSpinner } from './shared/components/LoadingSpinner';
import { NativeBridge } from './shared/components/NativeBridge';

// Admin panel is desktop-only and chart-heavy — load it on demand so the
// driver bundle stays lean.
const AdminRoutes = lazy(() =>
  import('./routes/AdminRoutes').then((m) => ({ default: m.AdminRoutes })),
);

export default function App() {
  const { loadUser, isLoading: userLoading } = useUserStore();
  const { loadVehicles } = useVehicleStore();
  const { loadSettings } = useSettingsStore();
  const { init, status } = useAuthStore();
  const { sync } = useSyncStore();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    runMigrations().then(async () => {
      await Promise.all([loadUser(), loadVehicles(), loadSettings()]);
      await init();
    });
  }, [loadUser, loadVehicles, loadSettings, init]);

  // Re-sync automatically when connectivity is restored.
  useEffect(() => {
    if (isOnline && status === 'authenticated') sync();
  }, [isOnline, status, sync]);

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <NativeBridge />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <LoadingSpinner />
          </div>
        }
      >
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="/*" element={<DriverRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
