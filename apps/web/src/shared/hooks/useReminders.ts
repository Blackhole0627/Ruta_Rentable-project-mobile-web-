import { useState } from 'react';
import { useTripStore } from '@/core/store/useTripStore';
import { useUserStore } from '@/core/store/useUserStore';

export interface Reminder {
  id: string;
  title: string;
  message: string;
  /** Interpolation vars for the title (translated in the banner). */
  vars?: Record<string, string | number>;
  to?: string;
  actionLabel?: string;
  tone: 'info' | 'warn';
}

const DAY = 86_400_000;
const FUEL_CHECK_KEY = 'rr.fuelCheckedAt';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function dismissKey(): string {
  return `rr.dismissed.${todayKey()}`;
}
function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(dismissKey()) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * S3 alerts/reminders — derives in-app reminders from local state (fuel-price
 * freshness, inactivity, subscription status). Dismissals are remembered.
 */
export function useReminders(): { reminders: Reminder[]; dismiss: (id: string) => void } {
  const { trips } = useTripStore();
  const { user } = useUserStore();
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);
  const [now] = useState(() => Date.now());

  const all: Reminder[] = [];

  // Fuel price freshness (Nicaragua prices change weekly).
  const fuelCheckedAt = Number(localStorage.getItem(FUEL_CHECK_KEY) ?? 0);
  if (now - fuelCheckedAt > 7 * DAY) {
    all.push({
      id: 'fuel',
      title: 'Actualiza el precio del combustible',
      message: 'Los precios cambian seguido. Revisa que tu precio esté al día.',
      to: '/ajustes',
      actionLabel: 'Actualizar',
      tone: 'info',
    });
  }

  // Inactivity: trips exist but none in the last 3 days.
  if (trips.length > 0) {
    const latest = Math.max(...trips.map((t) => new Date(t.createdAt).getTime()));
    const days = Math.floor((now - latest) / DAY);
    if (days >= 3) {
      all.push({
        id: 'inactivity',
        title: 'Hace {n} días sin registrar viajes',
        vars: { n: days },
        message: 'Registra tus viajes para mantener tus reportes al día.',
        tone: 'info',
      });
    }
  }

  // Overdue subscription.
  if (user?.subscriptionStatus === 'overdue') {
    all.push({
      id: 'overdue',
      title: 'Tu suscripción está vencida',
      message: 'Renueva para seguir guardando viajes en la nube.',
      to: '/suscripcion',
      actionLabel: 'Renovar',
      tone: 'warn',
    });
  }

  const dismiss = (id: string) => {
    if (id === 'fuel') {
      // Acknowledging resets the weekly timer.
      localStorage.setItem(FUEL_CHECK_KEY, String(Date.now()));
    }
    const next = [...new Set([...dismissed, id])];
    localStorage.setItem(dismissKey(), JSON.stringify(next));
    setDismissed(next);
  };

  return { reminders: all.filter((r) => !dismissed.includes(r.id)), dismiss };
}
