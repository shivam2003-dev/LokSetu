/**
 * Location resolver: turns a phone's GPS coordinates into the constituency
 * hierarchy (state / district / ward) the ranking pipeline needs.
 *
 * Strategy:
 *   1. If GOOGLE_MAPS_API_KEY is set, call the Google Geocoding API to get a
 *      human-readable address label for the citizen's receipt.
 *   2. Snap the coordinates to the nearest known ward in our seed datasets so
 *      the submission routes to the right MP even before full boundary data is
 *      loaded. Production swaps this for BigQuery GIS / official ward polygons.
 */

import { Location } from "./types.js";

type WardPoint = Location & { lat: number; lng: number };

// Approximate centroids for the seeded wards. Replace with official boundaries.
const wardPoints: WardPoint[] = [
  { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar", lat: 28.62, lng: 77.3 },
  { state: "Delhi", district: "Central Delhi", ward: "River Market", lat: 28.65, lng: 77.23 },
  { state: "Delhi", district: "East Delhi", ward: "East Colony", lat: 28.63, lng: 77.29 },
  { state: "Maharashtra", district: "Nashik Rural", ward: "North Village", lat: 20.01, lng: 73.79 }
];

const defaultLocation: Location = { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" };

export type ResolvedLocation = Location & { label: string };

export async function resolveLocation(input: {
  lat?: number;
  lng?: number;
  state?: string;
  district?: string;
  ward?: string;
}): Promise<ResolvedLocation> {
  // Explicit ward selection (e.g. from a dropdown) always wins.
  if (input.ward && input.state && input.district) {
    return { state: input.state, district: input.district, ward: input.ward, label: `${input.ward}, ${input.district}` };
  }

  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const nearest = nearestWard(input.lat, input.lng);
    const label = (await reverseGeocode(input.lat, input.lng)) ?? `${nearest.ward}, ${nearest.district}`;
    return { state: nearest.state, district: nearest.district, ward: nearest.ward, label };
  }

  const fallbackWard = input.ward ?? defaultLocation.ward;
  return {
    state: input.state ?? defaultLocation.state,
    district: input.district ?? defaultLocation.district,
    ward: fallbackWard,
    label: `${fallbackWard}, ${input.district ?? defaultLocation.district}`
  };
}

function nearestWard(lat: number, lng: number): WardPoint {
  let best = wardPoints[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of wardPoints) {
    const distance = haversine(lat, lng, point.lat, point.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best;
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

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { results?: Array<{ formatted_address?: string }> };
    return data.results?.[0]?.formatted_address ?? null;
  } catch {
    return null;
  }
}
