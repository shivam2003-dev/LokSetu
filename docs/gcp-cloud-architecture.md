# GCP Cloud Architecture

LokSetu production runs on Google Cloud with GKE, Vertex AI, managed data services, GitOps, and private-by-default data handling.

## Target Cloud Topology

```mermaid
flowchart TB
  Users[Citizens, MPs, admins] --> Armor[Cloud Armor + HTTPS Load Balancer]
  Armor --> Ingress[GKE Ingress / Gateway]

  subgraph VPC[Dedicated VPC]
    subgraph GKE[GKE private cluster]
      Web[MP/Admin web pods]
      Citizen[Citizen web pods]
      API[API pods]
      Workers[AI/Data worker pods]
    end
    SQL[(Cloud SQL Postgres)]
    Memorystore[(Memorystore Redis optional)]
  end

  API --> SQL
  Workers --> SQL
  API --> PubSub[Pub/Sub]
  PubSub --> Workers
  API --> Storage[Cloud Storage raw media]
  Workers --> Vertex[Vertex AI Gemini + embeddings]
  Workers --> Speech[Cloud Speech-to-Text]
  Workers --> Vision[Cloud Vision OCR]
  Workers --> Translate[Cloud Translation / Bhashini adapter]
  Workers --> BQ[BigQuery + GIS]
  Workers --> Maps[Maps Platform]
  GKE --> Logs[Cloud Logging + Monitoring]
```

## Core Services

- **GKE private cluster**: runs API, web apps, background workers, and internal jobs.
- **Cloud SQL Postgres**: system of record for users, submissions, project clusters, scores, reviews, and audit events.
- **Pub/Sub**: durable intake queue for text, voice, photo, WhatsApp, and batch imports.
- **Cloud Storage**: raw audio, image, OCR artifacts, and lifecycle-managed evidence files.
- **Vertex AI**: language detection, normalization, classification, embeddings, clustering, and grounded summaries.
- **BigQuery + GIS**: large-scale analytics, official dataset joins, and geospatial hotspot queries.
- **Cloud Monitoring/Logging**: operational metrics, audit trails, alerts, and model failure visibility.
- **Cloud Armor + HTTPS Load Balancer**: rate limiting, WAF policy, TLS, and edge protection.

## Network and Security Design

```mermaid
flowchart LR
  Internet --> LB[External HTTPS LB]
  LB --> Armor[Cloud Armor policy]
  Armor --> Gateway[GKE Gateway/Ingress]
  Gateway --> WebSvc[Web services]
  Gateway --> APISvc[API service]
  APISvc --> PrivateSQL[Private IP Cloud SQL]
  APISvc --> PrivateGoogle[Private Google Access]
  WorkloadID[Workload Identity] --> Vertex[Vertex AI]
  WorkloadID --> Storage[Cloud Storage]
  WorkloadID --> BQ[BigQuery]
```

- Use a dedicated VPC and avoid the default network.
- Use private GKE nodes and private Cloud SQL IP.
- Use Workload Identity instead of JSON service-account keys.
- Store secrets in Secret Manager and sync into Kubernetes only when needed.
- Enable VPC Flow Logs, audit logs, and Cloud Armor request logs.

## Data Flow

```mermaid
sequenceDiagram
  participant C as Citizen channel
  participant API as GKE API
  participant PS as Pub/Sub
  participant W as Worker
  participant AI as Vertex AI
  participant SQL as Cloud SQL
  participant BQ as BigQuery
  participant MP as MP dashboard

  C->>API: Submit problem + location + optional media
  API->>SQL: Store intake metadata and privacy alias
  API->>PS: Publish processing job
  W->>PS: Consume job
  W->>AI: Detect language, normalize, classify, embed
  W->>BQ: Join civic datasets and geospatial signals
  W->>SQL: Store cluster, scores, evidence, audit
  MP->>API: Load localized priority queue
  API->>SQL: Query MP/ward-scoped projects
```

## Batch Processing Model

LokSetu is batch-first for AI processing. The online API stores raw intake and returns `pending_batch`; scheduled workers process pending rows, call Vertex AI, update processed tables, and refresh dashboard views. This avoids request-path latency and keeps MP dashboards stable during AI/API outages.

Recommended production schedule:

- Every 5-15 minutes for normal citizen intake.
- Hourly for heavier geospatial joins.
- Nightly for full dedupe, embeddings refresh, and official dataset reconciliation.

## GitOps and Release Architecture

```mermaid
flowchart LR
  Dev[Developer] --> PR[GitHub PR]
  PR --> CI[Cloud Build / GitHub Actions]
  CI --> Tests[Build, typecheck, audit, helm lint]
  Tests --> Images[Artifact Registry images]
  PR --> Main[main branch]
  Main --> Argo[Argo CD]
  Argo --> Helm[Helm chart values per env]
  Helm --> GKEDev[dev GKE]
  Helm --> GKEStage[staging GKE]
  Helm --> GKEProd[prod GKE]
```

Recommended environments:

- **dev**: lower-cost GKE node pool, fallback AI allowed.
- **staging**: production-like Cloud SQL, Vertex AI, Pub/Sub, and BigQuery.
- **prod**: private cluster, HA Cloud SQL, autoscaling node pools, Cloud Armor, monitored SLOs.

## Terraform Modules

Terraform should provision:

- VPC, subnets, secondary ranges for pods/services.
- Private GKE cluster and autoscaling node pools.
- Artifact Registry repositories.
- Cloud SQL Postgres with backups and private IP.
- Pub/Sub topics and subscriptions.
- Cloud Storage buckets with lifecycle policies.
- BigQuery datasets for analytics and GIS.
- IAM service accounts and Workload Identity bindings.
- Secret Manager entries for external integrations.
- Cloud Monitoring dashboards and alert policies.

## Production SLOs

- API availability: 99.9% monthly target.
- Intake API p95 latency: under 500 ms before async AI processing.
- Queue processing p95: under 5 minutes for normal text/photo submissions.
- Critical alerting: API 5xx rate, queue age, worker failure rate, Cloud SQL CPU/storage, Vertex AI error rate, Argo sync drift.

## Cost Controls

- Use async workers for expensive media/AI processing.
- Apply Cloud Storage lifecycle deletion for raw media.
- Partition BigQuery tables by date and cluster by state/district/category.
- Use autoscaling and separate node pools for CPU workers vs web/API.
- Cache public analytics and map tiles where possible.

## Disaster Recovery

- Cloud SQL automated backups and point-in-time recovery.
- Terraform state stored in a locked remote backend.
- Git as source of truth for Kubernetes manifests.
- Argo CD can restore cluster workloads from Git.
- Raw evidence stored in versioned/lifecycle-managed buckets.
