/**
 * Lightweight i18n for the citizen app using "default language as key":
 * every UI string is its own English source text, and t(source) returns the
 * translated string for the active language (or the English source as fallback).
 *
 * Translations are fetched once per language from the API (AI-backed, with a
 * server-side Hindi seed) and cached in localStorage so a return visit is
 * instant and works offline.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { UI_STRINGS } from "./uiStrings.js";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
// Bump this version whenever the UI_STRINGS set changes so stale per-language
// caches in localStorage are invalidated automatically.
const cachePrefix = `loksetuUiTranslations:v2:`;

type TranslationMap = Record<string, string>;

type I18nValue = {
  language: string;
  t: (source: string) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nValue>({ language: "auto", t: (source) => source, ready: true });

function cacheKey(language: string) {
  return `${cachePrefix}${language.toLowerCase()}`;
}

function readCache(language: string): TranslationMap | null {
  try {
    const stored = localStorage.getItem(cacheKey(language));
    return stored ? (JSON.parse(stored) as TranslationMap) : null;
  } catch {
    return null;
  }
}

/**
 * Languages that need no translation fetch: English (source) and "auto"
 * (detect-from-content — the UI itself stays in English).
 */
function isEnglishUi(language: string): boolean {
  const normalized = language.trim().toLowerCase();
  return !normalized || normalized === "auto" || normalized === "english";
}

export function I18nProvider({ language, children }: { language: string; children: ReactNode }) {
  const [translations, setTranslations] = useState<TranslationMap>(() => readCache(language) ?? {});
  const [ready, setReady] = useState(() => isEnglishUi(language) || Boolean(readCache(language)));

  useEffect(() => {
    if (isEnglishUi(language)) {
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
    fetch(`${apiBase}/api/citizen/ui-translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, strings: UI_STRINGS })
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { translations?: TranslationMap } | null) => {
        if (cancelled) return;
        const map = payload?.translations ?? {};
        setTranslations(map);
        try {
          localStorage.setItem(cacheKey(language), JSON.stringify(map));
        } catch {
          // Ignore quota / privacy-mode storage failures; translation still works this session.
        }
      })
      .catch(() => {
        // Network failure: keep English. The app remains fully usable.
        if (!cancelled) setTranslations({});
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const t = useCallback((source: string) => translations[source] ?? source, [translations]);
  const value = useMemo<I18nValue>(() => ({ language, t, ready }), [language, t, ready]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): (source: string) => string {
  return useContext(I18nContext).t;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
