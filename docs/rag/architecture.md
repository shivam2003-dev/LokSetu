# RAG Architecture

```mermaid
flowchart LR
  Sources[PDF DOCX TXT MD CSV JSON GCS filesystem] --> Ingest[ingestion-worker]
  Ingest --> Parse[parse clean metadata checksum]
  Parse --> Chunk[configurable chunking]
  Chunk --> PG[(pgvector PostgreSQL)]
  Emb[embedding-worker] --> PG
  PG --> Emb
  API[rag-api] --> EmbedQ[query embedding]
  EmbedQ --> Vector[pgvector cosine HNSW]
  API --> Keyword[Postgres full-text search]
  Vector --> Merge[hybrid merge rerank]
  Keyword --> Merge
  Merge --> Gate[threshold and citation gate]
  Gate -->|match| Answer[grounded answer + citations]
  Gate -->|no match| NoMatch[No indexed documents match the query.]
  LokSetu[people-priority-api Copilot] --> API
```

## Storage Model

- `rag_documents`: tenant, namespace, source URI, title, checksum, metadata.
- `rag_chunks`: document chunk, page, section, metadata, checksum, tsvector.
- `rag_embeddings`: one vector per chunk, provider, model, dimensions, checksum.
- `rag_ingestion_jobs`: batch observability.
- `rag_eval_runs`: evaluation metrics.

## Retrieval

1. Generate query embedding.
2. Run pgvector cosine search.
3. Run PostgreSQL keyword search.
4. Apply tenant, namespace, and metadata filters.
5. Merge semantic and keyword hits.
6. Rerank with vector score, keyword score, and recency.
7. Enforce minimum confidence and citation requirement.
8. Assemble grounded answer from retrieved chunks only.
