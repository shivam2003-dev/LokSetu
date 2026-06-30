# Feature Map

## Apni Awaaz

Path: `apps/citizen`

Citizen-facing intake app.

Main capabilities:

- Protected login to prevent public AI/API abuse.
- Photo, voice, and text submission paths.
- Browser geolocation capture when permitted.
- Privacy mode enabled by default.
- Fast `pending_batch` receipt after submit.
- Receipt lookup by 8-character receipt ID prefix.

Primary API calls:

```text
POST /api/auth/login
POST /api/citizen/submit
GET /api/citizen/receipts/:receiptId
```

Receipt lookup intentionally returns only public-safe status data:

- Status.
- Area.
- Category after processing.
- Batch and MP routing metadata.
- No raw personal details.

## LokSetu Web Console

Path: `apps/web`

MP/admin dashboard.

Main sections:

- Home: constituency operating summary.
- India Explorer: map and hotspot view.
- MP Center: active priority and evidence review.
- Project Rooms: project status and ratings.
- Analytics: trends, coverage, and source intelligence.
- Situation Room: operational intelligence.
- AI Copilot: grounded RAG assistant.
- Simulation: demo submission flows.
- Public Board: public-safe project transparency.
- Moderation: intake and audit review.
- AI Ops: AI and pipeline health.
- Admin: area mappings and user context.
- Integrations: source connector status.

Primary API calls:

```text
GET /api/client-config
GET /api/priorities
GET /api/context
GET /api/public/projects
POST /api/copilot/query
POST /api/simulation/submit
POST /api/admin/area-mappings
PATCH /api/projects/:projectId/status
POST /api/projects/:projectId/ratings
```

## API Service

Path: `services/api`

Responsibilities:

- Login token generation and API protection.
- Citizen intake queueing.
- Raw intake receipt lookup.
- Dashboard aggregation.
- Batch status reporting.
- Map boundary and hotspot APIs.
- Copilot orchestration.
- RAG status proxy.
- Admin and project mutation endpoints.

Auth:

- `/healthz` is public for load balancer health checks.
- `/api/auth/login` is public.
- Other `/api/*` routes require bearer token when `APP_ACCESS_PASSWORD` is set.

## RAG Service

Path: `services/rag-api`

Responsibilities:

- Store documents and chunks in Postgres/pgvector.
- Ingest markdown/text fixtures.
- Generate embeddings.
- Run hybrid retrieval.
- Generate grounded answers with citations.
- Expose metrics for observability.

Workers:

- Ingestion worker: loads configured files into corpus.
- Embedding worker: fills missing embeddings.
- RAG API: answers query requests.

## Observability

Path: Argo CD observability manifests plus Helm values.

Stack:

- Prometheus for metrics.
- Grafana for dashboards.
- Loki for logs.
- Tempo for traces.
- OpenTelemetry Collector for telemetry routing.

Primary dashboards:

- LokSetu RAG Observability.
- Kubernetes workload health.
- API and RAG latency/error views.

## Cost Control

Paths:

- `.github/workflows/gcp-power.yml`
- `scripts/gcp-power.sh`

Actions:

- `status`: show GKE node pool and Cloud SQL state.
- `stop`: scale GKE node pool to zero and stop Cloud SQL activation.
- `start`: restore Cloud SQL and node count.

No resources are deleted by this workflow.
