import type { Platform } from '@shared/types/trip.types';

export const PLATFORM_LABELS: Record<Platform, string> = {
  indrive: 'InDrive',
  uber: 'Uber',
  taxi: 'Taxi',
  private: 'Privado',
  delivery: 'Delivery',
  other: 'Otro',
};

export const PLATFORM_COMMISSIONS: Record<Platform, number> = {
  indrive: 10,
  uber: 25,
  taxi: 0,
  private: 0,
  delivery: 20,
  other: 0,
};

export const PLATFORMS: Platform[] = [
  'indrive',
  'uber',
  'taxi',
  'private',
  'delivery',
  'other',
];
