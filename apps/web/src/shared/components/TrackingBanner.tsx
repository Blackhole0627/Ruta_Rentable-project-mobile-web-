import { useEffect, useRef, useState } from 'react';
import { useTripTrackerStore } from '@/core/store/useTripTrackerStore';
import { AppIcons } from '@/shared/constants/icons';
import { useI18n } from '@/core/i18n/i18n';

const POS_KEY = 'rr.trackerPos';
const W = 150;
const H = 150;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const w = typeof window !== 'undefined' ? window.innerWidth : 360;
  const h = typeof window !== 'undefined' ? window.innerHeight : 640;
  return { x: w - W - 16, y: h - H - 110 }; // bottom-right above the nav
}

/**
 * Floating, draggable, glass GPS widget shown on every driver screen while a
 * trip is measured. Pause / resume, stop, or drag it to the bottom to end.
 */
export function TrackingBanner() {
  const { t } = useI18n();
  const { tracking, paused, distanceKm, pause, resume, stop } = useTripTrackerStore();

  const [pos, setPos] = useState(loadPos);
  const [overDrop, setOverDrop] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const drag = useRef<{ on: boolean; ox: number; oy: number }>({ on: false, ox: 0, oy: 0 });

  // Keep it on-screen if the viewport changes.
  useEffect(() => {
    const onResize = () =>
      setPos((p) => ({
        x: clamp(p.x, 8, window.innerWidth - W - 8),
        y: clamp(p.y, 8, window.innerHeight - H - 8),
      }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!tracking && !paused) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // let buttons click
    drag.current = { on: true, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return;
    const x = clamp(e.clientX - drag.current.ox, 8, window.innerWidth - W - 8);
    const y = clamp(e.clientY - drag.current.oy, 8, window.innerHeight - H - 8);
    setPos({ x, y });
    setOverDrop(e.clientY > window.innerHeight - 130);
  };
  const onPointerUp = () => {
    if (!drag.current.on) return;
    drag.current.on = false;
    if (overDrop) {
      setOverDrop(false);
      setConfirmEnd(true);
    } else {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <>
      {/* Drop zone hint while dragging near the bottom */}
      {overDrop && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-danger-500/90 px-3.5 py-2.5 text-sm font-semibold text-white shadow-card-lg ring-1 ring-white/30 backdrop-blur">
            <AppIcons.stop size={16} /> {t('Suelta aquí para terminar')}
          </div>
        </div>
      )}

      {/* The glass widget */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ left: pos.x, top: pos.y, width: W }}
        className="glass fixed z-50 cursor-grab touch-none select-none rounded-2xl p-3 shadow-card-lg ring-1 ring-road-100 active:cursor-grabbing"
      >
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-road-400">
          {t('Distancia')}
        </p>
        <p className="text-center text-2xl font-extrabold leading-tight text-road-900">
          {distanceKm.toFixed(2)} <span className="text-base font-bold text-road-500">km</span>
        </p>
        <div className="mt-2 flex gap-2">
          {paused ? (
            <button
              type="button"
              onClick={() => resume()}
              aria-label={t('Reanudar')}
              className="press flex h-11 flex-1 items-center justify-center rounded-2xl bg-brand-grad text-white shadow-brand"
            >
              <AppIcons.play size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => pause()}
              aria-label={t('Pausar')}
              className="press flex h-11 flex-1 items-center justify-center rounded-2xl bg-white text-road-700 shadow-sm ring-1 ring-road-200"
            >
              <AppIcons.pause size={20} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            aria-label={t('Detener')}
            className="press flex h-11 flex-1 items-center justify-center rounded-2xl bg-danger-500 text-white shadow-sm"
          >
            <AppIcons.stop size={20} />
          </button>
        </div>
        {paused && (
          <p className="mt-1.5 text-center text-[10px] font-medium text-amber-600">{t('En pausa')}</p>
        )}
      </div>

      {/* End / cancel confirmation */}
      {confirmEnd && (
        <div className="animate-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-road-900/40 p-4 backdrop-blur-sm">
          <div className="animate-slide-up-in w-full max-w-xs rounded-2xl bg-white p-4 text-center shadow-card-lg ring-1 ring-road-100">
            <p className="text-base font-bold text-road-900">{t('¿Terminar el viaje?')}</p>
            <p className="mt-1 text-3xl font-extrabold text-gradient-brand">
              {distanceKm.toFixed(2)} km
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="press h-11 flex-1 rounded-2xl border border-road-200 bg-white font-semibold text-road-700 hover:bg-road-50"
              >
                {t('Cancelar')}
              </button>
              <button
                type="button"
                onClick={() => {
                  stop();
                  setConfirmEnd(false);
                }}
                className="press h-11 flex-1 rounded-2xl bg-danger-500 font-semibold text-white shadow-sm"
              >
                {t('Terminar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
