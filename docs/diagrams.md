# LokSetu Architecture Diagrams

This document captures the production architecture for LokSetu: citizen intake, Vertex AI processing, India-scale ranking, MP workflows, local development, Kubernetes, and GitOps.

## 1. Product Surface

```mermaid
flowchart LR
  Citizen[Citizen mobile/web/WhatsApp] --> Submit[Problem submission]
  Field[Ward staff field app] --> Submit
  MP[MP office] --> Console[MP command center]
  Public[Public user] --> Explorer[India issue explorer]
  Admin[Platform admin] --> Ops[Admin and moderation console]

  Submit --> API[LokSetu API]
  API --> Console
  API --> Explorer
  API --> Ops
```

## 2. End-to-End System Architecture

```mermaid
flowchart TB
  subgraph Channels
    Web[Web form]
    CitizenApp[Citizen app]
    WhatsApp[WhatsApp bot]
    Voice[Voice/IVR]
    Photo[Photo upload]
  end

  subgraph GCP
    LB[HTTPS Load Balancer / Ingress]
    GKE[GKE cluster]
    PubSub[Pub/Sub intake topics]
    Storage[Cloud Storage raw media]
    Vertex[Vertex AI Gemini]
    Speech[Speech-to-Text]
    Vision[Vision OCR]
    BQ[BigQuery + GIS]
    Maps[Maps/Geocoding]
    Logs[Cloud Logging/Monitoring]
  end

  subgraph GKE_Workloads
    WebApp[MP/Admin web]
    CitizenWeb[Citizen web]
    API[Express API]
    Workers[AI/data workers]
    Postgres[(Postgres / Cloud SQL)]
  end

  Web --> LB
  CitizenApp --> LB
  WhatsApp --> LB
  Voice --> LB
  Photo --> LB
  LB --> WebApp
  LB --> CitizenWeb
  LB --> API
  API --> PubSub
  API --> Storage
  PubSub --> Workers
  Workers --> Speech
  Workers --> Vision
  Workers --> Vertex
  Workers --> BQ
  Workers --> Maps
  API --> Postgres
  Workers --> Postgres
  API --> Logs
  Workers --> Logs
```

## 3. AI Processing Pipeline

```mermaid
sequenceDiagram
  participant U as Citizen
  participant API as API
  participant Media as Media processors
  participant Vertex as Vertex AI Gemini
  participant Rank as Ranking engine
  participant DB as Postgres/BigQuery
  participant MP as MP dashboard

  U->>API: Submit text, voice, photo, or WhatsApp message
  API->>Media: Extract text from audio/image when needed
  Media-->>API: Transcript/OCR text
  API->>Vertex: Detect language, normalize, classify category
  Vertex-->>API: Structured JSON analysis
  API->>Rank: Score demand, need, urgency, equity, rating
  Rank->>DB: Store submission, score, explanation, alias
  DB-->>MP: Ranked localized project queue
```

## 4. India Localization Model

```mermaid
flowchart TD
  India[India] --> State[State / UT]
  State --> District[District]
  District --> Constituency[Lok Sabha constituency]
  Constituency --> Assembly[Assembly segment]
  Assembly --> LocalUnit[Ward / Gram Panchayat / Polling area]
  LocalUnit --> Problem[Citizen problem cluster]
  Problem --> MPQueue[MP-local priority queue]
  Problem --> PublicMap[All-India public search]
```

## 5. Ranking and Evidence Flow

```mermaid
flowchart LR
  Submission[Citizen submission] --> Dedupe[Dedupe + bot checks]
  Dedupe --> Cluster[Theme/geography clustering]
  Cluster --> Demand[Demand score]
  Civic[Census, schools, roads, health, water datasets] --> Need[Need score]
  Submission --> Urgency[Urgency score]
  Census[Demographic under-service signals] --> Equity[Equity score]
  Rating[Citizen rating] --> Urgency

  Demand --> Score[Transparent priority score]
  Need --> Score
  Urgency --> Score
  Equity --> Score
  Score --> Explanation[Evidence pack + rationale]
  Explanation --> Review[Human MP/staff review]
```

## 6. GitOps Deployment

```mermaid
flowchart LR
  Dev[Developer] --> Git[GitHub repo]
  Git --> CI[Build/test pipeline]
  CI --> Registry[Artifact Registry]
  Git --> Argo[Argo CD]
  Argo --> Helm[Helm chart]
  Helm --> K8s[Kubernetes cluster]
  Registry --> K8s
  K8s --> Pods[web, citizen, api, workers, postgres]
  Argo --> Drift[Self-heal drift]
```

## 7. Local Development Runtime

```mermaid
flowchart TB
  Local[Developer machine] --> Compose[Docker Compose Postgres]
  Local --> NPM[npm run dev]
  NPM --> API[API on localhost:8080]
  NPM --> Web[Web on localhost:5173]
  NPM --> Citizen[Citizen app]
  Local --> Kind[npm run local:k8s]
  Kind --> ArgoLocal[Argo CD]
  ArgoLocal --> HelmLocal[values-local.yaml]
  HelmLocal --> LocalPods[API/Web/Postgres in cluster]
```

## 8. Security and Privacy Boundaries

```mermaid
flowchart TD
  Raw[Raw citizen media/text] --> PII[PII redaction]
  PII --> Alias[Privacy alias mode]
  Alias --> Aggregate[Aggregate MP/public views]
  Raw --> Private[Private raw storage with retention]
  Aggregate --> Public[Public transparency board]
  Aggregate --> MP[MP dashboard]

  Secrets[Kubernetes Secrets] --> API[API workload]
  WorkloadIdentity[Workload Identity/IAM] --> API
  API --> Audit[Audit log: actor, model version, score inputs]
```

## 9. Production Readiness Checklist

- Use managed Postgres/Cloud SQL for production instead of in-cluster local Postgres.
- Enable Workload Identity and least-privilege IAM for Vertex AI, Storage, BigQuery, and Pub/Sub.
- Run all external traffic through HTTPS ingress with WAF/rate limiting.
- Store raw media in private buckets with lifecycle retention.
- Keep all AI outputs evidence-grounded and reviewable.
- Publish public transparency data only after privacy aggregation.
- Monitor API latency, worker queue depth, model failures, sync drift, and submission anomaly spikes.
