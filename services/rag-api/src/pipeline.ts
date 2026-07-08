import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { Document } from "langchain";
import { traceable } from "langsmith/traceable";
import { config } from "./config.js";
import { chunksNeedingEmbeddings, indexStats, keywordSearch, upsertEmbedding, vectorSearch } from "./db.js";
import { embedText } from "./embeddings.js";
import { cacheHits, indexedChunks, indexedDocuments, retrievalMisses, stageLatency } from "./metrics.js";
import { RagAnswer, RagQuery, RetrievalResult } from "./types.js";

const noResultAnswer = "No indexed documents match the query.";
const graphNodes = ["embed_query", "hybrid_retrieve", "rerank_context", "evaluate_retrieval", "grounded_answer"];
type CragAction = "correct" | "ambiguous" | "incorrect";

type RagConfig = ReturnType<typeof config>;
type RagIndexStats = RagAnswer["index"];

const RagGraphState = Annotation.Root({
  input: Annotation<RagQuery>(),
  cfg: Annotation<RagConfig>(),
  startedAt: Annotation<number>(),
  tenantId: Annotation<string>(),
  namespace: Annotation<string>(),
  topK: Annotation<number>(),
  similarityThreshold: Annotation<number>(),
  minimumConfidence: Annotation<number>(),
  requireCitations: Annotation<boolean>(),
  queryEmbedding: Annotation<number[]>(),
  embeddingLatencyMs: Annotation<number>(),
  vectorSearchLatencyMs: Annotation<number>(),
  semantic: Annotation<RetrievalResult[]>({ reducer: (_left, right) => right, default: () => [] }),
  keyword: Annotation<RetrievalResult[]>({ reducer: (_left, right) => right, default: () => [] }),
  retrieved: Annotation<RetrievalResult[]>({ reducer: (_left, right) => right, default: () => [] }),
  contextDocuments: Annotation<Document[]>({ reducer: (_left, right) => right, default: () => [] }),
  cragAction: Annotation<CragAction>(),
  cragReason: Annotation<string>(),
  stats: Annotation<RagIndexStats>(),
  answer: Annotation<string>(),
  llmLatencyMs: Annotation<number>()
});

type RagGraphStateType = typeof RagGraphState.State;

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
  return tracedRunRagGraph(input);
}

const embedQueryNode = traceable(async (state: RagGraphStateType) => {
  const embeddingStarted = Date.now();
  const queryEmbedding = await timeStage("embedding", () => embedText(state.input.question));
  return {
    queryEmbedding: queryEmbedding.embedding,
    embeddingLatencyMs: Date.now() - embeddingStarted
  };
}, {
  name: "loksetu.rag.embed_query",
  run_type: "chain",
  tags: ["loksetu", "rag", "langgraph", "embedding"],
  processInputs: (inputs) => {
    const state = inputs;
    return { question: state.input.question.slice(0, 240), provider: state.cfg.embeddingProvider, model: state.cfg.embeddingModel };
  },
  processOutputs: (outputs) => ({ embeddingLatencyMs: outputs.embeddingLatencyMs })
});

const hybridRetrieveNode = traceable(async (state: RagGraphStateType) => {
  const searchStarted = Date.now();
  const [semantic, keyword] = await Promise.all([
    timeStage("vector_search", () => vectorSearch({ tenantId: state.tenantId, namespace: state.namespace, embedding: state.queryEmbedding, topK: state.topK * 2, metadata: state.input.metadata ?? {} })),
    timeStage("keyword_search", () => keywordSearch({ tenantId: state.tenantId, namespace: state.namespace, query: state.input.question, topK: state.topK * 2, metadata: state.input.metadata ?? {} }))
  ]);
  return {
    semantic,
    keyword,
    vectorSearchLatencyMs: Date.now() - searchStarted
  };
}, {
  name: "loksetu.rag.hybrid_retrieve",
  run_type: "retriever",
  tags: ["loksetu", "rag", "pgvector", "hybrid"],
  processInputs: (inputs) => {
    const state = inputs;
    return { tenantId: state.tenantId, namespace: state.namespace, topK: state.topK, metadata: state.input.metadata ?? {} };
  },
  processOutputs: (outputs) => ({ semantic: outputs.semantic.length, keyword: outputs.keyword.length, vectorSearchLatencyMs: outputs.vectorSearchLatencyMs })
});

const rerankContextNode = traceable(async (state: RagGraphStateType) => {
  const retrieved = rerank(state.semantic, state.keyword)
    .filter((item) => item.vectorScore >= state.similarityThreshold || item.keywordScore > 0)
    .filter((item) => item.confidence >= state.minimumConfidence)
    .filter((item) => isRelevantToQuery(state.input.question, item, state.similarityThreshold))
    .slice(0, state.topK);
  const stats = await indexStats(state.tenantId, state.namespace);
  indexedDocuments.set(stats.documents);
  indexedChunks.set(stats.chunks);
  return {
    retrieved,
    contextDocuments: toLangChainDocuments(retrieved),
    stats
  };
}, {
  name: "loksetu.rag.rerank_context",
  run_type: "chain",
  tags: ["loksetu", "rag", "langchain-document"],
  processInputs: (inputs) => {
    const state = inputs;
    return { semantic: state.semantic.length, keyword: state.keyword.length, minimumConfidence: state.minimumConfidence };
  },
  processOutputs: (outputs) => ({ retrieved: outputs.retrieved.length, documents: outputs.stats.documents, chunks: outputs.stats.chunks })
});

const evaluateRetrievalNode = traceable(async (state: RagGraphStateType) => {
  const evaluation = evaluateRetrievalQuality(state.input.question, state.retrieved, state.minimumConfidence);
  return {
    cragAction: evaluation.action,
    cragReason: evaluation.reason,
    retrieved: evaluation.action === "incorrect" ? [] : state.retrieved,
    contextDocuments: evaluation.action === "incorrect" ? [] : state.contextDocuments
  };
}, {
  name: "loksetu.rag.evaluate_retrieval",
  run_type: "chain",
  tags: ["loksetu", "rag", "crag", "retrieval-evaluator"],
  processInputs: (inputs) => {
    const state = inputs;
    return { question: state.input.question.slice(0, 240), retrieved: state.retrieved.length, minimumConfidence: state.minimumConfidence };
  },
  processOutputs: (outputs) => ({ action: outputs.cragAction, reason: outputs.cragReason })
});

const groundedAnswerNode = traceable(async (state: RagGraphStateType) => {
  if (state.cragAction === "incorrect" || state.retrieved.length === 0 || (state.requireCitations && state.retrieved.every((item) => !item.sourceUrl && !item.sourceUri))) {
    retrievalMisses.inc();
    return {
      answer: noResultAnswer,
      llmLatencyMs: 0
    };
  }
  const llmStarted = Date.now();
  const answer = await timeStage("llm", () => groundedAnswer(state.input.question, state.contextDocuments, state.retrieved));
  return {
    answer,
    llmLatencyMs: Date.now() - llmStarted
  };
}, {
  name: "loksetu.rag.grounded_answer",
  run_type: "llm",
  tags: ["loksetu", "rag", "grounded"],
  processInputs: (inputs) => {
    const state = inputs;
    return { question: state.input.question.slice(0, 240), retrieved: state.retrieved.length, llmProvider: state.cfg.llmProvider, llmModel: state.cfg.llmModel };
  },
  processOutputs: (outputs) => ({ answerLength: outputs.answer.length, llmLatencyMs: outputs.llmLatencyMs })
});

const ragGraph = new StateGraph(RagGraphState)
  .addNode("embed_query", async (state: RagGraphStateType) => embedQueryNode(state))
  .addNode("hybrid_retrieve", async (state: RagGraphStateType) => hybridRetrieveNode(state))
  .addNode("rerank_context", async (state: RagGraphStateType) => rerankContextNode(state))
  .addNode("evaluate_retrieval", async (state: RagGraphStateType) => evaluateRetrievalNode(state))
  .addNode("grounded_answer", async (state: RagGraphStateType) => groundedAnswerNode(state))
  .addEdge(START, "embed_query")
  .addEdge("embed_query", "hybrid_retrieve")
  .addEdge("hybrid_retrieve", "rerank_context")
  .addEdge("rerank_context", "evaluate_retrieval")
  .addEdge("evaluate_retrieval", "grounded_answer")
  .addEdge("grounded_answer", END)
  .compile();

const tracedRunRagGraph = traceable(async (input: RagQuery): Promise<RagAnswer> => {
  const cfg = config();
  const started = Date.now();
  const tenantId = input.tenantId ?? cfg.tenantId;
  const namespace = input.namespace ?? cfg.namespace;
  const topK = input.topK ?? cfg.topK;
  const similarityThreshold = input.similarityThreshold ?? cfg.similarityThreshold;
  const minimumConfidence = input.minimumConfidence ?? cfg.minimumConfidence;
  const requireCitations = input.requireCitations ?? cfg.requireCitations;

  const state = await ragGraph.invoke({
    input,
    cfg,
    startedAt: started,
    tenantId,
    namespace,
    topK,
    similarityThreshold,
    minimumConfidence,
    requireCitations
  });

  if (state.retrieved.length === 0 || state.answer === noResultAnswer) {
    return {
      answer: noResultAnswer,
      citations: [],
      retrieved: [],
      metrics: {
        embeddingLatencyMs: state.embeddingLatencyMs,
        vectorSearchLatencyMs: state.vectorSearchLatencyMs,
        llmLatencyMs: 0,
        totalLatencyMs: Date.now() - started
      },
      index: state.stats,
      retrievalMode: "pgvector-hybrid-crag-no-match",
      orchestration: orchestrationMeta()
    };
  }

  return {
    answer: state.answer,
    citations: state.retrieved.map((item) => ({
      documentId: item.documentId,
      chunkId: item.id,
      document: item.title,
      page: item.page,
      source: item.sourceUri ?? item.source,
      sourceUrl: item.sourceUrl ?? item.sourceUri,
      confidence: Number(item.confidence.toFixed(4))
    })),
    retrieved: state.retrieved,
    metrics: {
      embeddingLatencyMs: state.embeddingLatencyMs,
      vectorSearchLatencyMs: state.vectorSearchLatencyMs,
      llmLatencyMs: state.llmLatencyMs,
      totalLatencyMs: Date.now() - started
    },
    index: state.stats,
    retrievalMode: state.cragAction === "ambiguous" ? "pgvector-hybrid-crag-ambiguous" : "pgvector-hybrid-crag",
    orchestration: orchestrationMeta()
  };
}, {
  name: "loksetu.rag.langgraph_query",
  run_type: "chain",
  tags: ["loksetu", "rag", "langgraph", "langsmith", "langchain"],
  processInputs: (inputs) => {
    const query = inputs;
    return { question: query.question.slice(0, 240), tenantId: query.tenantId, namespace: query.namespace, metadata: query.metadata ?? {} };
  },
  processOutputs: (outputs) => ({
    retrievalMode: outputs.retrievalMode,
    retrieved: outputs.retrieved.length,
    citations: outputs.citations.length,
    graph: outputs.orchestration?.graph
  })
});

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

export function evaluateRetrievalQuality(question: string, retrieved: RetrievalResult[], minimumConfidence: number): { action: CragAction; reason: string } {
  if (!retrieved.length) return { action: "incorrect", reason: "no retrieved chunks survived relevance filtering" };
  const queryTokens = meaningfulTokens(question);
  const best = retrieved[0];
  const bestOverlap = queryTokens.length ? tokenOverlapRatio(queryTokens, `${best.title} ${best.section ?? ""} ${best.content} ${JSON.stringify(best.metadata ?? {})}`) : 1;
  const hasStrongEvidence = best.confidence >= Math.max(minimumConfidence, 0.42) && (bestOverlap >= 0.18 || best.keywordScore > 0.12);
  const hasUsableEvidence = best.confidence >= minimumConfidence && (bestOverlap > 0 || best.keywordScore > 0.04 || best.vectorScore >= 0.62);
  if (hasStrongEvidence) return { action: "correct", reason: `best chunk confidence ${best.confidence.toFixed(2)} with query overlap ${bestOverlap.toFixed(2)}` };
  if (hasUsableEvidence) return { action: "ambiguous", reason: `weak but usable retrieval confidence ${best.confidence.toFixed(2)} with query overlap ${bestOverlap.toFixed(2)}` };
  return { action: "incorrect", reason: `retrieval confidence ${best.confidence.toFixed(2)} or query overlap ${bestOverlap.toFixed(2)} too low` };
}

function tokenOverlapRatio(queryTokens: string[], value: string) {
  if (!queryTokens.length) return 1;
  const contentTokens = new Set(meaningfulTokens(value));
  return queryTokens.filter((token) => contentTokens.has(token)).length / queryTokens.length;
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

async function groundedAnswer(question: string, contextDocuments: Document[], retrieved: RetrievalResult[]) {
  const cfg = config();
  if (cfg.llmProvider === "gemini" && cfg.vertexProject) {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ vertexai: true, project: cfg.vertexProject, location: cfg.vertexLocation, apiVersion: "v1" });
    const context = contextDocuments.map((document, index) =>
      `[${index + 1}] ${String(document.metadata.title)} page ${String(document.metadata.page ?? "n/a")} chunk ${String(document.metadata.chunkId)}\n${document.pageContent}`
    ).join("\n\n");
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
    return response.text?.trim() || extractiveAnswer(retrieved, question);
  }
  return extractiveAnswer(retrieved, question);
}

function toLangChainDocuments(retrieved: RetrievalResult[]) {
  return retrieved.map((item) => new Document({
    pageContent: item.content,
    metadata: {
      chunkId: item.id,
      documentId: item.documentId,
      title: item.title,
      page: item.page,
      section: item.section,
      source: item.sourceUri ?? item.source,
      sourceUrl: item.sourceUrl ?? item.sourceUri,
      confidence: item.confidence
    }
  }));
}

function orchestrationMeta(): NonNullable<RagAnswer["orchestration"]> {
  return {
    graph: "langgraph",
    tracing: "langsmith",
    context: "langchain-document",
    nodes: graphNodes
  };
}

function extractiveAnswer(retrieved: RetrievalResult[], question = "") {
  const queryTokens = meaningfulTokens(question);
  const rankedSentences = retrieved.slice(0, 5).flatMap((item, index) =>
    extractSentences(item.content)
      .map((sentence, sentenceIndex) => ({
        sentence,
        citationIndex: index + 1,
        score: sentenceScore(sentence, queryTokens) + Math.max(0, 5 - index) * 0.01 - sentenceIndex * 0.001
      }))
  )
    .filter((item) => queryTokens.length === 0 || item.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const facts = rankedSentences.map((item) => `- [${item.citationIndex}] ${item.sentence}`);
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
  const normalized = content
    .replace(/#{1,6}\s+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized];
  return sentences
    .map((sentence) => sentence.replace(/^#+\s*/, "").trim())
    .filter(Boolean)
    .map((sentence) => sentence.length > 360 ? sentence.slice(0, 357).trimEnd() : sentence);
}

function sentenceScore(sentence: string, queryTokens: string[]) {
  if (queryTokens.length === 0) return 1;
  const sentenceTokens = new Set(meaningfulTokens(sentence));
  return queryTokens.reduce((score, token) => score + (sentenceTokens.has(token) ? 1 : 0), 0);
}

async function timeStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    stageLatency.labels(stage).observe(Date.now() - started);
  }
}
