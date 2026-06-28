export type VertexTextAnalysis = {
  detectedLanguage: string;
  normalizedText: string;
  category: string;
  confidence: number;
};

const categories = ["Education", "Roads", "Health", "Water", "Civic Services"] as const;

export async function analyzeWithVertexAi(text: string, declaredLanguage?: string): Promise<VertexTextAnalysis> {
  const project = process.env.VERTEX_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION ?? "us-central1";
  const model = process.env.VERTEX_AI_MODEL ?? "gemini-1.5-flash";

  if (!project || process.env.VERTEX_AI_DISABLED === "true") {
    return fallbackAnalysis(text, declaredLanguage);
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      enterprise: true,
      project,
      location,
      apiVersion: "v1"
    });

    const prompt = [
      "Analyze a citizen civic-development submission for an Indian constituency platform.",
      "Return only JSON with detectedLanguage, normalizedText, category, confidence.",
      `Allowed category values: ${categories.join(", ")}.`,
      "normalizedText must be concise English preserving the citizen problem.",
      `Declared language: ${declaredLanguage ?? "unknown"}.`,
      `Submission: ${text}`
    ].join("\n");

    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json"
      }
    });
    const raw = result.text ?? "{}";
    const parsed = JSON.parse(raw) as Partial<VertexTextAnalysis>;

    return {
      detectedLanguage: cleanText(parsed.detectedLanguage) || fallbackLanguage(text, declaredLanguage),
      normalizedText: cleanText(parsed.normalizedText) || text.trim(),
      category: categories.includes(parsed.category as (typeof categories)[number]) ? parsed.category! : fallbackCategory(text),
      confidence: clampConfidence(parsed.confidence)
    };
  } catch {
    return fallbackAnalysis(text, declaredLanguage);
  }
}

export function fallbackAnalysis(text: string, declaredLanguage?: string): VertexTextAnalysis {
  return {
    detectedLanguage: fallbackLanguage(text, declaredLanguage),
    normalizedText: text.trim(),
    category: fallbackCategory(text),
    confidence: 0.62
  };
}

function fallbackLanguage(text: string, declaredLanguage?: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/[\u0980-\u09FF]/.test(text)) return "Bangla";
  if (/[\u0B80-\u0BFF]/.test(text)) return "Tamil";
  if (/[\u0900-\u097F]/.test(text) && declaredLanguage === "Marathi") return "Marathi";
  return declaredLanguage || "English";
}

function fallbackCategory(text: string): string {
  const normalized = text.toLowerCase();
  if (/(school|classroom|teacher|toilet|student|bench|enrollment|स्कूल|कक्षा|शौचालय|छात्र)/.test(normalized)) return "Education";
  if (/(road|pothole|street|bridge|traffic|ambulance|flood|सड़क|गड्ढ|पुल|ट्रैफिक|बारिश)/.test(normalized)) return "Roads";
  if (/(clinic|hospital|doctor|medicine|elderly|opd|health|क्लिनिक|अस्पताल|डॉक्टर|दवा|बुजुर्ग)/.test(normalized)) return "Health";
  if (/(water|tap|tanker|drinking|pipeline|supply|पानी|नल|टैंकर|पेयजल|पाइपलाइन)/.test(normalized)) return "Water";
  return "Civic Services";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.7;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
