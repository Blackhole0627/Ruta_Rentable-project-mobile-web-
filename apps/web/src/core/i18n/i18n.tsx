import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { EN } from './translations';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'rr.lang';

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a Spanish source string; falls back to Spanish if untranslated. */
  t: (es: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function loadLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'es') return stored;
  // No preference yet — follow the phone/browser language.
  const device = (typeof navigator !== 'undefined' ? navigator.language : 'es').toLowerCase();
  return device.startsWith('en') ? 'en' : 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
    setLangState(l);
  }, []);

  const t = useCallback(
    (es: string, vars?: Record<string, string | number>) => {
      let s = lang === 'en' ? EN[es] ?? es : es;
      if (vars) {
        for (const k of Object.keys(vars)) {
          s = s.replaceAll(`{${k}}`, String(vars[k]));
        }
      }
      return s;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
