# LokSetu RAG Architecture And Technical Build Notes
Source title: LokSetu RAG architecture and technical implementation
Source URL: file:///app/services/rag-api/fixtures/loksetu/rag-architecture.md
Region: India
Dataset type: technical architecture
Namespace: india

## Purpose

LokSetu uses retrieval augmented generation so the Copilot can answer constituency, public-feedback, project, source-coverage, and platform-architecture questions from indexed evidence instead of relying only on model memory. The RAG path is designed for privacy-safe civic intelligence: citizen identities are not exposed, retrieved chunks keep citations, and answers are grounded in indexed LokSetu records.

## Runtime components

The RAG runtime has four Kubernetes components. The API service exposes `/query`, `/ingest`, `/documents`, `/stats`, `/ready`, and `/metrics`. The ingestion worker reads configured source paths from `RAG_INGEST_PATHS` and indexes markdown, text, CSV, JSON, PDF, DOCX, filesystem, or GCS documents. The embedding worker embeds chunks that are missing vectors. The main LokSetu API calls the RAG API from the Copilot adapter and also indexes processed citizen submissions after each batch run.

## Data model

The RAG database is Postgres with pgvector. `rag_documents` stores document metadata, source URI, title, checksum, tenant, and namespace. `rag_chunks` stores semantic or fixed-size chunks plus tsvector keyword data. `rag_embeddings` stores the vector for each chunk, embedding provider, model, dimensions, and checksum. `rag_ingestion_jobs` and `rag_query_logs` are reserved for ingestion and query audit trails.

## Ingestion flow

Static knowledge enters through `services/rag-api/fixtures/...` and the ingestion worker. Production or external documents can be mounted from files, loaded from GCS, or pushed through `/ingest`. Citizen reports enter through Apni Awaaz or simulation APIs, are queued in `raw_intake`, processed by the batch worker with Vertex AI, stored in `submissions`, and then sent to RAG as `txt` documents with metadata such as state, district, ward, category, MP, channel, privacy mode, and processed timestamp.

## Chunking and retrieval

Documents are parsed, normalized, chunked, and stored with stable checksums. Semantic chunking uses headings when enabled. Query retrieval runs both vector search and Postgres full-text keyword search, merges both result sets, reranks by vector score, keyword score, and recency, then filters by confidence and lightweight query relevance. Returned answers include retrieved chunks, citations, latency metrics, and index stats.

## AI providers

The GCP deployment uses Vertex AI through Workload Identity. Embeddings use `gemini-embedding-001`; generation uses a verified callable Gemini model such as `gemini-2.5-flash-lite`. Local development can use deterministic hash embeddings and extractive answers. OpenRouter is intentionally disabled in the GCP values.

## Copilot adapter

The LokSetu API exposes `/api/copilot/query`. It classifies the question intent, routes to the appropriate Copilot agent, expands broad questions with current project and submission context, calls the RAG API, and returns answer text, citations, retrieved context snippets, confidence, latency, suggested actions, follow-up questions, and guardrails. For broad questions such as latest submitted problem, top issues, or current briefing, the adapter can provide a deterministic fallback from processed submissions and ranked projects if retrieval misses.

## Security and cost control

Public deployment should use an app access password before allowing AI, submission, simulation, rating, admin, or Copilot calls. The API signs short-lived bearer tokens after login and rejects protected `/api` calls without a valid token. This prevents anonymous users from creating expensive Vertex AI calls or batch work. GitHub Actions can start or stop Terraform-managed infrastructure on demand to reduce idle cloud spend.

## Observability

Prometheus scrapes the RAG API metrics endpoint. Metrics include request latency, stage latency, indexed document and chunk counts, embedding cache hits, and retrieval misses. Grafana dashboards use Prometheus, Loki, and Tempo through the observability stack. The public Grafana entrypoint is protected separately by Grafana login.

## GitOps deployment

Infrastructure is managed with Terraform. Kubernetes workloads are managed with Helm and Argo CD. Image tags are pinned in `charts/people-priority/values-gcp.yaml`. RAG ConfigMap changes roll the API and workers through checksum annotations so embedding provider, model, thresholds, and ingestion source changes are applied without manual pod deletion.
