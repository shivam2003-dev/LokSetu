# Documentation Index

Architecture and operating notes for LokSetu.

## Key Documents
- `loksetu/README.md`: developer wiki for product context, features, implementation logic, RAG/Copilot, and contribution flow.
- `architecture.md`: system overview and component responsibilities.
- `gcp-cloud-architecture.md`: production GCP/GKE architecture.
- `gcp-local-safety.md`: local `gcloud` profile, cost guardrails, and project-access checks.
- `diagrams.md`: Mermaid architecture diagrams.
- `ai-pipeline.md`: Vertex/OpenAI-compatible AI flow and guardrails.
- `batch-data-pipeline.md`: batch-first intake and scoring.
- `rag/README.md`: standalone pgvector/Vertex-ready RAG platform.
- `rag/architecture.md`: RAG services, vector index, and retrieval pipeline diagram.
- `rag/deployment-guide.md`: local Argo and production GKE deployment.
- `rag/testing-guide.md`: RAG validation and no-unrelated-document regression tests.
- `rag/monitoring-runbook.md`: metrics, alerts, and operational troubleshooting.
- `maps-boundaries.md`: Google Maps runtime behavior, official boundary procurement path, and hotspot clustering.
- `whatsapp-setup.md`: WhatsApp simulator and webhook setup.

## Maintenance
Keep docs linked from the root README and component READMEs. Do not include raw API keys, tokens, phone numbers, or private citizen data.
