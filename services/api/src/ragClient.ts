export type RagQueryResponse = {
  answer: string;
  citations: Array<{
    documentId: string;
    chunkId: string;
    document: string;
    page?: number;
    source?: string;
    sourceUrl?: string;
    confidence: number;
  }>;
  retrieved: Array<{
    id: string;
    title: string;
    source: string;
    sourceUri?: string;
    sourceUrl?: string;
    page?: number;
    content: string;
    confidence: number;
  }>;
  metrics: {
    embeddingLatencyMs: number;
    vectorSearchLatencyMs: number;
    llmLatencyMs: number;
    totalLatencyMs: number;
  };
  index?: {
    documents: number;
    chunks: number;
    embeddings: number;
  };
  retrievalMode: string;
};

export async function queryRagService(input: {
  question: string;
  tenantId?: string;
  namespace?: string;
  metadata?: Record<string, unknown>;
}): Promise<RagQueryResponse | null> {
  const baseUrl = process.env.RAG_API_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;
  const response = await fetch(`${baseUrl}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId: input.tenantId ?? process.env.RAG_TENANT_ID ?? "loksetu",
      namespace: input.namespace ?? process.env.RAG_NAMESPACE ?? "india",
      question: input.question,
      metadata: input.metadata,
      topK: Number(process.env.RAG_TOP_K ?? 8),
      similarityThreshold: Number(process.env.RAG_SIMILARITY_THRESHOLD ?? 0.24),
      minimumConfidence: Number(process.env.RAG_MINIMUM_CONFIDENCE ?? 0.28),
      requireCitations: true
    })
  });
  if (!response.ok) throw new Error(`RAG service query failed: ${response.status}`);
  return response.json() as Promise<RagQueryResponse>;
}

export async function ragServiceStatus() {
  const baseUrl = process.env.RAG_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return {
      mode: "not-configured",
      productionTarget: "pgvector local or Vertex AI RAG Engine / Vector Search",
      embeddingStore: "none",
      corpusDocuments: 0,
      bySource: {},
      privacy: "RAG service is not configured",
      refreshCadence: "none"
    };
  }
  const response = await fetch(`${baseUrl}/documents`);
  if (!response.ok) throw new Error(`RAG service status failed: ${response.status}`);
  const payload = await response.json() as { documents: Array<{ source: string }>; stats: { documents: number; chunks: number; embeddings: number } };
  return {
    mode: "pgvector-hybrid",
    productionTarget: "Vertex AI RAG Engine or Vertex AI Vector Search",
    embeddingStore: "postgres-pgvector-hnsw",
    corpusDocuments: payload.stats.chunks,
    bySource: payload.documents.reduce<Record<string, number>>((acc, document) => {
      acc[document.source] = (acc[document.source] ?? 0) + 1;
      return acc;
    }, {}),
    privacy: "citizen aliases and approved public datasets only",
    refreshCadence: "ingestion-worker plus embedding-worker"
  };
}
