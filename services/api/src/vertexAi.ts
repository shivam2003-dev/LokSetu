/**
 * Vertex AI (Gemini) intelligence layer.
 *
 * One model family — Gemini 2.x on Vertex AI — handles every modality:
 *   - text   : language detect + translate-to-English + civic category
 *   - image  : civic-issue validation + caption + category (vision)
 *   - audio  : speech transcription + language + category (multimodal)
 *
 * Production upgrade path (documented in docs/ai-pipeline.md):
 *   - voice  -> Vertex AI Speech-to-Text "Chirp 2" for long/streamed audio
 *   - image  -> Cloud Vision API (OCR / SafeSearch / label detection)
 *
 * AI-only runtime: request processing retries configured Gemini/Vertex models
 * and optional OpenAI-compatible Gemini routes. It does not synthesize
 * deterministic "processed" records when model inference fails.
 */

export type VertexTextAnalysis = {
  detectedLanguage: string;
  normalizedText: string;
  category: string;
  confidence: number;
  isCivicIssue?: boolean;
  noiseReason?: string;
  providerMode: "vertex" | "openai-compatible" | "fallback";
  model: string;
  fallbackUsed: boolean;
};

export type VertexMediaAnalysis = VertexTextAnalysis & {
  /** false => not a genuine civic/development issue (spam, selfie, blurry). */
  isCivicIssue: boolean;
  /** Human-readable one-line description of what the AI saw or heard. */
  mediaSummary: string;
};

const categories = [
  "Education",
  "Roads",
  "Health",
  "Water",
  "Sanitation",
  "Power",
  "Digital Access",
  "Disaster Relief",
  "Civic Services"
] as const;
type Category = (typeof categories)[number];

function vertexConfig() {
  const project = process.env.VERTEX_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION ?? "us-central1";
  const model = process.env.VERTEX_AI_MODEL ?? "gemini-2.0-flash";
  const enabled = Boolean(project) && process.env.VERTEX_AI_DISABLED !== "true" && process.env.AI_DISABLED !== "true";
  return { project, location, model, enabled };
}

async function geminiClient() {
  const { project, location } = vertexConfig();
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ vertexai: true, project, location, apiVersion: "v1" });
}

function compatibleConfig() {
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL ?? "https://openrouter.ai/api/v1";
  const model = process.env.OPENAI_COMPATIBLE_MODEL ?? "google/gemini-2.0-flash-001";
  const enabled = Boolean(apiKey) && process.env.AI_DISABLED !== "true";
  return { apiKey, baseUrl, model, enabled };
}

export class AiInferenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AiInferenceError";
    this.cause = options?.cause;
  }
}

export function aiRuntimeMode(): "vertex" | "openai-compatible" | "unconfigured" {
  if (vertexConfig().enabled) return "vertex";
  if (compatibleConfig().enabled) return "openai-compatible";
  return "unconfigured";
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export async function analyzeWithVertexAi(text: string, declaredLanguage?: string): Promise<VertexTextAnalysis> {
  const { model, enabled } = vertexConfig();
  if (!enabled) return analyzeWithCompatibleAi(text, declaredLanguage);

  return withModelRetries("Vertex text analysis", vertexModelCandidates(model), async (candidateModel) => {
    const ai = await geminiClient();
    const prompt = [
      "You analyze a citizen civic-development submission for an Indian constituency platform.",
      "Return only JSON: { detectedLanguage, normalizedText, category, confidence, isCivicIssue, noiseReason }.",
      `Allowed category values: ${categories.join(", ")}.`,
      "normalizedText must be concise English that preserves the citizen's problem.",
      "isCivicIssue=false for private/non-public issues, spam, jokes, vague text with no actionable public problem, or problems inside private rooms/hotels/homes.",
      "noiseReason is short and empty only when isCivicIssue=true.",
      `Declared language: ${declaredLanguage ?? "unknown"}.`,
      `Submission: ${text}`
    ].join("\n");

    const result = await ai.models.generateContent({
      model: candidateModel,
      contents: prompt,
      config: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" }
    });
    const parsed = JSON.parse(result.text ?? "{}") as Partial<VertexTextAnalysis>;
    return {
      detectedLanguage: cleanText(parsed.detectedLanguage) || fallbackLanguage(text, declaredLanguage),
      normalizedText: cleanText(parsed.normalizedText) || text.trim(),
      category: asCategory(parsed.category) ?? fallbackCategory(text),
      confidence: clampConfidence(parsed.confidence),
      isCivicIssue: parsed.isCivicIssue !== false && !fallbackNoiseReason(text),
      noiseReason: cleanText(parsed.noiseReason) || fallbackNoiseReason(text),
      providerMode: "vertex",
      model: candidateModel,
      fallbackUsed: false
    };
  });
}

async function analyzeWithCompatibleAi(text: string, declaredLanguage?: string): Promise<VertexTextAnalysis> {
  const { apiKey, baseUrl, model, enabled } = compatibleConfig();
  if (!enabled || !apiKey) throw new AiInferenceError("AI model provider is not configured. Configure Vertex AI or an OpenAI-compatible Gemini key.");

  return withModelRetries("Compatible text analysis", compatibleModelCandidates(model), async (candidateModel) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: candidateModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You analyze citizen civic-development submissions for an Indian constituency platform.",
              "Return only JSON with detectedLanguage, normalizedText, category, confidence, isCivicIssue, noiseReason.",
              `Allowed categories: ${categories.join(", ")}.`,
              "isCivicIssue=false for private/non-public, spam, unreadable, or vague non-actionable reports."
            ].join(" ")
          },
          {
            role: "user",
            content: `Declared language: ${declaredLanguage ?? "unknown"}\nSubmission: ${text}`
          }
        ]
      })
    });
    if (!response.ok) throw new Error(`compatible AI failed: ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as Partial<VertexTextAnalysis>;
    return {
      detectedLanguage: cleanText(parsed.detectedLanguage) || fallbackLanguage(text, declaredLanguage),
      normalizedText: cleanText(parsed.normalizedText) || text.trim(),
      category: asCategory(parsed.category) ?? fallbackCategory(text),
      confidence: clampConfidence(parsed.confidence),
      isCivicIssue: parsed.isCivicIssue !== false && !fallbackNoiseReason(text),
      noiseReason: cleanText(parsed.noiseReason) || fallbackNoiseReason(text),
      providerMode: "openai-compatible",
      model: candidateModel,
      fallbackUsed: false
    };
  });
}

// ---------------------------------------------------------------------------
// Image (Gemini vision) — validate + caption + categorize
// ---------------------------------------------------------------------------

export async function analyzeImageWithVertexAi(
  base64: string,
  mimeType: string,
  declaredLanguage?: string
): Promise<VertexMediaAnalysis> {
  const { model, enabled } = vertexConfig();
  if (!enabled) throw new AiInferenceError("Image analysis requires Vertex/Gemini multimodal configuration.");

  return withModelRetries("Vertex image analysis", vertexModelCandidates(model), async (candidateModel) => {
    const ai = await geminiClient();
    const prompt = [
      "You are a civic-issue validator for an Indian constituency platform.",
      "Look at the photo a citizen uploaded about a local development problem.",
      "Return only JSON: { isCivicIssue, category, normalizedText, mediaSummary, detectedLanguage, confidence }.",
      "isCivicIssue = true only if the image shows a genuine public/development problem",
      "(broken road, pothole, garbage, broken school/toilet, water leak, drainage, streetlight, etc).",
      "isCivicIssue = false for selfies, memes, unrelated, or unreadable/blurry images.",
      `category must be one of: ${categories.join(", ")}.`,
      "normalizedText = concise English problem statement a citizen would write for this photo.",
      "mediaSummary = short factual description of what is visible.",
      `Citizen's declared language: ${declaredLanguage ?? "unknown"}.`
    ].join("\n");

    const result = await ai.models.generateContent({
      model: candidateModel,
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
      config: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" }
    });
    const parsed = JSON.parse(result.text ?? "{}") as Partial<VertexMediaAnalysis>;
    const normalized = cleanText(parsed.normalizedText) || "Citizen-reported civic issue from photo.";
    return {
      isCivicIssue: parsed.isCivicIssue !== false,
      category: asCategory(parsed.category) ?? fallbackCategory(normalized),
      normalizedText: normalized,
      mediaSummary: cleanText(parsed.mediaSummary) || "Photo of a local civic issue.",
      detectedLanguage: cleanText(parsed.detectedLanguage) || declaredLanguage || "English",
      confidence: clampConfidence(parsed.confidence),
      providerMode: "vertex",
      model: candidateModel,
      fallbackUsed: false
    };
  });
}

// ---------------------------------------------------------------------------
// Audio (Gemini multimodal) — transcribe + language + categorize
// ---------------------------------------------------------------------------

export async function transcribeWithVertexAi(
  base64: string,
  mimeType: string,
  declaredLanguage?: string
): Promise<VertexMediaAnalysis> {
  const { model, enabled } = vertexConfig();
  if (!enabled) throw new AiInferenceError("Voice analysis requires Vertex/Gemini multimodal configuration.");

  return withModelRetries("Vertex voice analysis", vertexModelCandidates(model), async (candidateModel) => {
    const ai = await geminiClient();
    const prompt = [
      "You transcribe and analyze a voice note a citizen recorded about a local civic problem in India.",
      "The audio may be in Hindi, Tamil, Bangla, Marathi, English or another Indian language.",
      "Return only JSON: { transcript, normalizedText, category, mediaSummary, detectedLanguage, confidence }.",
      "transcript = faithful transcription in the original language.",
      "normalizedText = concise English version of the problem.",
      `category must be one of: ${categories.join(", ")}.`,
      "mediaSummary = one short English line summarizing the request.",
      `Citizen's declared language: ${declaredLanguage ?? "unknown"}.`
    ].join("\n");

    const result = await ai.models.generateContent({
      model: candidateModel,
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
      config: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" }
    });
    const parsed = JSON.parse(result.text ?? "{}") as Partial<VertexMediaAnalysis> & { transcript?: string };
    const transcript = cleanText(parsed.transcript);
    const normalized = cleanText(parsed.normalizedText) || transcript || "Citizen voice report.";
    return {
      isCivicIssue: true,
      category: asCategory(parsed.category) ?? fallbackCategory(normalized),
      normalizedText: normalized,
      mediaSummary: cleanText(parsed.mediaSummary) || transcript || "Voice note from a citizen.",
      detectedLanguage: cleanText(parsed.detectedLanguage) || declaredLanguage || "English",
      confidence: clampConfidence(parsed.confidence),
      providerMode: "vertex",
      model: candidateModel,
      fallbackUsed: false
    };
  });
}

// ---------------------------------------------------------------------------
// Parsing helpers and low-risk hints. These never replace failed AI inference.
// ---------------------------------------------------------------------------

async function withModelRetries<T>(label: string, models: string[], run: (model: string) => Promise<T>): Promise<T> {
  const attempts = Math.max(1, Number(process.env.AI_RETRY_ATTEMPTS ?? 2));
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await run(model);
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await delay(250 * attempt);
      }
    }
  }
  throw new AiInferenceError(`${label} failed after ${models.length * attempts} attempt(s) across ${models.join(", ")}.`, { cause: lastError });
}

function vertexModelCandidates(primary: string): string[] {
  return uniqueModels([
    primary,
    ...splitModels(process.env.VERTEX_AI_FALLBACK_MODELS),
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash"
  ]);
}

function compatibleModelCandidates(primary: string): string[] {
  return uniqueModels([primary, ...splitModels(process.env.OPENAI_COMPATIBLE_FALLBACK_MODELS)]);
}

function splitModels(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function uniqueModels(models: string[]): string[] {
  return [...new Set(models.filter(Boolean))];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fallbackLanguage(text: string, declaredLanguage?: string): string {
  if (/[஀-௿]/.test(text)) return "Tamil";
  if (/[ঀ-৿]/.test(text)) return "Bangla";
  if (/[ऀ-ॿ]/.test(text)) return declaredLanguage === "Marathi" ? "Marathi" : "Hindi";
  return declaredLanguage || "English";
}

function fallbackCategory(text: string): Category {
  const normalized = text.toLowerCase();
  if (/(school|classroom|teacher|toilet|student|bench|enrollment|स्कूल|कक्षा|शौचालय|छात्र)/.test(normalized)) return "Education";
  if (/(disaster|relief|flood|cyclone|storm|fire|rescue|shelter|food|ration|emergency|आपदा|राहत|बाढ़|चक्रवात|आग|बचाव)/.test(normalized)) return "Disaster Relief";
  if (/(road|pothole|street|bridge|traffic|ambulance|सड़क|गड्ढ|पुल|ट्रैफिक|बारिश)/.test(normalized)) return "Roads";
  if (/(clinic|hospital|doctor|medicine|elderly|opd|health|क्लिनिक|अस्पताल|डॉक्टर|दवा|बुजुर्ग)/.test(normalized)) return "Health";
  if (/(water|tap|tanker|drinking|pipeline|supply|पानी|नल|टैंकर|पेयजल|पाइपलाइन)/.test(normalized)) return "Water";
  if (/(garbage|waste|drain|sewer|toilet|cleaning|solid waste|litter|littering|trash|dumping|hotel waste|कचरा|नाली|सफाई)/.test(normalized)) return "Sanitation";
  if (/(streetlight|light|electricity|transformer|power|dark|बिजली|लाइट|अंधेरा)/.test(normalized)) return "Power";
  if (/(internet|network|mobile|tower|broadband|digital|signal|नेटवर्क|इंटरनेट)/.test(normalized)) return "Digital Access";
  return "Civic Services";
}

function fallbackNoiseReason(text: string): string | undefined {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 8) return "Issue text is too short to route.";
  if (/(hotel room|my room|bedroom|inside my house|private room|room service|restaurant bill|personal complaint)/.test(normalized)) {
    return "Looks like a private or non-public issue, not an addressable constituency problem.";
  }
  if (/(test only|asdf|random|hello|hi there|demo fake|lorem ipsum)/.test(normalized)) {
    return "Looks like test or low-quality input.";
  }
  return undefined;
}

function asCategory(value: unknown): Category | null {
  return categories.includes(value as Category) ? (value as Category) : null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.7;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
