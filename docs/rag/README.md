# LokSetu Production RAG Platform

LokSetu RAG is a standalone retrieval platform backed by PostgreSQL + pgvector for local and GKE deployments. Production can switch embedding generation to Gemini Embeddings or OpenAI `text-embedding-3-large` through environment variables.

## Services

- `rag-api`: retrieval API, hybrid search, citations, metrics, health checks.
- `embedding-worker`: batches unchanged chunks, generates embeddings, and writes pgvector rows.
- `ingestion-worker`: parses documents, chunks content, extracts metadata, deduplicates by checksum, and indexes chunks.
- `vector-index`: pgvector-enabled PostgreSQL with HNSW cosine indexes.

## Failure Contract

If no indexed document passes retrieval thresholds, the answer is:

`No indexed documents match the query.`

The platform must not fall back to unrelated projects or seed records.

## APIs

- `POST /ingest`
- `POST /query`
- `POST /reindex`
- `GET /documents`
- `DELETE /documents/{id}`
- `GET /health`
- `GET /ready`
- `GET /live`
- `GET /metrics`

## Configuration

- `RAG_DATABASE_URL`: pgvector database connection string.
- `RAG_EMBEDDING_PROVIDER`: `gemini`, `openai`, or explicit local `hash`.
- `RAG_EMBEDDING_MODEL`: `gemini-embedding-001` or `text-embedding-3-large`.
- `RAG_TOP_K`, `RAG_SIMILARITY_THRESHOLD`, `RAG_MINIMUM_CONFIDENCE`.
- `RAG_CHUNK_SIZE`, `RAG_CHUNK_OVERLAP`, `RAG_SEMANTIC_CHUNKING`.
- `RAG_REQUIRE_CITATIONS=true` prevents uncited answers.
