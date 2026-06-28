import assert from "node:assert/strict";
import { fallbackRun, fetchXSignals } from "./externalSignals.js";

const fallback = fallbackRun("gdelt", "school flood India");
assert.equal(fallback.mode, "fallback");
assert.equal(fallback.accepted, 1);
assert.equal(fallback.signals[0]?.ward, "Kalindi Nagar");

const xFallback = await fetchXSignals("road OR water India", "");
assert.equal(xFallback.mode, "fallback");
assert.equal(xFallback.signals[0]?.source, "x");

console.log(JSON.stringify({ ok: true, providers: ["x", "gdelt"] }));
