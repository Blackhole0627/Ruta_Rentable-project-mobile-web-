import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '@shared/types/notification.types';
import { useAuthStore } from '@/core/store/useAuthStore';
import { useNotificationStore } from '@/core/store/useNotificationStore';
import { AppIcons } from '@/shared/constants/icons';
import { cn } from '@/shared/utils/cn';
import { useI18n } from '@/core/i18n/i18n';
import { formatDate } from '@/shared/utils/formatters';

/** A single notification: tap to open, swipe sideways or tap × to dismiss. */
function NotificationRow({
  n,
  onOpen,
  onRemove,
}: {
  n: AppNotification;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  return (
    <div className="border-b border-road-50 last:border-0">
      <div
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (startX.current !== null) setDx(e.touches[0].clientX - startX.current);
        }}
        onTouchEnd={() => {
          if (Math.abs(dx) > 80) onRemove();
          setDx(0);
          startX.current = null;
        }}
        style={{
          transform: `translateX(${dx}px)`,
          opacity: 1 - Math.min(Math.abs(dx) / 200, 0.6),
          transition: dx === 0 ? 'transform 0.2s' : 'none',
        }}
        className={cn('flex items-start gap-2 p-3', !n.read && 'bg-brand-50/50')}
      >
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 gap-3 text-left">
          <AppIcons.bell
            size={16}
            className={cn('mt-0.5 shrink-0', n.read ? 'text-road-300' : 'text-brand-600')}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-road-900">{n.title}</span>
            <span className="block text-xs text-road-500">{n.body}</span>
            <span className="block text-[10px] text-road-400">{formatDate(new Date(n.createdAt))}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Eliminar"
          className="shrink-0 p-1 text-road-300 hover:text-danger-500"
        >
          <AppIcons.close size={16} />
        </button>
      </div>
    </div>
  );
}

/** Driver top bar: brand on the left, notifications bell on the right. */
export function TopNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { status } = useAuthStore();
  const { items, unread, load, startRealtime, stopRealtime, markRead, markAllRead, remove } =
    useNotificationStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      load();
      startRealtime();
      return () => stopRealtime();
    }
    stopRealtime();
  }, [status, load, startRealtime, stopRealtime]);

  return (
    <header className="glass sticky top-0 z-40 flex items-center justify-between border-b border-road-100/80 px-3.5 py-2">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-grad shadow-brand">
          <AppIcons.calculator size={17} className="text-white" />
        </span>
        <span className="text-[15px] font-extrabold tracking-tight text-road-900">
          Ruta<span className="text-gradient-brand">Rentable</span>
        </span>
      </div>

      {status === 'authenticated' && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o);
              load();
            }}
            aria-label={t('Notificaciones')}
            className="press relative flex h-10 w-10 items-center justify-center rounded-full text-road-600 hover:bg-road-100 active:bg-road-200"
          >
            <AppIcons.bell size={22} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" />
              <div className="absolute right-0 z-50 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl border border-road-100 bg-white shadow-card-lg">
                <div className="flex items-center justify-between border-b border-road-100 p-3">
                  <span className="font-semibold">{t('Notificaciones')}</span>
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllRead()}
                      className="text-xs font-medium text-brand-600"
                    >
                      {t('Marcar todo leído')}
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="p-6 text-center text-sm text-road-400">
                      {t('Sin notificaciones')}
                    </p>
                  ) : (
                    items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        n={n}
                        onOpen={() => {
                          markRead(n.id);
                          setOpen(false);
                          if (n.link) navigate(n.link);
                        }}
                        onRemove={() => remove(n.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
