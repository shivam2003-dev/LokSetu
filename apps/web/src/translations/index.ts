/**
 * Bundled static translations for the JanVaani web console.
 *
 * Every language listed here works fully offline — no API call needed.
 * The WebI18nProvider uses these first; it only calls the API for strings
 * that are not covered here (dynamic AI-generated content, etc.).
 *
 * Adding a new language: create a new file (e.g. te.ts) and import it below.
 */

import hi from "./hi.js";
import ta from "./ta.js";

export const BUNDLED_TRANSLATIONS: Record<string, Record<string, string>> = {
  Hindi: hi,
  Tamil: ta,
};

/** Languages fully covered by bundled translations (no API call needed). */
export const BUNDLED_LANGUAGES = new Set(Object.keys(BUNDLED_TRANSLATIONS));
