import { ChunkingOptions } from "./types.js";

export function config() {
  const embeddingProvider = process.env.RAG_EMBEDDING_PROVIDER ?? (process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT ? "gemini" : "hash");
  const defaultSimilarityThreshold = embeddingProvider === "hash" ? 0.08 : 0.24;
  const defaultMinimumConfidence = embeddingProvider === "hash" ? 0.1 : 0.28;
  return {
    port: Number(process.env.PORT ?? 8090),
    databaseUrl: process.env.RAG_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
    tenantId: process.env.RAG_TENANT_ID ?? "loksetu",
    namespace: process.env.RAG_NAMESPACE ?? "india",
    embeddingProvider,
    embeddingModel: process.env.RAG_EMBEDDING_MODEL ?? (embeddingProvider === "openai" ? "text-embedding-3-large" : embeddingProvider === "gemini" ? "gemini-embedding-001" : "hashing-vectorizer-768"),
    embeddingDimensions: Number(process.env.RAG_EMBEDDING_DIMENSIONS ?? 768),
    vertexProject: process.env.VERTEX_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "",
    vertexLocation: process.env.VERTEX_AI_LOCATION ?? "us-central1",
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    llmProvider: process.env.RAG_LLM_PROVIDER ?? "extractive",
    llmModel: process.env.RAG_LLM_MODEL ?? process.env.VERTEX_AI_MODEL ?? "gemini-1.5-flash",
    topK: Number(process.env.RAG_TOP_K ?? 8),
    similarityThreshold: Number(process.env.RAG_SIMILARITY_THRESHOLD ?? defaultSimilarityThreshold),
    minimumConfidence: Number(process.env.RAG_MINIMUM_CONFIDENCE ?? defaultMinimumConfidence),
    requireCitations: process.env.RAG_REQUIRE_CITATIONS !== "false",
    chunking: {
      chunkSize: Number(process.env.RAG_CHUNK_SIZE ?? 900),
      chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP ?? 140),
      semanticChunking: process.env.RAG_SEMANTIC_CHUNKING === "true"
    } satisfies ChunkingOptions
  };
}
