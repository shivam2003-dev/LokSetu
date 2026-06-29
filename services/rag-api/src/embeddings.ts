import { config } from "./config.js";

export type EmbeddingResponse = {
  provider: string;
  model: string;
  dimensions: number;
  embedding: number[];
  latencyMs: number;
};

export async function embedText(text: string): Promise<EmbeddingResponse> {
  const cfg = config();
  const started = Date.now();
  if (cfg.embeddingProvider === "gemini") {
    const embedding = await geminiEmbedding(text, cfg.embeddingModel, cfg.vertexProject, cfg.vertexLocation);
    return { provider: "gemini", model: cfg.embeddingModel, dimensions: embedding.length, embedding: normalizeDimensions(embedding, cfg.embeddingDimensions), latencyMs: Date.now() - started };
  }
  if (cfg.embeddingProvider === "openai") {
    const embedding = await openAiEmbedding(text, cfg.embeddingModel, cfg.openAiApiKey, cfg.openAiBaseUrl);
    return { provider: "openai", model: cfg.embeddingModel, dimensions: embedding.length, embedding: normalizeDimensions(embedding, cfg.embeddingDimensions), latencyMs: Date.now() - started };
  }
  if (cfg.embeddingProvider === "hash") {
    const embedding = hashingVectorizer(text, cfg.embeddingDimensions);
    return { provider: "hash", model: cfg.embeddingModel, dimensions: embedding.length, embedding, latencyMs: Date.now() - started };
  }
  throw new Error(`Unsupported RAG_EMBEDDING_PROVIDER: ${cfg.embeddingProvider}`);
}

async function geminiEmbedding(text: string, model: string, project: string, location: string): Promise<number[]> {
  if (!project) throw new Error("VERTEX_AI_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required for Gemini embeddings");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ vertexai: true, project, location, apiVersion: "v1" });
  const response = await (ai.models as any).embedContent({ model, contents: text });
  const values = response?.embeddings?.[0]?.values ?? response?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini embedding response did not include numeric values");
  return values.map(Number);
}

async function openAiEmbedding(text: string, model: string, apiKey: string, baseUrl: string): Promise<number[]> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI embeddings");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, input: text })
  });
  if (!response.ok) throw new Error(`OpenAI embeddings failed: ${response.status}`);
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding) throw new Error("OpenAI embedding response did not include numeric values");
  return embedding;
}

function hashingVectorizer(text: string, dimensions: number) {
  const vector = new Array(dimensions).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\u0900-\u097f\s]/g, " ").split(/\s+/).filter((token) => token.length > 1);
  for (const token of tokens) {
    const hash = fnv1a(token);
    const index = Math.abs(hash) % dimensions;
    vector[index] += hash % 2 === 0 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

function normalizeDimensions(values: number[], dimensions: number) {
  const normalized = values.slice(0, dimensions);
  while (normalized.length < dimensions) normalized.push(0);
  const norm = Math.hypot(...normalized) || 1;
  return normalized.map((value) => value / norm);
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}
