import { config } from "./config.js";
import { chunksNeedingEmbeddings, indexStats, keywordSearch, upsertEmbedding, vectorSearch } from "./db.js";
import { embedText } from "./embeddings.js";
import { cacheHits, indexedChunks, indexedDocuments, retrievalMisses, stageLatency } from "./metrics.js";
import { RagAnswer, RagQuery, RetrievalResult } from "./types.js";

const noResultAnswer = "No indexed documents match the query.";

export async function embedPendingChunks(limit = 200) {
  const cfg = config();
  const pending = await chunksNeedingEmbeddings(cfg.embeddingProvider, cfg.embeddingModel, limit);
  let embedded = 0;
  for (const chunk of pending) {
    const embedding = await timeStage("embedding", () => embedText(`${chunk.title}\n${chunk.section ?? ""}\n${chunk.content}`));
    await upsertEmbedding({
      chunkId: chunk.id,
      tenantId: chunk.tenantId,
      namespace: chunk.namespace,
      provider: embedding.provider,
      model: embedding.model,
      dimensions: embedding.dimensions,
      embedding: embedding.embedding,
      contentChecksum: chunk.checksum
    });
    embedded += 1;
  }
  if (pending.length === 0) cacheHits.inc();
  return embedded;
}

export async function queryRag(input: RagQuery): Promise<RagAnswer> {
  const cfg = config();
  const started = Date.now();
  const tenantId = input.tenantId ?? cfg.tenantId;
  const namespace = input.namespace ?? cfg.namespace;
  const topK = input.topK ?? cfg.topK;
  const similarityThreshold = input.similarityThreshold ?? cfg.similarityThreshold;
  const minimumConfidence = input.minimumConfidence ?? cfg.minimumConfidence;
  const requireCitations = input.requireCitations ?? cfg.requireCitations;

  const embeddingStarted = Date.now();
  const queryEmbedding = await timeStage("embedding", () => embedText(input.question));
  const embeddingLatencyMs = Date.now() - embeddingStarted;

  const searchStarted = Date.now();
  const [semantic, keyword] = await Promise.all([
    timeStage("vector_search", () => vectorSearch({ tenantId, namespace, embedding: queryEmbedding.embedding, topK: topK * 2, metadata: input.metadata ?? {} })),
    timeStage("keyword_search", () => keywordSearch({ tenantId, namespace, query: input.question, topK: topK * 2, metadata: input.metadata ?? {} }))
  ]);
  const vectorSearchLatencyMs = Date.now() - searchStarted;
  const retrieved = rerank(semantic, keyword)
    .filter((item) => item.vectorScore >= similarityThreshold || item.keywordScore > 0)
    .filter((item) => item.confidence >= minimumConfidence)
    .filter((item) => isRelevantToQuery(input.question, item, similarityThreshold))
    .slice(0, topK);
  const stats = await indexStats(tenantId, namespace);
  indexedDocuments.set(stats.documents);
  indexedChunks.set(stats.chunks);

  if (retrieved.length === 0 || (requireCitations && retrieved.every((item) => !item.sourceUrl && !item.sourceUri))) {
    retrievalMisses.inc();
    return {
      answer: noResultAnswer,
      citations: [],
      retrieved: [],
      metrics: {
        embeddingLatencyMs,
        vectorSearchLatencyMs,
        llmLatencyMs: 0,
        totalLatencyMs: Date.now() - started
      },
      index: stats,
      retrievalMode: "pgvector-hybrid-no-match"
    };
  }

  const llmStarted = Date.now();
  const answer = await timeStage("llm", () => groundedAnswer(input.question, retrieved));
  const llmLatencyMs = Date.now() - llmStarted;

  return {
    answer,
    citations: retrieved.map((item) => ({
      documentId: item.documentId,
      chunkId: item.id,
      document: item.title,
      page: item.page,
      source: item.sourceUri ?? item.source,
      sourceUrl: item.sourceUrl ?? item.sourceUri,
      confidence: Number(item.confidence.toFixed(4))
    })),
    retrieved,
    metrics: {
      embeddingLatencyMs,
      vectorSearchLatencyMs,
      llmLatencyMs,
      totalLatencyMs: Date.now() - started
    },
    index: stats,
    retrievalMode: "pgvector-hybrid"
  };
}

export function rerank(semantic: RetrievalResult[], keyword: RetrievalResult[]) {
  const merged = new Map<string, RetrievalResult>();
  for (const item of semantic) merged.set(item.id, item);
  for (const item of keyword) {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? { ...existing, keywordScore: Math.max(existing.keywordScore, item.keywordScore), confidence: Math.max(existing.confidence, item.confidence) } : item);
  }
  return [...merged.values()]
    .map((item) => ({
      ...item,
      confidence: item.vectorScore * 0.68 + Math.min(item.keywordScore, 1) * 0.26 + item.recencyScore * 0.06
    }))
    .sort((a, b) => b.confidence - a.confidence || b.vectorScore - a.vectorScore || b.keywordScore - a.keywordScore);
}

export function isRelevantToQuery(question: string, item: RetrievalResult, similarityThreshold: number) {
  const queryTokens = meaningfulTokens(question);
  if (queryTokens.length === 0) return item.vectorScore >= similarityThreshold || item.keywordScore > 0;
  const contentTokens = new Set(meaningfulTokens(`${item.title} ${item.section ?? ""} ${item.content} ${JSON.stringify(item.metadata ?? {})}`));
  const overlap = queryTokens.filter((token) => contentTokens.has(token));
  if (overlap.length > 0 || item.keywordScore > 0.05) return true;
  return item.vectorScore >= Math.max(0.62, similarityThreshold * 6);
}

function meaningfulTokens(value: string) {
  const stopwords = new Set([
    "about", "after", "again", "also", "and", "are", "can", "could", "data", "did", "district", "do",
    "does", "for", "from", "give", "has", "have", "how", "into", "next", "officer", "please", "show",
    "should", "stat", "stats", "tell", "than", "that", "the", "then", "there", "this", "today", "what",
    "when", "where", "which", "why", "with", "would", "yesterday"
  ]);
  return [...new Set(value.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/s$/, ""))
    .filter((token) => token.length > 2 && !stopwords.has(token)))];
}

async function groundedAnswer(question: string, retrieved: RetrievalResult[]) {
  const cfg = config();
  if (cfg.llmProvider === "gemini" && cfg.vertexProject) {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ vertexai: true, project: cfg.vertexProject, location: cfg.vertexLocation, apiVersion: "v1" });
    const context = retrieved.map((item, index) => `[${index + 1}] ${item.title} page ${item.page ?? "n/a"} chunk ${item.id}\n${item.content}`).join("\n\n");
    const prompt = [
      "Answer only from the provided retrieved context.",
      "If the context is insufficient, say: No indexed documents match the query.",
      "Include concise facts and do not invent facts.",
      `Question: ${question}`,
      `Retrieved context:\n${context}`
    ].join("\n\n");
    const response = await ai.models.generateContent({
      model: cfg.llmModel,
      contents: prompt,
      config: { temperature: 0.1, maxOutputTokens: 700 }
    });
    return response.text?.trim() || extractiveAnswer(retrieved);
  }
  return extractiveAnswer(retrieved);
}

function extractiveAnswer(retrieved: RetrievalResult[]) {
  const facts = retrieved.slice(0, 5).flatMap((item, index) =>
    extractSentences(item.content)
      .slice(0, index === 0 ? 4 : 2)
      .map((sentence) => `- [${index + 1}] ${sentence}`)
  );
  if (facts.length === 0) return noResultAnswer;
  const sourceLines = retrieved.slice(0, 5).map((item, index) =>
    `- [${index + 1}] ${item.title}${item.page ? `, page ${item.page}` : ""}`
  );
  return [
    "## Grounded answer",
    ...facts,
    "",
    "## Sources",
    ...sourceLines
  ].join("\n");
}

function extractSentences(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized];
  return sentences
    .map((sentence) => sentence.replace(/^#+\s*/, "").trim())
    .filter(Boolean)
    .map((sentence) => sentence.length > 360 ? sentence.slice(0, 357).trimEnd() : sentence);
}

async function timeStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    stageLatency.labels(stage).observe(Date.now() - started);
  }
}
