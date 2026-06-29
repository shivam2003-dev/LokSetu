# RAG Monitoring And Runbook

## Metrics

`rag-api` exposes Prometheus metrics at `/metrics`.

Important metrics:

- `loksetu_rag_request_latency_ms`
- `loksetu_rag_stage_latency_ms{stage="embedding"}`
- `loksetu_rag_stage_latency_ms{stage="vector_search"}`
- `loksetu_rag_stage_latency_ms{stage="llm"}`
- `loksetu_rag_indexed_documents`
- `loksetu_rag_indexed_chunks`
- `loksetu_rag_embedding_cache_hits_total`
- `loksetu_rag_retrieval_misses_total`

## Checks

```bash
kubectl -n people-priority get deploy
kubectl -n people-priority logs deploy/people-priority-rag-api
kubectl -n people-priority logs deploy/people-priority-ingestion-worker
kubectl -n people-priority logs deploy/people-priority-embedding-worker
kubectl -n people-priority exec deploy/people-priority-rag-api -- node -e "fetch('http://127.0.0.1:8090/ready').then(r=>r.text()).then(console.log)"
```

## Common Incidents

### No Documents Indexed

Check ingestion worker logs and `RAG_INGEST_PATHS`.

### No Embeddings

Check `RAG_EMBEDDING_PROVIDER`, provider credentials, and `rag_embeddings` row count.

### Wrong Answer

Inspect `/query` response `retrieved` and `citations`. If confidence is below threshold, tune `RAG_SIMILARITY_THRESHOLD` and `RAG_MINIMUM_CONFIDENCE`; do not lower thresholds to force unrelated answers.

### Argo Missing RAG Apps

Re-apply `argocd/application-local.yaml` and confirm:

```bash
kubectl -n argocd get applications | grep loksetu-rag
```
