# Implementation Logic

## Request Flow

Citizen submission flow:

```text
Apni Awaaz
  -> POST /api/citizen/submit
  -> raw_intake row
  -> pending_batch receipt
  -> scheduled batch worker
  -> AI normalization
  -> submissions row
  -> dashboard/project ranking
  -> public board and Copilot corpus
```

Dashboard flow:

```text
LokSetu web
  -> login
  -> /api/client-config
  -> /api/priorities + context APIs
  -> render operating dashboard
```

Copilot flow:

```text
LokSetu web Copilot
  -> POST /api/copilot/query
  -> classify intent
  -> expand retrieval question
  -> RAG service query
  -> citations + retrieved context
  -> direct fallback for broad platform questions
```

## Auth Model

Environment:

```text
APP_ACCESS_PASSWORD
APP_AUTH_SECRET
```

When `APP_ACCESS_PASSWORD` is set:

- Login endpoint validates password.
- API returns a signed 12-hour bearer token.
- Web and citizen apps store token in local storage.
- API middleware requires token on `/api/*` after `/api/auth/login`.

When password is not set:

- Local/dev mode remains usable.
- Login endpoint returns `disabled: true`.

Health checks:

- `/healthz` stays public for load balancer probes.

## Receipt Lookup

Data source:

- `raw_intake.id` is the canonical receipt ID.
- Citizen UI shows the first 8 characters.
- Lookup accepts 8 to 36 characters.

Endpoint:

```text
GET /api/citizen/receipts/:receiptId
```

Behavior:

- Prefix match against `raw_intake.id`.
- If one record matches, return public-safe status.
- If multiple records match, ask for full receipt.
- If processed, join against `submissions.rawIntakeId`.
- If not processed, return `pending_batch`.

## Batch Pipeline

Raw intake is stored first because AI should not run in the user request path.

Benefits:

- Faster citizen submit.
- Better retry behavior.
- Lower AI spike risk.
- Auditable batch runs.
- Cleaner observability.

Current statuses:

```text
pending
processing
processed
failed
```

## Ranking Logic

Dashboard ranking combines:

- Urgency.
- Citizen rating.
- Evidence strength.
- Source coverage.
- Location/ward context.
- Category-specific impact.
- Batch-generated normalized text.

The app must keep rationale visible. Ranking without evidence is not acceptable for production governance UX.

## Map Logic

Maps have two layers:

- Browser rendering from Google Maps runtime config.
- Backend geospatial intelligence from boundary and cluster APIs.

Important endpoints:

```text
GET /api/maps/boundaries
GET /api/maps/clusters
GET /api/client-config
```

If Maps key is missing, app should still show local fallback map intelligence.

## RAG Logic

RAG uses Postgres/pgvector:

```text
documents -> chunks -> embeddings -> vector search -> citations -> answer
```

Configured ingestion paths live in Helm values. Add new corpus files under
`services/rag-api/fixtures/` and include them in `rag.ingestionWorker.ingestPaths`.

The Copilot should not pretend to know facts that are not retrieved. Broad
questions can use deterministic platform fallbacks, but factual answers need
retrieved context and citations.

## Deployment Logic

Infrastructure:

- Terraform creates GCP resources.
- Kubernetes secrets hold runtime credentials.
- Helm chart describes app workloads.
- Argo CD applies Helm values from Git.

Image update flow:

1. Build image.
2. Push to Artifact Registry.
3. Update `charts/people-priority/values-gcp.yaml` tag.
4. Commit and push.
5. Argo CD syncs GKE.
6. Verify public URLs and API behavior.

## Failure Modes

| Symptom | Likely Cause | Check |
| --- | --- | --- |
| Login fails | Wrong `APP_ACCESS_PASSWORD` secret | `kubectl get secret loksetu-app-auth` |
| API banner visible | Frontend cannot call API or token missing | Browser network tab, `/api/client-config` |
| Map fallback only | Maps secret missing or browser key blocked | `/api/client-config` |
| Copilot retrieves 0 | RAG ingestion/embeddings missing or question too narrow | `/api/copilot/rag-status`, RAG logs |
| Receipt not found | Wrong prefix or raw intake not in current DB | `raw_intake` table |
| HTTPS pending | Certificate DNS authorization missing | Certificate Manager state |
| Stop action leaves cost | Node pool not zero or SQL still active | GitHub Action `status` |
