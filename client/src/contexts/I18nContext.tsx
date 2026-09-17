import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import plDict from '../i18n/pl.json';
import enDict from '../i18n/en.json';
import type { Language } from '@impostor/shared';
type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = { pl: plDict, en: enDict };

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('impostor:uiLanguage');
  if (stored === 'pl' || stored === 'en') return stored;
  return 'pl';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    localStorage.setItem('impostor:uiLanguage', language);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[language];

    function t(key: string, params?: Record<string, string | number>): string {
      let text = dict[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    }

    return { language, setLanguage: setLanguageState, t };
  }, [language]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
