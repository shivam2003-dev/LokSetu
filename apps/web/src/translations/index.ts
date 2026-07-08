/**
 * Bundled static translations for the JanVaani web console.
 *
 * Every language listed here works fully offline — no API call needed.
 * The WebI18nProvider uses these first; it only calls the API for strings
 * that are not covered here (dynamic AI-generated content, etc.).
 *
 * Adding a new language: create a new file (e.g. te.ts) and import it below.
 */

import as_ from "./as.js";
import bn from "./bn.js";
import gu from "./gu.js";
import hi from "./hi.js";
import kn from "./kn.js";
import kok from "./kok.js";
import mai from "./mai.js";
import ml from "./ml.js";
import mr from "./mr.js";
import ne from "./ne.js";
import od from "./od.js";
import pa from "./pa.js";
import sd from "./sd.js";
import ta from "./ta.js";
import te from "./te.js";
import ur from "./ur.js";

export const BUNDLED_TRANSLATIONS: Record<string, Record<string, string>> = {
  Assamese: as_,
  Bengali: bn,
  Gujarati: gu,
  Hindi: hi,
  Kannada: kn,
  Konkani: kok,
  Maithili: mai,
  Malayalam: ml,
  Marathi: mr,
  Nepali: ne,
  Odia: od,
  Punjabi: pa,
  Sindhi: sd,
  Tamil: ta,
  Telugu: te,
  Urdu: ur,
};

/** Languages fully covered by bundled translations (no API call needed). */
export const BUNDLED_LANGUAGES = new Set(Object.keys(BUNDLED_TRANSLATIONS));
