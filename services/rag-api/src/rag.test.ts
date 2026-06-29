import assert from "node:assert/strict";
import { evaluateCases } from "./evaluation.js";
import { chunkDocument, sha256 } from "./ingestion.js";
import { isRelevantToQuery, rerank } from "./pipeline.js";
import { RagDocument, RetrievalResult } from "./types.js";

const document: RagDocument = {
  id: "bihar-census",
  tenantId: "loksetu",
  namespace: "india",
  source: "markdown",
  sourceUri: "services/rag-api/fixtures/bihar/census-bihar-2011.md",
  sourceUrl: "https://censusindia.gov.in/census.website/data/population-finder",
  title: "Census Bihar 2011 Baseline",
  mediaType: "text/markdown",
  metadata: { region: "Bihar" },
  checksum: sha256("bihar"),
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

const chunks = chunkDocument(
  document,
  "Bihar population was 104,099,452 people in Census 2011. Bihar had 38 districts at the Census 2011 baseline.",
  { chunkSize: 8, chunkOverlap: 2, semanticChunking: false }
);

assert.ok(chunks.length > 1);
assert.equal(chunks[0]?.documentId, "bihar-census");
assert.equal(chunks[0]?.sourceUrl, "https://censusindia.gov.in/census.website/data/population-finder");
assert.ok(chunks.every((chunk) => chunk.checksum.length === 64));

const biharResult: RetrievalResult = {
  ...chunks[0]!,
  vectorScore: 0.8,
  keywordScore: 0.4,
  recencyScore: 0.1,
  confidence: 0.7
};
const delhiResult: RetrievalResult = {
  ...chunks[1]!,
  id: "delhi-unrelated",
  title: "Kalindi Nagar Project",
  content: "Repair classrooms and toilets in Kalindi Nagar.",
  vectorScore: 0.01,
  keywordScore: 0,
  recencyScore: 0.1,
  confidence: 0.01
};

const ranked = rerank([delhiResult, biharResult], [biharResult]);
assert.equal(ranked[0]?.id, biharResult.id);
assert.equal(isRelevantToQuery("what should district officer do next river market", delhiResult, 0.08), false);
assert.equal(isRelevantToQuery("bihar stats population districts census", biharResult, 0.08), true);

const evalResult = evaluateCases([
  {
    query: "bihar stats",
    expectedChunkIds: [biharResult.id],
    retrieved: [biharResult],
    answer: "Bihar population was 104,099,452 people.",
    citations: [{ chunkId: biharResult.id }]
  }
]);
assert.equal(evalResult.recallAtK, 1);
assert.equal(evalResult.citationAccuracy, 1);
assert.equal(evalResult.hallucinationRate, 0);

console.log(JSON.stringify({ ok: true, chunks: chunks.length, recallAtK: evalResult.recallAtK }));
