/**
 * Location resolver: turns a phone's GPS coordinates into the constituency
 * hierarchy (state / district / ward) the ranking pipeline needs.
 *
 * Strategy:
 *   1. GPS is the source of truth for citizen submissions.
 *   2. Reverse-geocode GPS through Mappls/Google/OSM to derive state,
 *      district, and locality dynamically.
 *   3. Local seed points are only a fallback when geocoding is unavailable.
 */

import { Location } from "./types.js";

type WardPoint = Location & { lat: number; lng: number; aliases: string[] };
type StatePoint = Location & { lat: number; lng: number; aliases: string[] };

const maxSnapDistanceKm = 2;

// Approximate centroids for the seeded wards. Replace with official boundaries.
const wardPoints: WardPoint[] = [
  { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar", lat: 28.62, lng: 77.3, aliases: ["kalindi nagar"] },
  { state: "Delhi", district: "Central Delhi", ward: "River Market", lat: 28.65, lng: 77.23, aliases: ["river market", "old delhi market"] },
  { state: "Delhi", district: "East Delhi", ward: "East Colony", lat: 28.63, lng: 77.29, aliases: ["east colony"] },
  { state: "Maharashtra", district: "Nashik Rural", ward: "North Village", lat: 20.01, lng: 73.79, aliases: ["north village", "nashik rural"] }
];

const statePoints: StatePoint[] = [
  { state: "Andhra Pradesh", district: "Location pending", ward: "Location pending", lat: 15.9129, lng: 79.74, aliases: ["andhra pradesh", "andra pradesh", "andhra paradesh", "ap"] },
  { state: "Arunachal Pradesh", district: "Location pending", ward: "Location pending", lat: 28.218, lng: 94.7278, aliases: ["arunachal pradesh"] },
  { state: "Assam", district: "Location pending", ward: "Location pending", lat: 26.2006, lng: 92.9376, aliases: ["assam"] },
  { state: "Bihar", district: "Location pending", ward: "Location pending", lat: 25.0961, lng: 85.3131, aliases: ["bihar"] },
  { state: "Chhattisgarh", district: "Location pending", ward: "Location pending", lat: 21.2787, lng: 81.8661, aliases: ["chhattisgarh", "chattisgarh"] },
  { state: "Goa", district: "Location pending", ward: "Location pending", lat: 15.2993, lng: 74.124, aliases: ["goa"] },
  { state: "Gujarat", district: "Location pending", ward: "Location pending", lat: 22.2587, lng: 71.1924, aliases: ["gujarat"] },
  { state: "Haryana", district: "Location pending", ward: "Location pending", lat: 29.0588, lng: 76.0856, aliases: ["haryana"] },
  { state: "Himachal Pradesh", district: "Location pending", ward: "Location pending", lat: 31.1048, lng: 77.1734, aliases: ["himachal pradesh"] },
  { state: "Jharkhand", district: "Location pending", ward: "Location pending", lat: 23.6102, lng: 85.2799, aliases: ["jharkhand"] },
  { state: "Karnataka", district: "Location pending", ward: "Location pending", lat: 15.3173, lng: 75.7139, aliases: ["karnataka"] },
  { state: "Kerala", district: "Location pending", ward: "Location pending", lat: 10.8505, lng: 76.2711, aliases: ["kerala"] },
  { state: "Madhya Pradesh", district: "Location pending", ward: "Location pending", lat: 22.9734, lng: 78.6569, aliases: ["madhya pradesh", "mp"] },
  { state: "Maharashtra", district: "Location pending", ward: "Location pending", lat: 19.7515, lng: 75.7139, aliases: ["maharashtra"] },
  { state: "Manipur", district: "Location pending", ward: "Location pending", lat: 24.6637, lng: 93.9063, aliases: ["manipur"] },
  { state: "Meghalaya", district: "Location pending", ward: "Location pending", lat: 25.467, lng: 91.3662, aliases: ["meghalaya"] },
  { state: "Mizoram", district: "Location pending", ward: "Location pending", lat: 23.1645, lng: 92.9376, aliases: ["mizoram"] },
  { state: "Nagaland", district: "Location pending", ward: "Location pending", lat: 26.1584, lng: 94.5624, aliases: ["nagaland"] },
  { state: "Odisha", district: "Location pending", ward: "Location pending", lat: 20.9517, lng: 85.0985, aliases: ["odisha", "orissa"] },
  { state: "Punjab", district: "Location pending", ward: "Location pending", lat: 31.1471, lng: 75.3412, aliases: ["punjab"] },
  { state: "Rajasthan", district: "Location pending", ward: "Location pending", lat: 27.0238, lng: 74.2179, aliases: ["rajasthan"] },
  { state: "Sikkim", district: "Location pending", ward: "Location pending", lat: 27.533, lng: 88.5122, aliases: ["sikkim"] },
  { state: "Tamil Nadu", district: "Location pending", ward: "Location pending", lat: 11.1271, lng: 78.6569, aliases: ["tamil nadu", "tn"] },
  { state: "Telangana", district: "Location pending", ward: "Location pending", lat: 18.1124, lng: 79.0193, aliases: ["telangana"] },
  { state: "Tripura", district: "Location pending", ward: "Location pending", lat: 23.9408, lng: 91.9882, aliases: ["tripura"] },
  { state: "Uttar Pradesh", district: "Location pending", ward: "Location pending", lat: 26.8467, lng: 80.9462, aliases: ["uttar pradesh", "up"] },
  { state: "Uttarakhand", district: "Location pending", ward: "Location pending", lat: 30.0668, lng: 79.0193, aliases: ["uttarakhand", "uttaranchal"] },
  { state: "West Bengal", district: "Location pending", ward: "Location pending", lat: 22.9868, lng: 87.855, aliases: ["west bengal", "bengal"] },
  { state: "Delhi", district: "Delhi", ward: "Location pending", lat: 28.6139, lng: 77.209, aliases: ["delhi", "nct delhi", "new delhi"] }
];

const delhiDistrictAliases: Record<string, string> = {
  central: "Central Delhi",
  "central delhi": "Central Delhi",
  new: "New Delhi",
  "new delhi": "New Delhi",
  east: "East Delhi",
  "east delhi": "East Delhi",
  shahdara: "Shahdara",
  northeast: "North East Delhi",
  "north east": "North East Delhi",
  "north east delhi": "North East Delhi",
  north: "North Delhi",
  "north delhi": "North Delhi",
  northwest: "North West Delhi",
  "north west": "North West Delhi",
  "north west delhi": "North West Delhi",
  west: "West Delhi",
  "west delhi": "West Delhi",
  southwest: "South West Delhi",
  "south west": "South West Delhi",
  "south west delhi": "South West Delhi",
  south: "South Delhi",
  "south delhi": "South Delhi",
  southeast: "South East Delhi",
  "south east": "South East Delhi",
  "south east delhi": "South East Delhi",
  outer: "Outer Delhi",
  "outer delhi": "Outer Delhi"
};

const pendingLocation: Location = { state: "Location pending", district: "Location pending", ward: "Location pending" };

export type ResolvedLocation = Location & { label: string };
type GeocodedLocation = ResolvedLocation & { provider: "mappls" | "google" | "osm" };

export async function resolveLocation(input: {
  lat?: number;
  lng?: number;
  state?: string;
  district?: string;
  ward?: string;
  text?: string;
}): Promise<ResolvedLocation> {
  // Explicit ward selection (e.g. from a dropdown) always wins.
  if (input.ward && input.state && input.district) {
    return { state: input.state, district: input.district, ward: input.ward, label: `${input.ward}, ${input.district}` };
  }

  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const geocoded = await reverseGeocodeLocation(input.lat, input.lng);
    if (geocoded) return geocoded;

    const nearest = nearestKnownLocation(input.lat, input.lng);
    if (nearest.distanceKm <= maxSnapDistanceKm) {
      return {
        state: nearest.point.state,
        district: nearest.point.district,
        ward: nearest.point.ward,
        label: `${nearest.point.ward}, ${nearest.point.district} (offline GPS fallback)`
      };
    }
    const state = nearestState(input.lat, input.lng);
    return {
      state: state.state,
      district: "Location pending",
      ward: "GPS captured",
      label: `GPS captured near ${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}; reverse geocoding pending`
    };
  }

  const textMatch = matchTextLocation([input.ward, input.district, input.state, input.text].filter(Boolean).join(" "));
  if (textMatch) {
    return { ...textMatch, label: `${textMatch.ward}, ${textMatch.district}` };
  }

  const district = canonicalDelhiDistrict(input.district);
  const districtDefault = district ? defaultForDistrict(district) : null;
  if (districtDefault) return { ...districtDefault, label: `${districtDefault.ward}, ${districtDefault.district}` };

  const state = input.state?.trim() || pendingLocation.state;
  const unresolved =
    normalize(state) === "delhi"
      ? { state: "Delhi", district: "Delhi", ward: "Location pending" }
      : { state, district: input.district?.trim() || "Location pending", ward: input.ward?.trim() || "Location pending" };
  return { ...unresolved, label: `${unresolved.ward}, ${unresolved.district}` };
}

function nearestKnownLocation(lat: number, lng: number): { point: WardPoint; distanceKm: number } {
  let best = wardPoints[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of wardPoints) {
    const distance = haversine(lat, lng, point.lat, point.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return { point: best, distanceKm: bestDistance };
}

function nearestState(lat: number, lng: number): StatePoint {
  let best = statePoints[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of statePoints) {
    const distance = haversine(lat, lng, point.lat, point.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best;
}

function matchTextLocation(text: string): WardPoint | StatePoint | null {
  const normalized = normalize(text);
  if (!normalized) return null;
  const wardCandidates = textLocationCandidates(wardPoints, normalized);
  if (wardCandidates[0]) return wardCandidates[0].point;
  const stateCandidates = textLocationCandidates(statePoints, normalized);
  return stateCandidates[0]?.point ?? null;
}

function textLocationCandidates<T extends WardPoint | StatePoint>(points: T[], normalized: string): Array<{ point: T; score: number }> {
  return points
    .map((point) => ({
      point,
      score: [point.ward, point.district, ...point.aliases]
        .map((alias) => normalize(alias))
        .filter((alias) => alias && aliasMatches(normalized, alias))
        .reduce((best, alias) => Math.max(best, alias.length), 0)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

function aliasMatches(text: string, alias: string): boolean {
  if (alias.length <= 3) return text.split(" ").includes(alias);
  return text.includes(alias);
}

function canonicalDelhiDistrict(value?: string): string | null {
  if (!value) return null;
  const key = normalize(value);
  return delhiDistrictAliases[key] ?? null;
}

function defaultForDistrict(district: string): WardPoint | null {
  return wardPoints.find((point) => point.state === "Delhi" && point.district === district) ?? null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
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

async function reverseGeocodeLocation(lat: number, lng: number): Promise<GeocodedLocation | null> {
  return (await reverseGeocodeMappls(lat, lng)) ?? (await reverseGeocodeGoogle(lat, lng)) ?? (await reverseGeocodeOsm(lat, lng));
}

async function reverseGeocodeMappls(lat: number, lng: number): Promise<GeocodedLocation | null> {
  const key = process.env.MAPPLS_MAP_SDK_KEY ?? process.env.PUBLIC_MAPPLS_MAP_SDK_KEY;
  if (!key) return null;
  try {
    const url = `https://apis.mappls.com/advancedmaps/v1/${encodeURIComponent(key)}/rev_geocode?lat=${lat}&lng=${lng}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    const result = Array.isArray(data.results) ? (data.results[0] as Record<string, unknown> | undefined) : data;
    if (!result) return null;
    return fromLooseAddress(result, "mappls");
  } catch {
    return null;
  }
}

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<GeocodedLocation | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      results?: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; types: string[] }> }>;
    };
    const result = data.results?.[0];
    if (!result) return null;
    const component = (type: string) => result.address_components?.find((item) => item.types.includes(type))?.long_name;
    const state = component("administrative_area_level_1");
    const district =
      component("administrative_area_level_3") ??
      component("administrative_area_level_2") ??
      component("locality") ??
      component("administrative_area_level_1");
    const ward =
      component("sublocality_level_1") ??
      component("sublocality") ??
      component("neighborhood") ??
      component("locality") ??
      component("administrative_area_level_3") ??
      "GPS captured";
    if (!state) return null;
    return { state, district: district || "Location pending", ward, label: result.formatted_address ?? `${ward}, ${district}`, provider: "google" };
  } catch {
    return null;
  }
}

async function reverseGeocodeOsm(lat: number, lng: number): Promise<GeocodedLocation | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, { headers: { "User-Agent": "JanVaaniAI/1.0 LokSetu civic platform" } });
    if (!response.ok) return null;
    const data = (await response.json()) as { display_name?: string; address?: Record<string, string> };
    const address = data.address ?? {};
    const state = address.state ?? address.state_district;
    const district = address.state_district ?? address.county ?? address.city_district ?? address.city ?? address.town ?? address.state;
    const ward = address.suburb ?? address.neighbourhood ?? address.quarter ?? address.road ?? address.village ?? address.town ?? address.city ?? "GPS captured";
    if (!state) return null;
    return { state, district: district || "Location pending", ward, label: data.display_name ?? `${ward}, ${district}`, provider: "osm" };
  } catch {
    return null;
  }
}

function fromLooseAddress(result: Record<string, unknown>, provider: "mappls"): GeocodedLocation | null {
  const pick = (...keys: string[]) => keys.map((key) => result[key]).find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const state = pick("state", "stt", "stateName");
  const district = pick("district", "dist", "city", "cityName", "adminArea") ?? state;
  const ward = pick("locality", "subLocality", "subSubLocality", "poi", "village", "street", "city") ?? "GPS captured";
  const label = pick("formatted_address", "formattedAddress", "address", "placeAddress") ?? `${ward}, ${district}, ${state}`;
  if (!state) return null;
  return { state, district: district || "Location pending", ward, label, provider };
}
