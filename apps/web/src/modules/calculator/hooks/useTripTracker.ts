import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { haversineKm } from '@/shared/utils/geo';

type Coord = { lat: number; lng: number };

interface TripTracker {
  tracking: boolean;
  distanceKm: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => number;
  reset: () => void;
}

/**
 * FR-CAL-06 — measures trip distance via GPS so the driver doesn't type km.
 * Uses the native Capacitor Geolocation plugin on Android (handles runtime
 * permission) and the browser Geolocation API on web.
 */
export function useTripTracker(): TripTracker {
  const [tracking, setTracking] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const webWatch = useRef<number | null>(null);
  const nativeWatch = useRef<string | null>(null);
  const last = useRef<Coord | null>(null);
  const total = useRef(0);

  const onPos = (lat: number, lng: number) => {
    const next: Coord = { lat, lng };
    if (last.current) {
      const step = haversineKm(last.current, next);
      // Ignore GPS jitter (<5 m) and absurd jumps (>2 km between points).
      if (step >= 0.005 && step < 2) {
        total.current += step;
        setDistanceKm(total.current);
      }
    }
    last.current = next;
  };

  const reset = () => {
    clearWatch();
    total.current = 0;
    last.current = null;
    setDistanceKm(0);
    setTracking(false);
    setError(null);
  };

  const clearWatch = () => {
    if (webWatch.current !== null) {
      navigator.geolocation.clearWatch(webWatch.current);
      webWatch.current = null;
    }
    if (nativeWatch.current !== null) {
      Geolocation.clearWatch({ id: nativeWatch.current }).catch(() => {});
      nativeWatch.current = null;
    }
  };

  const start = async () => {
    setError(null);
    total.current = 0;
    last.current = null;
    setDistanceKm(0);

    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          setError('Permiso de ubicación denegado.');
          return;
        }
        setTracking(true);
        nativeWatch.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (pos) => {
            if (pos) onPos(pos.coords.latitude, pos.coords.longitude);
          },
        );
      } catch {
        setError('No se pudo obtener la ubicación.');
        setTracking(false);
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Este dispositivo no tiene GPS disponible.');
      return;
    }
    setTracking(true);
    webWatch.current = navigator.geolocation.watchPosition(
      (pos) => onPos(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado.'
            : 'No se pudo obtener la ubicación.',
        );
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  const stop = () => {
    clearWatch();
    setTracking(false);
    return Number(total.current.toFixed(2));
  };

  return { tracking, distanceKm, error, start, stop, reset };
}
