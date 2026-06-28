import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestOfficialDataFile, mergeServingRows } from "./dataPipeline.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = (name: string) => resolve(root, "fixtures", "official-data", name);

const schools = await ingestOfficialDataFile(fixture("school-enrollment.json"));
assert.equal(schools.rowCount, 2);
assert.equal(schools.snapshotId, "education-fixture-school-2026-06");
assert.ok(schools.rows[0]?.id.includes("education-fixture-school-2026-06"));

const roads = await ingestOfficialDataFile(fixture("roads.json"));
const once = mergeServingRows([], schools.rows);
const twice = mergeServingRows(once, schools.rows);
const withRoads = mergeServingRows(twice, roads.rows);
assert.equal(once.length, twice.length, "rerunning the same snapshot must be idempotent");
assert.equal(withRoads.length, 4);

let failed = false;
try {
  await ingestOfficialDataFile(fixture("malformed.json"));
} catch (error) {
  failed = true;
  assert.match(error instanceof Error ? error.message : String(error), /ward/);
}
assert.equal(failed, true, "malformed fixture should fail with actionable validation error");

console.log(JSON.stringify({ ok: true, snapshots: [schools.snapshotId, roads.snapshotId], servingRows: withRoads.length }));
