import type { Platform } from '@shared/types/trip.types';

export const PLATFORM_LABELS: Record<Platform, string> = {
  indrive: 'InDrive',
  aventon: 'Aventón',
  uber: 'Uber', // legacy — historical trips only, not selectable
  taxi: 'Taxi',
  private: 'Particular',
  delivery: 'Delivery',
  other: 'Otro',
};

export const PLATFORM_COMMISSIONS: Record<Platform, number> = {
  indrive: 10,
  aventon: 12,
  uber: 25,
  taxi: 0,
  private: 0,
  delivery: 20,
  other: 0,
};

// Selectable platforms (Nicaragua). Uber is intentionally excluded.
export const PLATFORMS: Platform[] = [
  'indrive',
  'aventon',
  'taxi',
  'private',
  'delivery',
  'other',
];
