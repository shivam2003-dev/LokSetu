# Technical Architecture

See [diagrams.md](./diagrams.md) for system, AI pipeline, GitOps, data, and security diagrams. See [gcp-cloud-architecture.md](./gcp-cloud-architecture.md) for the Google Cloud production architecture and [batch-data-pipeline.md](./batch-data-pipeline.md) for scheduled processing.

## System Flow

```text
Citizen channels
  -> API gateway
  -> Pub/Sub intake topic
  -> media processors
  -> NLP and clustering workers
  -> civic data join
  -> ranked project store
  -> MP dashboard and public transparency view
```

## Services

`apps/web` is the MP/admin dashboard and intake console. MPs see ranked needs, evidence, hotspots, model confidence, and review state. Constituency staff can submit voice/photo/text samples during field work.

`apps/citizen` is the lightweight public capture app for phone-first voice, photo, and text reports. It returns a batch receipt immediately while AI scoring runs on the schedule.

`services/api` exposes submission and ranking endpoints. It is Vertex-first: when `VERTEX_AI_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT` is configured, Gemini on Vertex AI detects language, normalizes/translates text, interprets image and voice evidence, and classifies civic category. AI processing retries the primary Gemini model and configured backup models; if all model calls fail, raw intake is marked failed for retry instead of becoming a deterministic processed record.

- Speech: Cloud Speech-to-Text or Bhashini-backed service for Indian languages.
- OCR: Cloud Vision OCR for photos and documents.
- Translation: Cloud Translation or a domain-specific multilingual model.
- NLP: Vertex AI Gemini for intake analysis, Vertex AI embeddings plus clustering for larger-scale similarity matching, backed by BigQuery for durable analytics.
- Summaries: Gemini on Vertex AI with retrieval-grounded project evidence only.

## Ranking Model

Project score is transparent weighted evidence:

- Demand: repeated requests in the same theme and geography.
- Need: official civic gap, such as road quality, school capacity, or health access.
- Urgency: citizen-reported severity and detected safety terms.
- Equity: underserved population and low-participation correction.

The API returns component scores and plain-language rationale so final MP decisions remain auditable.

## Cloud Deployment

Terraform provisions GCP resources: VPC, GKE, Artifact Registry, GCS buckets, Pub/Sub topics, BigQuery datasets, and service accounts.

Helm packages the MP web app, citizen web app, API, batch CronJob, probes, resource limits, HPAs, and service accounts. Argo CD watches the chart and reconciles the cluster from Git. Local development can run with Docker Compose Postgres or with `kind` + Argo CD + an in-cluster Postgres StatefulSet using `values-local.yaml`.

## Security

- PII should be redacted before analytics storage.
- Raw audio and images should live in private Cloud Storage buckets with lifecycle retention.
- Workload Identity should bind Kubernetes service accounts to least-privilege GCP service accounts.
- All external traffic should terminate through HTTPS ingress.
- Audit logs should capture submission source, model version, score inputs, and review action.
