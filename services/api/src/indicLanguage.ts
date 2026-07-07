export type IndicNormalization = {
  provider: "sarvam" | "bhashini";
  detectedLanguage: string;
  detectedLanguageCode?: string;
  normalizedText: string;
  transcript?: string;
  mediaSummary?: string;
  model: string;
  confidence?: number;
};

const languageNames: Record<string, string> = {
  "as-IN": "Assamese",
  "bn-IN": "Bengali",
  "brx-IN": "Bodo",
  "doi-IN": "Dogri",
  "en-IN": "English",
  "gu-IN": "Gujarati",
  "hi-IN": "Hindi",
  "kn-IN": "Kannada",
  "kok-IN": "Konkani",
  "ks-IN": "Kashmiri",
  "mai-IN": "Maithili",
  "ml-IN": "Malayalam",
  "mni-IN": "Manipuri",
  "mr-IN": "Marathi",
  "ne-IN": "Nepali",
  "od-IN": "Odia",
  "pa-IN": "Punjabi",
  "sa-IN": "Sanskrit",
  "sat-IN": "Santali",
  "sd-IN": "Sindhi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "ur-IN": "Urdu"
};

const declaredLanguageCodes: Record<string, string> = {
  assamese: "as-IN",
  bangla: "bn-IN",
  bengali: "bn-IN",
  bodo: "brx-IN",
  dogri: "doi-IN",
  english: "en-IN",
  gujarati: "gu-IN",
  hindi: "hi-IN",
  kannada: "kn-IN",
  konkani: "kok-IN",
  kashmiri: "ks-IN",
  maithili: "mai-IN",
  malayalam: "ml-IN",
  manipuri: "mni-IN",
  marathi: "mr-IN",
  nepali: "ne-IN",
  odia: "od-IN",
  oriya: "od-IN",
  punjabi: "pa-IN",
  sanskrit: "sa-IN",
  santali: "sat-IN",
  sindhi: "sd-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  urdu: "ur-IN"
};

type SarvamLanguageResponse = {
  language_code?: string | null;
  script_code?: string | null;
};

type SarvamTranslateResponse = {
  translated_text?: string;
  output?: string;
  text?: string;
  language_code?: string;
};

type SarvamSpeechResponse = {
  transcript?: string;
  text?: string;
  output?: string;
  translated_text?: string;
  language_code?: string;
  language?: string;
  language_probability?: number;
  confidence?: number;
};

export function indicRuntimeMode(): string {
  const providers = providerOrder().filter((provider) => {
    if (provider === "sarvam") return sarvamConfig().enabled;
    if (provider === "bhashini") return bhashiniConfig().enabled;
    return false;
  });
  return providers.length ? providers.join("+") : "vertex";
}

export async function normalizeIndicText(text: string, declaredLanguage?: string): Promise<IndicNormalization | null> {
  const input = text.trim();
  if (!input) return null;
  for (const provider of providerOrder()) {
    try {
      if (provider === "sarvam" && sarvamConfig().enabled) return await normalizeTextWithSarvam(input, declaredLanguage);
      if (provider === "bhashini" && bhashiniConfig().enabled) return await normalizeTextWithBhashini(input, declaredLanguage);
    } catch {
      // Provider chain continues to the next configured AI provider. Gemini still performs final classification.
    }
  }
  return null;
}

export async function transcribeIndicAudio(base64: string, mimeType: string, declaredLanguage?: string): Promise<IndicNormalization | null> {
  for (const provider of providerOrder()) {
    try {
      if (provider === "sarvam" && sarvamConfig().enabled) return await transcribeAudioWithSarvam(base64, mimeType, declaredLanguage);
      if (provider === "bhashini" && bhashiniConfig().enabled) return await transcribeAudioWithBhashini(base64, declaredLanguage);
    } catch {
      // Keep moving through the configured AI provider chain.
    }
  }
  return null;
}

/**
 * Translate a batch of English UI strings into the target language. Returns a
 * map keyed by the original English string; entries that cannot be translated
 * are omitted so the client falls back to English. Uses Sarvam's translate
 * endpoint (English -> target). Returns null when no provider is configured.
 */
export async function translateUiStrings(
  strings: string[],
  targetLanguage: string
): Promise<Record<string, string> | null> {
  const targetCode = languageCodeFromDeclared(targetLanguage);
  if (!targetCode || isEnglishCode(targetCode)) return null;
  const unique = Array.from(new Set(strings.map((item) => item.trim()).filter(Boolean)));
  if (!unique.length) return null;
  if (!sarvamConfig().enabled) return null;

  const result: Record<string, string> = {};
  // Translate strings in bounded-concurrency batches under an overall deadline.
  // Each string is translated in isolation (so keys never misalign), but running
  // a window in parallel keeps latency well under the gateway timeout — a fully
  // sequential loop over ~75 strings otherwise exceeds it (504). If the deadline
  // is hit we return whatever finished; the client caches partial results and
  // falls back to English for the rest, and unfinished languages are completed
  // on the next request.
  const concurrency = Math.max(1, Number(process.env.UI_TRANSLATION_CONCURRENCY ?? "10"));
  const deadlineMs = Math.max(1000, Number(process.env.UI_TRANSLATION_DEADLINE_MS ?? "20000"));
  const startedAt = nowMs();
  for (let i = 0; i < unique.length; i += concurrency) {
    if (nowMs() - startedAt > deadlineMs) break;
    const window = unique.slice(i, i + concurrency);
    await Promise.all(
      window.map(async (source) => {
        try {
          const translated = await translateSarvamText(source, "en-IN", targetCode);
          if (translated && translated.trim() && translated.trim() !== source) {
            result[source] = translated.trim();
          }
        } catch {
          // Skip this string; the client keeps the English original.
        }
      })
    );
  }
  return Object.keys(result).length ? result : null;
}

function nowMs(): number {
  return Date.now();
}

function providerOrder(): Array<"sarvam" | "bhashini"> {
  const configured = (process.env.INDIC_LANGUAGE_PROVIDER_ORDER ?? "sarvam,bhashini")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const providers = configured.filter((item): item is "sarvam" | "bhashini" => item === "sarvam" || item === "bhashini");
  return providers.length ? providers : ["sarvam", "bhashini"];
}

function sarvamConfig() {
  const apiKey = process.env.SARVAM_API_KEY ?? process.env.SARVAM_API_SUBSCRIPTION_KEY ?? "";
  const baseUrl = (process.env.SARVAM_API_BASE_URL ?? "https://api.sarvam.ai").replace(/\/$/, "");
  const translateModel = process.env.SARVAM_TRANSLATE_MODEL ?? "sarvam-translate:v1";
  const speechModel = process.env.SARVAM_SPEECH_MODEL ?? "saaras:v3";
  const enabled = Boolean(apiKey) && process.env.SARVAM_DISABLED !== "true" && process.env.AI_DISABLED !== "true";
  return { apiKey, baseUrl, translateModel, speechModel, enabled };
}

async function normalizeTextWithSarvam(text: string, declaredLanguage?: string): Promise<IndicNormalization> {
  const { translateModel } = sarvamConfig();
  const declaredCode = languageCodeFromDeclared(declaredLanguage);
  const detected = declaredCode ? { language_code: declaredCode } : await detectSarvamLanguage(text);
  const sourceCode = detected.language_code || declaredCode || "auto";
  const normalizedText = isEnglishCode(sourceCode) ? text : await translateSarvamText(text, sourceCode);
  return {
    provider: "sarvam",
    detectedLanguage: languageName(sourceCode, declaredLanguage),
    detectedLanguageCode: sourceCode === "auto" ? undefined : sourceCode,
    normalizedText: normalizedText || text,
    model: `sarvam:text-lid+${translateModel}`
  };
}

async function transcribeAudioWithSarvam(base64: string, mimeType: string, declaredLanguage?: string): Promise<IndicNormalization> {
  const { speechModel, translateModel } = sarvamConfig();
  const declaredCode = languageCodeFromDeclared(declaredLanguage) ?? "unknown";
  const transcription = await sarvamSpeechToText(base64, mimeType, "transcribe", declaredCode);
  const transcript = extractSarvamSpeechText(transcription);
  const detectedCode = transcription.language_code || transcription.language || (declaredCode === "unknown" ? undefined : declaredCode);
  let normalizedText = transcript && isEnglishCode(detectedCode) ? transcript : "";

  if (!normalizedText) {
    const translated = await sarvamSpeechToText(base64, mimeType, "translate", declaredCode);
    normalizedText = extractSarvamSpeechText(translated) || normalizedText || transcript;
  }

  if ((!normalizedText || normalizedText === transcript) && transcript && !isEnglishCode(detectedCode)) {
    normalizedText = await translateSarvamText(transcript, detectedCode ?? "auto");
  }

  return {
    provider: "sarvam",
    detectedLanguage: languageName(detectedCode, declaredLanguage),
    detectedLanguageCode: detectedCode,
    normalizedText: normalizedText || transcript || "Voice note submitted for AI classification.",
    transcript,
    mediaSummary: transcript ? `Voice transcript: ${transcript}` : "Voice note transcribed by Sarvam.",
    model: `sarvam:${speechModel}+${translateModel}`,
    confidence: transcription.confidence ?? transcription.language_probability
  };
}

async function detectSarvamLanguage(text: string): Promise<SarvamLanguageResponse> {
  const { baseUrl } = sarvamConfig();
  return sarvamJson<SarvamLanguageResponse>(`${baseUrl}/text-lid`, {
    method: "POST",
    headers: sarvamJsonHeaders(),
    body: JSON.stringify({ input: text.slice(0, 1000) })
  });
}

async function translateSarvamText(
  text: string,
  sourceLanguageCode: string,
  targetLanguageCode = "en-IN"
): Promise<string> {
  const { baseUrl, translateModel } = sarvamConfig();
  const chunks = chunkText(text, 1800);
  const translated: string[] = [];
  for (const chunk of chunks) {
    const response = await sarvamJson<SarvamTranslateResponse>(`${baseUrl}/translate`, {
      method: "POST",
      headers: sarvamJsonHeaders(),
      body: JSON.stringify({
        input: chunk,
        source_language_code: sourceLanguageCode,
        target_language_code: targetLanguageCode,
        model: translateModel,
        mode: "formal"
      })
    });
    translated.push(response.translated_text || response.output || response.text || chunk);
  }
  return translated.join(" ").trim();
}

async function sarvamSpeechToText(base64: string, mimeType: string, mode: "transcribe" | "translate", languageCode: string): Promise<SarvamSpeechResponse> {
  const { baseUrl, speechModel } = sarvamConfig();
  const body = new FormData();
  body.set("file", new Blob([Buffer.from(base64, "base64")], { type: mimeType }), fileNameForMime(mimeType));
  body.set("model", speechModel);
  body.set("mode", mode);
  if (languageCode !== "unknown") body.set("language_code", languageCode);
  return sarvamJson<SarvamSpeechResponse>(`${baseUrl}/speech-to-text`, {
    method: "POST",
    headers: sarvamAuthHeaders(),
    body
  });
}

async function sarvamJson<T>(url: string, init: RequestInit): Promise<T> {
  return requestJsonWithRetry<T>(url, init, "Sarvam");
}

function sarvamJsonHeaders(): Record<string, string> {
  return { ...sarvamAuthHeaders(), "Content-Type": "application/json" };
}

function sarvamAuthHeaders(): Record<string, string> {
  const { apiKey } = sarvamConfig();
  return { "api-subscription-key": apiKey };
}

function bhashiniConfig() {
  const computeUrl = process.env.BHASHINI_PIPELINE_COMPUTE_URL ?? "";
  const authHeader = process.env.BHASHINI_AUTH_HEADER ?? "Authorization";
  const authValue = process.env.BHASHINI_AUTH_VALUE ?? process.env.BHASHINI_API_KEY ?? "";
  const translationServiceId = process.env.BHASHINI_TRANSLATION_SERVICE_ID ?? "";
  const asrServiceId = process.env.BHASHINI_ASR_SERVICE_ID ?? "";
  const enabled = Boolean(computeUrl && authValue) && process.env.BHASHINI_DISABLED !== "true" && process.env.AI_DISABLED !== "true";
  return { computeUrl, authHeader, authValue, translationServiceId, asrServiceId, enabled };
}

async function normalizeTextWithBhashini(text: string, declaredLanguage?: string): Promise<IndicNormalization | null> {
  const sourceLanguage = bhashiniLanguageFromDeclared(declaredLanguage);
  if (!sourceLanguage || sourceLanguage === "en") return null;
  const { translationServiceId } = bhashiniConfig();
  const response = await bhashiniCompute({
    pipelineTasks: [
      {
        taskType: "translation",
        config: { language: { sourceLanguage, targetLanguage: "en" }, ...(translationServiceId ? { serviceId: translationServiceId } : {}) }
      }
    ],
    inputData: { input: [{ source: text }] }
  });
  const normalizedText = extractBhashiniTarget(response) || text;
  return {
    provider: "bhashini",
    detectedLanguage: languageName(`${sourceLanguage}-IN`, declaredLanguage),
    detectedLanguageCode: `${sourceLanguage}-IN`,
    normalizedText,
    model: `bhashini:translation${translationServiceId ? `:${translationServiceId}` : ""}`
  };
}

async function transcribeAudioWithBhashini(base64: string, declaredLanguage?: string): Promise<IndicNormalization | null> {
  const sourceLanguage = bhashiniLanguageFromDeclared(declaredLanguage);
  if (!sourceLanguage) return null;
  const { asrServiceId, translationServiceId } = bhashiniConfig();
  const response = await bhashiniCompute({
    pipelineTasks: [
      {
        taskType: "asr",
        config: { language: { sourceLanguage }, ...(asrServiceId ? { serviceId: asrServiceId } : {}) }
      },
      {
        taskType: "translation",
        config: { language: { sourceLanguage, targetLanguage: "en" }, ...(translationServiceId ? { serviceId: translationServiceId } : {}) }
      }
    ],
    inputData: { audio: [{ audioContent: base64 }] }
  });
  const transcript = extractBhashiniSource(response);
  const normalizedText = extractBhashiniTarget(response) || transcript;
  return {
    provider: "bhashini",
    detectedLanguage: languageName(`${sourceLanguage}-IN`, declaredLanguage),
    detectedLanguageCode: `${sourceLanguage}-IN`,
    normalizedText: normalizedText || "Voice note submitted for AI classification.",
    transcript,
    mediaSummary: transcript ? `Voice transcript: ${transcript}` : "Voice note transcribed by Bhashini.",
    model: `bhashini:asr+translation`
  };
}

async function bhashiniCompute(payload: unknown): Promise<unknown> {
  const { computeUrl, authHeader, authValue } = bhashiniConfig();
  return requestJsonWithRetry(computeUrl, {
    method: "POST",
    headers: {
      [authHeader]: authValue,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }, "Bhashini");
}

async function requestJsonWithRetry<T>(url: string, init: RequestInit, label: string): Promise<T> {
  const attempts = Math.max(1, Number(process.env.INDIC_AI_RETRY_ATTEMPTS ?? process.env.AI_RETRY_ATTEMPTS ?? 2));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`${label} request failed with ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(250 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} request failed`);
}

function extractSarvamSpeechText(response: SarvamSpeechResponse): string {
  return clean(response.transcript) || clean(response.translated_text) || clean(response.output) || clean(response.text);
}

function extractBhashiniTarget(response: unknown): string {
  const items = bhashiniOutputs(response);
  return clean(items.find((item) => clean(item.target))?.target);
}

function extractBhashiniSource(response: unknown): string {
  const items = bhashiniOutputs(response);
  return clean(items.find((item) => clean(item.source))?.source);
}

function bhashiniOutputs(response: unknown): Array<{ source?: string; target?: string }> {
  const payload = response as { pipelineResponse?: Array<{ output?: Array<{ source?: string; target?: string }> }> };
  return payload.pipelineResponse?.flatMap((entry) => entry.output ?? []) ?? [];
}

function languageCodeFromDeclared(language?: string): string | undefined {
  const trimmed = language?.trim();
  if (!trimmed || trimmed.toLowerCase() === "auto") return undefined;
  if (/^[a-z]{2,3}-IN$/i.test(trimmed)) return canonicalLanguageCode(trimmed);
  return declaredLanguageCodes[trimmed.toLowerCase()];
}

function bhashiniLanguageFromDeclared(language?: string): string | undefined {
  const code = languageCodeFromDeclared(language);
  return code?.split("-")[0];
}

function languageName(code?: string, declaredLanguage?: string): string {
  if (code && code !== "auto" && code !== "unknown") {
    return languageNames[canonicalLanguageCode(code)] ?? declaredLanguage ?? code;
  }
  return declaredLanguage?.trim() || "Auto-detected Indian language";
}

function canonicalLanguageCode(code: string): string {
  const [lang] = code.split("-");
  return `${lang.toLowerCase()}-IN`;
}

function isEnglishCode(code?: string): boolean {
  return Boolean(code && canonicalLanguageCode(code) === "en-IN");
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    const splitAt = Math.max(rest.lastIndexOf(" ", size), Math.floor(size * 0.8));
    chunks.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function fileNameForMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "voice.webm";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "voice.mp3";
  if (mimeType.includes("wav")) return "voice.wav";
  if (mimeType.includes("ogg")) return "voice.ogg";
  return "voice.audio";
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
