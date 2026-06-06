import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

export type DateLang = 'es' | 'en';

/** Full date + time, localized to the chosen language (defaults to Spanish). */
export function formatDate(date: Date, lang: DateLang = 'es'): string {
  return format(date, 'd MMM yyyy, HH:mm', { locale: lang === 'en' ? enUS : es });
}

/** Date only (no time) — used for CSV / PDF exports. */
export function formatDateShort(date: Date, lang: DateLang = 'es'): string {
  return format(date, 'd MMM yyyy', { locale: lang === 'en' ? enUS : es });
}

export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}
