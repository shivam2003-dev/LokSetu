import assert from "node:assert/strict";
import { processIntake } from "./intake.js";

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
                confidence: 0.91
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
    text: "हमारे स्कूल के शौचालय ठीक नहीं हैं."
  });

  assert.equal(compatible.submission.aiProviderMode, "openai-compatible");
  assert.equal(compatible.submission.aiModel, "google/gemini-test");
  assert.equal(compatible.submission.aiFallbackUsed, false);
  assert.equal(compatible.submission.detectedLanguage, "Hindi");

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

  console.log(JSON.stringify({ ok: true, aiRuntimeMetadata: ["ai-required", "openai-compatible", "short-civic-guard"] }));
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
