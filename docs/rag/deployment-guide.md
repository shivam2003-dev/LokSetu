# RAG Deployment Guide

## Local Kubernetes

```bash
npm run local:k8s
kubectl -n argocd get applications
kubectl -n people-priority get deploy
```

Expected Argo applications:

- `loksetu-vector-index-local`
- `loksetu-rag-api-local`
- `loksetu-embedding-worker-local`
- `loksetu-ingestion-worker-local`
- `loksetu-platform-local`
- `loksetu-web-local`
- `apni-awaaz-local`

## Production GKE

Use the same Helm chart and set:

- `rag.api.env.RAG_DATABASE_URL` from Secret Manager or Cloud SQL connector.
- `rag.api.env.RAG_EMBEDDING_PROVIDER=gemini`.
- `rag.api.env.RAG_EMBEDDING_MODEL=gemini-embedding-001`.
- `rag.api.env.RAG_LLM_PROVIDER=gemini`.
- Workload Identity with Vertex AI User, Storage Object Viewer, and Cloud SQL Client roles.

## Image Build

```bash
docker build -f services/rag-api/Dockerfile -t REGION-docker.pkg.dev/PROJECT/loksetu/rag-api:TAG .
```

Use separate Argo applications for RAG API, workers, and vector index so each can be rolled independently.
