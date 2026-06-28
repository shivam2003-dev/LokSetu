import assert from "node:assert/strict";
import { processIntake } from "./intake.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

try {
  process.env.AI_DISABLED = "true";
  delete process.env.OPENAI_COMPATIBLE_API_KEY;
  const fallback = await processIntake({
    channel: "text",
    userId: "ai-test-fallback",
    username: "fallback-user",
    privacyMode: true,
    state: "Delhi",
    district: "Central Delhi",
    ward: "Kalindi Nagar",
    urgency: 4,
    rating: 5,
    text: "The school toilet is broken and classrooms flood after rain."
  });

  assert.equal(fallback.submission.aiProviderMode, "fallback");
  assert.equal(fallback.submission.aiModel, "deterministic-offline-rules");
  assert.equal(fallback.submission.aiFallbackUsed, true);

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

  console.log(JSON.stringify({ ok: true, aiRuntimeMetadata: ["fallback", "openai-compatible"] }));
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
