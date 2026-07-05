import assert from "node:assert/strict";
import { processIntake } from "./intake.js";
import { buildDiscardedIntakeDecision, MINIMUM_STORED_CITIZEN_SCORE } from "./noisePolicy.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

try {
  process.env.AI_DISABLED = "true";
  delete process.env.OPENAI_COMPATIBLE_API_KEY;
  await assert.rejects(
    () =>
      processIntake({
        channel: "text",
        userId: "ai-test-no-fallback",
        username: "no-fallback-user",
        privacyMode: true,
        state: "Delhi",
        district: "Central Delhi",
        ward: "Kalindi Nagar",
        urgency: 4,
        rating: 5,
        text: "The school toilet is broken and classrooms flood after rain."
      }),
    /AI model provider is not configured/
  );

  process.env.AI_DISABLED = "false";
  delete process.env.VERTEX_AI_PROJECT_ID;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  process.env.OPENAI_COMPATIBLE_API_KEY = "test-key";
  process.env.OPENAI_COMPATIBLE_BASE_URL = "https://mock-openai-compatible.local/v1";
  process.env.OPENAI_COMPATIBLE_MODEL = "google/gemini-test";

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                detectedLanguage: "Hindi",
                normalizedText: "School toilets need repair.",
                category: "Education",
                confidence: 0.91,
                qualityScore: 92,
                qualitySignals: ["Clear public school issue", "Actionable repair request"]
              })
            }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const compatible = await processIntake({
    channel: "text",
    userId: "ai-test-compatible",
    username: "compatible-user",
    privacyMode: true,
    state: "Delhi",
    district: "Central Delhi",
    ward: "Kalindi Nagar",
    urgency: 5,
    rating: 5,
    aadhaarHash: "aadhaar-test-hash",
    aadhaarMasked: "xxxx-xxxx-0123",
    aadhaarLast4: "0123",
    aadhaarVerified: false,
    identityMode: "aadhaar_format_only",
    text: "हमारे स्कूल के शौचालय ठीक नहीं हैं."
  });

  assert.equal(compatible.submission.aiProviderMode, "openai-compatible");
  assert.equal(compatible.submission.aiModel, "google/gemini-test");
  assert.equal(compatible.submission.aiFallbackUsed, false);
  assert.equal(compatible.submission.detectedLanguage, "Hindi");
  assert.equal(compatible.submission.aadhaarMasked, "xxxx-xxxx-0123");
  assert.equal(compatible.submission.aadhaarVerified, false);
  assert.ok((compatible.submission.submissionQualityScore ?? 0) >= 80);
  assert.equal(compatible.submission.rewardBand, "excellent");

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                detectedLanguage: "unknown",
                normalizedText: "The streetlights on my road are not working.",
                category: "Power",
                confidence: 0.88,
                isCivicIssue: false,
                noiseReason: "Issue text is too short to route."
              })
            }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const shortCivic = await processIntake({
    channel: "text",
    language: "Hindi",
    userId: "ai-test-short-civic",
    username: "short-civic-user",
    privacyMode: true,
    state: "Delhi",
    district: "Central Delhi",
    ward: "Kalindi Nagar",
    urgency: 4,
    rating: 5,
    text: "मेरी सड़क की लाइट काम नहीं कर रही है."
  });

  assert.equal(shortCivic.submission.detectedLanguage, "Hindi");
  assert.equal(shortCivic.submission.category, "Power");
  assert.equal(shortCivic.submission.isCivicIssue, true);
  assert.equal(shortCivic.submission.noiseReason, undefined);

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                detectedLanguage: "English",
                normalizedText: "bad",
                category: "Civic Services",
                confidence: 0.25,
                qualityScore: 12,
                qualitySignals: ["Too short to route", "No actionable public details"]
              })
            }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const noisyScoringPayload = {
    channel: "text" as const,
    userId: "ai-test-noise",
    username: "noise-user",
    privacyMode: true,
    urgency: 1,
    rating: 1,
    text: "bad"
  };
  const noisyPayload = {
    ...noisyScoringPayload,
    state: "Delhi",
    district: "Central Delhi",
    ward: "Kalindi Nagar",
    aadhaarHash: "aadhaar-noise-hash",
    aadhaarMasked: "xxxx-xxxx-9999",
    aadhaarLast4: "9999",
    aadhaarVerified: false as const,
    identityMode: "aadhaar_format_only" as const,
    media: "data:image/png;base64,abc"
  };
  const noisy = await processIntake(noisyScoringPayload);
  const discard = buildDiscardedIntakeDecision(noisyPayload, noisy.submission, "2026-07-05T00:00:00.000Z");
  assert.ok(discard, "score below threshold should be discarded");
  assert.ok(discard.score < MINIMUM_STORED_CITIZEN_SCORE);
  assert.equal(discard.payload.discarded, true);
  assert.equal(discard.payload.text, undefined);
  assert.equal(discard.payload.media, undefined);
  assert.equal(discard.payload.aadhaarHash, undefined);
  assert.equal(discard.payload.state, undefined);
  assert.equal(discard.payload.ward, undefined);
  assert.equal(discard.payload.discardedScore, discard.score);

  console.log(JSON.stringify({ ok: true, aiRuntimeMetadata: ["ai-required", "openai-compatible", "short-civic-guard", "noise-discard"] }));
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
