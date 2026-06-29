import { Histogram, Gauge, Counter, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: "loksetu_rag_" });

export const requestLatency = new Histogram({
  name: "loksetu_rag_request_latency_ms",
  help: "RAG API request latency in milliseconds",
  labelNames: ["route", "status"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [registry]
});

export const stageLatency = new Histogram({
  name: "loksetu_rag_stage_latency_ms",
  help: "RAG pipeline stage latency in milliseconds",
  labelNames: ["stage"],
  buckets: [2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [registry]
});

export const indexedChunks = new Gauge({
  name: "loksetu_rag_indexed_chunks",
  help: "Indexed chunk count",
  registers: [registry]
});

export const indexedDocuments = new Gauge({
  name: "loksetu_rag_indexed_documents",
  help: "Indexed document count",
  registers: [registry]
});

export const cacheHits = new Counter({
  name: "loksetu_rag_embedding_cache_hits_total",
  help: "Embedding cache hits",
  registers: [registry]
});

export const retrievalMisses = new Counter({
  name: "loksetu_rag_retrieval_misses_total",
  help: "Queries that returned no indexed documents",
  registers: [registry]
});
