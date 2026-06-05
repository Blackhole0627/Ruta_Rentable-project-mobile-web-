import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';
import { useAuthStore } from '@/core/store/useAuthStore';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useI18n } from '@/core/i18n/i18n';

export function AdminLayout() {
  const navigate = useNavigate();
  const { session, signOut } = useAuthStore();
  const { t, lang, setLang } = useI18n();
  const [collapsed, setCollapsed] = useState(false); // desktop collapse
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer

  return (
    <div className="flex h-screen overflow-hidden bg-road-50">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-road-900/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-road-900 transition-transform duration-200',
          'md:static md:z-auto md:translate-x-0 md:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'md:w-16' : 'md:w-60',
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500">
              <AppIcons.calculator size={18} />
            </span>
            {!collapsed && <span className="font-bold">RutaRentable</span>}
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="text-road-400 hover:text-white md:hidden"
            aria-label="Cerrar menú"
          >
            <AppIcons.close size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
        </div>
        <div className="hidden p-2 md:block">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-road-400 hover:bg-road-800 hover:text-white"
            aria-label="Contraer menú"
          >
            <AppIcons.menu size={18} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-road-200 bg-white px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-road-700 hover:bg-road-100 md:hidden"
              aria-label="Abrir menú"
            >
              <AppIcons.menu size={20} />
            </button>
            <h1 className="truncate text-base font-semibold text-road-900 md:text-lg">
              <span className="md:hidden">{t('Admin')}</span>
              <span className="hidden md:inline">{t('Panel de administración')}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex overflow-hidden rounded-lg border border-road-200">
              {(['es', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    'px-2 py-1 text-xs font-semibold uppercase',
                    lang === l ? 'bg-brand-500 text-white' : 'bg-white text-road-600',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <span className="hidden text-sm text-road-500 sm:inline">
              {session?.user.email}
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/entrar');
              }}
              className="flex items-center gap-1 rounded-lg border border-road-200 px-3 py-1.5 text-sm font-medium text-road-700 hover:bg-road-50"
            >
              <AppIcons.logout size={16} />
              <span className="hidden sm:inline">{t('Salir')}</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary fallbackTitle="No se pudo cargar esta sección">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
