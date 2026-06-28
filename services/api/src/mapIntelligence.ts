import { RankedProject } from "./types.js";

export type BoundaryLevel = "state" | "district" | "constituency" | "ward";

export type BoundaryFeature = {
  id: string;
  level: BoundaryLevel;
  name: string;
  source: string;
  sourceUrl: string;
  version: string;
  freshness: "fresh" | "stale" | "procurement_required";
  simplification: {
    toleranceMeters: number;
    method: string;
  };
  bbox: [number, number, number, number];
  centroid: { lat: number; lng: number };
  projectIds: string[];
};

export type HotspotCluster = {
  id: string;
  level: "cluster" | "single";
  centroid: { lat: number; lng: number };
  count: number;
  score: number;
  categories: string[];
  projectIds: string[];
  label: string;
};

export function buildBoundaryFeatures(projects: RankedProject[]): BoundaryFeature[] {
  return [
    ...groupBoundary(projects, "state", (project) => project.state),
    ...groupBoundary(projects, "district", (project) => `${project.state} / ${project.district}`),
    ...groupBoundary(projects, "constituency", (project) => project.mpName),
    ...groupBoundary(projects, "ward", (project) => `${project.district} / ${project.ward}`)
  ];
}

export function buildHotspotClusters(projects: RankedProject[], zoom = 5): HotspotCluster[] {
  const cellSize = zoom >= 10 ? 0.06 : zoom >= 7 ? 0.35 : 1.6;
  const cells = new Map<string, RankedProject[]>();
  for (const project of projects) {
    const point = projectPoint(project);
    const key = `${Math.round(point.lat / cellSize)}:${Math.round(point.lng / cellSize)}`;
    const current = cells.get(key) ?? [];
    current.push(project);
    cells.set(key, current);
  }

  return [...cells.entries()].map(([key, items]) => {
    const points = items.map(projectPoint);
    const centroid = {
      lat: round(avg(points.map((point) => point.lat)), 5),
      lng: round(avg(points.map((point) => point.lng)), 5)
    };
    const categories = [...new Set(items.map((item) => item.category))];
    const level: HotspotCluster["level"] = items.length > 1 ? "cluster" : "single";
    return {
      id: `cluster-${key}`,
      level,
      centroid,
      count: items.length,
      score: Math.round(avg(items.map((item) => item.score))),
      categories,
      projectIds: items.map((item) => item.id),
      label: items.length > 1 ? `${items.length} issues near ${items[0].district}` : `${items[0].category} in ${items[0].ward}`
    };
  }).sort((a, b) => b.score - a.score || b.count - a.count);
}

function groupBoundary(projects: RankedProject[], level: BoundaryLevel, nameFn: (project: RankedProject) => string) {
  const grouped = new Map<string, RankedProject[]>();
  for (const project of projects) {
    const key = nameFn(project);
    grouped.set(key, [...(grouped.get(key) ?? []), project]);
  }
  return [...grouped.entries()].map(([name, items]) => boundaryFeature(level, name, items));
}

function boundaryFeature(level: BoundaryLevel, name: string, projects: RankedProject[]): BoundaryFeature {
  const points = projects.map(projectPoint);
  const minLat = Math.min(...points.map((point) => point.lat)) - padding(level);
  const maxLat = Math.max(...points.map((point) => point.lat)) + padding(level);
  const minLng = Math.min(...points.map((point) => point.lng)) - padding(level);
  const maxLng = Math.max(...points.map((point) => point.lng)) + padding(level);
  return {
    id: `${level}-${slug(name)}`,
    level,
    name,
    source: level === "constituency" ? "Election Commission / production boundary connector" : "Survey of India OMP / ISRO Bhuvan production boundary connector",
    sourceUrl: level === "constituency" ? "https://www.eci.gov.in/" : "https://onlinemaps.surveyofindia.gov.in/",
    version: "local-simplified-boundary-2026-06",
    freshness: "procurement_required",
    simplification: {
      toleranceMeters: level === "ward" ? 25 : level === "district" ? 150 : 500,
      method: "bbox-derived local fixture until official GeoJSON/vector tiles are connected"
    },
    bbox: [round(minLng, 5), round(minLat, 5), round(maxLng, 5), round(maxLat, 5)],
    centroid: { lat: round(avg(points.map((point) => point.lat)), 5), lng: round(avg(points.map((point) => point.lng)), 5) },
    projectIds: projects.map((project) => project.id)
  };
}

function projectPoint(project: RankedProject) {
  const seed = hash(`${project.state}-${project.district}-${project.ward}`);
  const known: Record<string, { lat: number; lng: number }> = {
    "Delhi-Central Delhi-Kalindi Nagar": { lat: 28.618, lng: 77.245 },
    "Uttar Pradesh-Lucknow-Aminabad Basti": { lat: 26.85, lng: 80.93 },
    "Maharashtra-Nashik-North Village Cluster": { lat: 20.02, lng: 73.79 },
    "Tamil Nadu-Chennai-Perambur School Zone": { lat: 13.11, lng: 80.24 },
    "West Bengal-Kolkata-Beliaghata Clinic Zone": { lat: 22.56, lng: 88.39 }
  };
  return known[`${project.state}-${project.district}-${project.ward}`] ?? {
    lat: 8 + (seed % 2_700) / 100,
    lng: 68 + ((seed / 17) % 2_800) / 100
  };
}

function padding(level: BoundaryLevel) {
  if (level === "ward") return 0.025;
  if (level === "constituency") return 0.08;
  if (level === "district") return 0.18;
  return 0.45;
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hash(value: string) {
  let output = 0;
  for (const char of value) output = (output * 31 + char.charCodeAt(0)) >>> 0;
  return output;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
