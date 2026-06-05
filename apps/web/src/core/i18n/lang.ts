import { EN } from './translations';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'rr.lang';

/** Current language: stored preference, else the device language. */
export function getLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'es') return stored;
  const device = (typeof navigator !== 'undefined' ? navigator.language : 'es').toLowerCase();
  return device.startsWith('en') ? 'en' : 'es';
}

/** Translate a Spanish source string outside of React (e.g. notifications). */
export function translate(es: string, vars?: Record<string, string | number>): string {
  let s = getLang() === 'en' ? EN[es] ?? es : es;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replaceAll(`{${k}}`, String(vars[k]));
    }
  }
  return s;
}
