export type RagDocumentInput = {
  tenantId?: string;
  namespace?: string;
  source: "pdf" | "docx" | "txt" | "markdown" | "csv" | "json" | "gcs" | "filesystem";
  sourceUri?: string;
  sourceUrl?: string;
  title?: string;
  mediaType?: string;
  content?: string;
  metadata?: Record<string, unknown>;
};

export type ChunkingOptions = {
  chunkSize: number;
  chunkOverlap: number;
  semanticChunking: boolean;
};

export type RagDocument = {
  id: string;
  tenantId: string;
  namespace: string;
  source: string;
  sourceUri?: string;
  sourceUrl?: string;
  title: string;
  mediaType: string;
  metadata: Record<string, unknown>;
  checksum: string;
  createdAt: string;
  updatedAt: string;
};

export type RagChunk = {
  id: string;
  documentId: string;
  tenantId: string;
  namespace: string;
  source: string;
  sourceUri?: string;
  sourceUrl?: string;
  title: string;
  page?: number;
  section?: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  checksum: string;
  createdAt: string;
  updatedAt: string;
};

export type RetrievalResult = RagChunk & {
  vectorScore: number;
  keywordScore: number;
  recencyScore: number;
  confidence: number;
};

export type RagQuery = {
  tenantId?: string;
  namespace?: string;
  question: string;
  topK?: number;
  similarityThreshold?: number;
  minimumConfidence?: number;
  metadata?: Record<string, unknown>;
  requireCitations?: boolean;
};

export type RagAnswer = {
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
  retrieved: RetrievalResult[];
  metrics: {
    embeddingLatencyMs: number;
    vectorSearchLatencyMs: number;
    llmLatencyMs: number;
    totalLatencyMs: number;
  };
  index: {
    documents: number;
    chunks: number;
    embeddings: number;
  };
  retrievalMode: string;
  orchestration?: {
    graph: "langgraph";
    tracing: "langsmith";
    context: "langchain-document";
    nodes: string[];
  };
};
