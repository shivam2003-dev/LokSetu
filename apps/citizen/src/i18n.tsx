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
import { CITIZEN_TRANSLATIONS, CITIZEN_BUNDLED_LANGUAGES } from "./translations/index.js";

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
    if (!stored) return null;
    const parsed = JSON.parse(stored) as TranslationMap;
    // Treat an empty cached map as a miss so we re-fetch. Empty entries can be
    // left behind if a language was selected while the AI provider was
    // unavailable; without this, the UI would stay stuck in English forever.
    return parsed && Object.keys(parsed).length ? parsed : null;
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
  const [translations, setTranslations] = useState<TranslationMap>(
    () => CITIZEN_TRANSLATIONS[language] ?? readCache(language) ?? {}
  );
  const [ready, setReady] = useState(
    () => isEnglishUi(language) || Boolean(CITIZEN_TRANSLATIONS[language]) || Boolean(readCache(language))
  );

  useEffect(() => {
    if (isEnglishUi(language)) {
      setTranslations({});
      setReady(true);
      return;
    }
    // 1. Bundled static translations — instant, no network needed
    const bundled = CITIZEN_TRANSLATIONS[language] ?? null;
    if (bundled) {
      setTranslations(bundled);
      setReady(true);
      return;
    }
    // 2. localStorage cache
    const cached = readCache(language);
    if (cached) {
      setTranslations(cached);
      setReady(true);
      return;
    }
    // 3. Fetch from API (non-bundled languages)
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
        if (Object.keys(map).length) {
          try { localStorage.setItem(cacheKey(language), JSON.stringify(map)); } catch { /* quota */ }
        }
      })
      .catch(() => { if (!cancelled) setTranslations({}); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
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
