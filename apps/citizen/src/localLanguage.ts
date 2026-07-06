/**
 * Client-side local-language detection for the citizen app.
 *
 * The API reverse-geocodes GPS to a state (see services/api/src/geo.ts), but the
 * citizen page only holds raw lat/lng. To offer a Facebook-style "local language"
 * chip immediately — before any network round-trip — we snap the phone's GPS to
 * the nearest state centroid and map that state to its primary regional language.
 *
 * The language names here MUST match the entries in languageOptions (App.tsx) so a
 * detected value can drive the existing submission / AI-language field directly.
 */

export type StateLanguagePoint = {
  state: string;
  language: string;
  lat: number;
  lng: number;
};

// State centroids mirror services/api/src/geo.ts. Each maps to the primary
// regional language spoken there; English is used where no listed Indian
// language is the lingua franca.
const stateLanguagePoints: StateLanguagePoint[] = [
  { state: "Andhra Pradesh", language: "Telugu", lat: 15.9129, lng: 79.74 },
  { state: "Arunachal Pradesh", language: "English", lat: 28.218, lng: 94.7278 },
  { state: "Assam", language: "Assamese", lat: 26.2006, lng: 92.9376 },
  { state: "Bihar", language: "Hindi", lat: 25.0961, lng: 85.3131 },
  { state: "Chhattisgarh", language: "Hindi", lat: 21.2787, lng: 81.8661 },
  { state: "Goa", language: "Konkani", lat: 15.2993, lng: 74.124 },
  { state: "Gujarat", language: "Gujarati", lat: 22.2587, lng: 71.1924 },
  { state: "Haryana", language: "Hindi", lat: 29.0588, lng: 76.0856 },
  { state: "Himachal Pradesh", language: "Hindi", lat: 31.1048, lng: 77.1734 },
  { state: "Jharkhand", language: "Hindi", lat: 23.6102, lng: 85.2799 },
  { state: "Karnataka", language: "Kannada", lat: 15.3173, lng: 75.7139 },
  { state: "Kerala", language: "Malayalam", lat: 10.8505, lng: 76.2711 },
  { state: "Madhya Pradesh", language: "Hindi", lat: 22.9734, lng: 78.6569 },
  { state: "Maharashtra", language: "Marathi", lat: 19.7515, lng: 75.7139 },
  { state: "Manipur", language: "Manipuri", lat: 24.6637, lng: 93.9063 },
  { state: "Meghalaya", language: "English", lat: 25.467, lng: 91.3662 },
  { state: "Mizoram", language: "English", lat: 23.1645, lng: 92.9376 },
  { state: "Nagaland", language: "English", lat: 26.1584, lng: 94.5624 },
  { state: "Odisha", language: "Odia", lat: 20.9517, lng: 85.0985 },
  { state: "Punjab", language: "Punjabi", lat: 31.1471, lng: 75.3412 },
  { state: "Rajasthan", language: "Hindi", lat: 27.0238, lng: 74.2179 },
  { state: "Sikkim", language: "Nepali", lat: 27.533, lng: 88.5122 },
  { state: "Tamil Nadu", language: "Tamil", lat: 11.1271, lng: 78.6569 },
  { state: "Telangana", language: "Telugu", lat: 18.1124, lng: 79.0193 },
  { state: "Tripura", language: "Bangla", lat: 23.9408, lng: 91.9882 },
  { state: "Uttar Pradesh", language: "Hindi", lat: 26.8467, lng: 80.9462 },
  { state: "Uttarakhand", language: "Hindi", lat: 30.0668, lng: 79.0193 },
  { state: "West Bengal", language: "Bangla", lat: 22.9868, lng: 87.855 },
  { state: "Delhi", language: "Hindi", lat: 28.6139, lng: 77.209 }
];

// Native-script labels for the switcher. Keys match languageOptions (App.tsx).
export const languageNativeNames: Record<string, string> = {
  auto: "Auto-detect",
  Hindi: "हिन्दी",
  English: "English",
  Bangla: "বাংলা",
  Tamil: "தமிழ்",
  Telugu: "తెలుగు",
  Marathi: "मराठी",
  Gujarati: "ગુજરાતી",
  Kannada: "ಕನ್ನಡ",
  Malayalam: "മലയാളം",
  Punjabi: "ਪੰਜਾਬੀ",
  Odia: "ଓଡ଼ିଆ",
  Urdu: "اردو",
  Assamese: "অসমীয়া",
  Bodo: "बड़ो",
  Dogri: "डोगरी",
  Konkani: "कोंकणी",
  Kashmiri: "کٲشُر",
  Maithili: "मैथिली",
  Manipuri: "মৈতৈলোন্",
  Nepali: "नेपाली",
  Sanskrit: "संस्कृतम्",
  Santali: "ᱥᱟᱱᱛᱟᱲᱤ",
  Sindhi: "سنڌي"
};

/** Native label for a language code, falling back to the code itself. */
export function nativeLanguageLabel(language: string): string {
  return languageNativeNames[language] ?? language;
}

/** Snap GPS coordinates to the nearest state centroid and return its language. */
export function detectLocalLanguage(lat: number, lng: number): string {
  let best = stateLanguagePoints[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of stateLanguagePoints) {
    const distance = haversine(lat, lng, point.lat, point.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best.language;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
