/**
 * i18n for the JanVaani web console — same "default language as key" pattern
 * as the citizen app. English source text is the lookup key; t(source) returns
 * the translated string (or English fallback).
 *
 * Translations are fetched once per language from the API (AI-backed via Sarvam,
 * with a Hindi offline seed) and cached in localStorage.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { WEB_UI_STRINGS } from "./webUiStrings.js";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const cachePrefix = "janvaaniWebTranslations:v1:";
const langStorageKey = "janvaaniWebLanguage";

type TranslationMap = Record<string, string>;

type I18nValue = {
  language: string;
  t: (source: string) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nValue>({ language: "English", t: (s) => s, ready: true });

function cacheKey(lang: string) {
  return `${cachePrefix}${lang.toLowerCase()}`;
}

function readCache(lang: string): TranslationMap | null {
  try {
    const stored = localStorage.getItem(cacheKey(lang));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as TranslationMap;
    return parsed && Object.keys(parsed).length ? parsed : null;
  } catch {
    return null;
  }
}

function isEnglish(lang: string): boolean {
  const n = lang.trim().toLowerCase();
  return !n || n === "english";
}

export function WebI18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(() => localStorage.getItem(langStorageKey) ?? "English");
  const [translations, setTranslations] = useState<TranslationMap>(() => readCache(language) ?? {});
  const [ready, setReady] = useState(() => isEnglish(language) || Boolean(readCache(language)));

  function chooseLanguage(next: string) {
    setLanguage(next);
    localStorage.setItem(langStorageKey, next);
  }

  useEffect(() => {
    if (isEnglish(language)) {
      setTranslations({});
      setReady(true);
      return;
    }
    const cached = readCache(language);
    if (cached) {
      setTranslations(cached);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    fetch(`${apiBase}/api/web/ui-translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, strings: WEB_UI_STRINGS })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { translations?: TranslationMap } | null) => {
        if (cancelled) return;
        const map = payload?.translations ?? {};
        setTranslations(map);
        if (Object.keys(map).length) {
          try { localStorage.setItem(cacheKey(language), JSON.stringify(map)); } catch { /* quota */ }
        }
      })
      .catch(() => { if (!cancelled) setTranslations({}); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [language]);

  const t = useCallback((source: string) => translations[source] ?? source, [translations]);
  const value = useMemo<I18nValue & { chooseLanguage: (l: string) => void }>(
    () => ({ language, t, ready, chooseLanguage }),
    [language, t, ready]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): (source: string) => string {
  return useContext(I18nContext).t;
}

export function useWebI18n(): I18nValue & { chooseLanguage?: (l: string) => void } {
  return useContext(I18nContext) as I18nValue & { chooseLanguage?: (l: string) => void };
}

export { langStorageKey };
