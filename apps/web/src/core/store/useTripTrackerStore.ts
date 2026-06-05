import { create } from 'zustand';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { haversineKm } from '@/shared/utils/geo';
import { translate } from '@/core/i18n/lang';

type Coord = { lat: number; lng: number };

// --- Native background geolocation (foreground-service, survives screen-off) ---
interface BgLocation {
  latitude: number;
  longitude: number;
}
interface BgGeoPlugin {
  addWatcher(
    opts: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location?: BgLocation, error?: { code?: string }) => void,
  ): Promise<string>;
  removeWatcher(opts: { id: string }): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BgGeoPlugin>('BackgroundGeolocation');

const NOTIF_ID = 7777;
const isNative = Capacitor.isNativePlatform();

// Module-level watch handles so tracking survives navigation (store is a singleton).
let webWatch: number | null = null;
let bgWatch: string | null = null;
let last: Coord | null = null;
let lastNotifKm = -1;

async function postNotification(km: number, paused: boolean, force = false) {
  if (!isNative) return;
  if (!force && Math.abs(km - lastNotifKm) < 0.05) return;
  lastNotifKm = km;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_ID,
          title: 'RutaRentable',
          body: paused
            ? translate('En pausa · {km} km', { km: km.toFixed(2) })
            : translate('Distancia recorrida: {km} km', { km: km.toFixed(2) }),
          ongoing: true,
          autoCancel: false,
          actionTypeId: paused ? 'TRIP_PAUSED' : 'TRIP_RUN',
        },
      ],
    });
  } catch {
    /* notifications optional — never block tracking */
  }
}

async function clearNotification() {
  lastNotifKm = -1;
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
  } catch {
    /* ignore */
  }
}

interface TripTrackerState {
  tracking: boolean;
  paused: boolean;
  distanceKm: number;
  /** Final distance after stop — read by the calculator field. */
  lastResult: number;
  error: string | null;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => number;
  reset: () => void;
}

async function clearWatch() {
  if (webWatch !== null) {
    navigator.geolocation.clearWatch(webWatch);
    webWatch = null;
  }
  if (bgWatch !== null) {
    try {
      await BackgroundGeolocation.removeWatcher({ id: bgWatch });
    } catch {
      /* ignore */
    }
    bgWatch = null;
  }
}

export const useTripTrackerStore = create<TripTrackerState>((set, get) => {
  const onPos = (lat: number, lng: number) => {
    const next: Coord = { lat, lng };
    if (last) {
      const step = haversineKm(last, next);
      // Ignore GPS jitter (<5 m) and absurd jumps (>2 km between points).
      if (step >= 0.005 && step < 2) {
        const km = get().distanceKm + step;
        set({ distanceKm: km });
        void postNotification(km, false);
      }
    }
    last = next;
  };

  const beginWatch = async (): Promise<boolean> => {
    last = null;
    if (isNative) {
      try {
        await LocalNotifications.requestPermissions().catch(() => {});
        bgWatch = await BackgroundGeolocation.addWatcher(
          {
            backgroundTitle: 'RutaRentable',
            backgroundMessage: translate('Midiendo distancia…'),
            requestPermissions: true,
            stale: false,
            distanceFilter: 10,
          },
          (location, error) => {
            if (error) {
              set({ error: translate('No se pudo obtener la ubicación.') });
              return;
            }
            if (location) onPos(location.latitude, location.longitude);
          },
        );
        return true;
      } catch {
        set({ error: translate('No se pudo obtener la ubicación.') });
        return false;
      }
    }
    if (!('geolocation' in navigator)) {
      set({ error: translate('Este dispositivo no tiene GPS disponible.') });
      return false;
    }
    webWatch = navigator.geolocation.watchPosition(
      (pos) => onPos(pos.coords.latitude, pos.coords.longitude),
      (err) =>
        set({
          error:
            err.code === err.PERMISSION_DENIED
              ? translate('Permiso de ubicación denegado.')
              : translate('No se pudo obtener la ubicación.'),
          tracking: false,
        }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return true;
  };

  return {
    tracking: false,
    paused: false,
    distanceKm: 0,
    lastResult: 0,
    error: null,

    start: async () => {
      await clearWatch();
      await clearNotification();
      set({ error: null, distanceKm: 0, lastResult: 0, tracking: true, paused: false });
      const ok = await beginWatch();
      if (!ok) set({ tracking: false });
    },

    pause: async () => {
      await clearWatch();
      last = null;
      set({ paused: true });
      void postNotification(get().distanceKm, true, true);
    },

    resume: async () => {
      set({ paused: false, error: null });
      void postNotification(get().distanceKm, false, true);
      const ok = await beginWatch();
      if (!ok) set({ paused: true });
    },

    stop: () => {
      void clearWatch();
      void clearNotification();
      last = null;
      const result = Number(get().distanceKm.toFixed(2));
      set({ tracking: false, paused: false, lastResult: result });
      return result;
    },

    reset: () => {
      void clearWatch();
      void clearNotification();
      last = null;
      set({ tracking: false, paused: false, distanceKm: 0, lastResult: 0, error: null });
    },
  };
});

// --- Notification action buttons (Pause / Resume / Stop) ---
if (isNative) {
  LocalNotifications.registerActionTypes({
    types: [
      {
        id: 'TRIP_RUN',
        actions: [
          { id: 'pause', title: translate('Pausar') },
          { id: 'stop', title: translate('Detener'), destructive: true },
        ],
      },
      {
        id: 'TRIP_PAUSED',
        actions: [
          { id: 'resume', title: translate('Reanudar') },
          { id: 'stop', title: translate('Detener'), destructive: true },
        ],
      },
    ],
  }).catch(() => {});

  LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const st = useTripTrackerStore.getState();
    if (e.actionId === 'pause') void st.pause();
    else if (e.actionId === 'resume') void st.resume();
    else if (e.actionId === 'stop') st.stop();
  }).catch(() => {});
}
