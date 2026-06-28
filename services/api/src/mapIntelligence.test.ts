import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBoundaryFeatures, buildHotspotClusters } from "./mapIntelligence.js";
import { RankedProject } from "./types.js";

const project: RankedProject = {
  id: "kalindi-nagar-education",
  title: "Repair classrooms and toilets in Kalindi Nagar",
  category: "Education",
  state: "Delhi",
  district: "Central Delhi",
  ward: "Kalindi Nagar",
  mpId: "mp-delhi-central",
  mpName: "MP Central Delhi",
  score: 95,
  confidence: 0.94,
  demandCount: 48,
  averageRating: 4.5,
  ratings: 2,
  demandScore: 37,
  needScore: 32,
  urgencyScore: 15,
  equityScore: 12,
  languageMix: ["Hindi"],
  recentCitizenAliases: ["Local Voice 482"],
  rationale: "Repeated education signals.",
  evidence: ["48 similar requests"],
  safeguards: ["Privacy alias enabled"],
  status: "shortlist"
};

const dir = mkdtempSync(join(tmpdir(), "loksetu-boundaries-"));
try {
  writeFileSync(
    join(dir, "wards.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            level: "ward",
            name: "Kalindi Nagar",
            source: "Approved State GIS Portal",
            sourceUrl: "https://example.gov.in/gis",
            version: "2026-06",
            freshness: "fresh",
            toleranceMeters: 25,
            simplificationMethod: "official vector tile simplification"
          },
          geometry: {
            type: "Polygon",
            coordinates: [[[77.24, 28.61], [77.25, 28.61], [77.25, 28.62], [77.24, 28.62], [77.24, 28.61]]]
          }
        }
      ]
    })
  );
  process.env.BOUNDARY_GEOJSON_DIR = dir;

  const boundaries = buildBoundaryFeatures([project]);
  assert.equal(boundaries.length, 1);
  assert.equal(boundaries[0].source, "Approved State GIS Portal");
  assert.equal(boundaries[0].freshness, "fresh");
  assert.deepEqual(boundaries[0].projectIds, [project.id]);
  assert.deepEqual(boundaries[0].bbox, [77.24, 28.61, 77.25, 28.62]);
} finally {
  delete process.env.BOUNDARY_GEOJSON_DIR;
  rmSync(dir, { recursive: true, force: true });
}

const fallbackBoundaries = buildBoundaryFeatures([project]);
assert.ok(fallbackBoundaries.some((boundary) => boundary.freshness === "procurement_required"));

const clusters = buildHotspotClusters([project], 5);
assert.equal(clusters.length, 1);
assert.deepEqual(clusters[0].projectIds, [project.id]);

console.log(JSON.stringify({ ok: true, officialBoundaryLoader: true, fallbackBoundaries: fallbackBoundaries.length, clusters: clusters.length }));
