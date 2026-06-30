# Product Context

## Problem

Constituency offices receive citizen problems through many weakly connected
channels: phone calls, WhatsApp, photos, public meetings, local staff, social
posts, documents, surveys, and department records.

Common failures:

- Problems are hard to deduplicate.
- Urgent local issues are mixed with low-confidence noise.
- Evidence is scattered across media, documents, maps, and staff notes.
- MPs and district officers cannot see why one issue should outrank another.
- Citizens submit reports but cannot track what happened next.
- Public transparency boards risk exposing personal details if privacy is not designed in.

LokSetu solves this by creating a batch-first civic intelligence layer:

1. Capture citizen input safely.
2. Normalize it into structured signals.
3. Batch-process with AI and deterministic scoring.
4. Rank projects by urgency, confidence, impact, and evidence.
5. Expose dashboards, public boards, maps, Copilot answers, and operational telemetry.

## Users

| User | Need |
| --- | --- |
| Citizen | Submit a problem quickly and track receipt status |
| MP office | See top priorities, evidence, and public communication state |
| Ward staff | Triage local problems and map issues to the right MP area |
| District officer | Review high-priority works and move projects through status |
| Analyst | Audit source coverage, trends, and model outputs |
| Admin | Configure mappings, integrations, AI settings, and privacy controls |

## Design Principles

- Privacy-first: no personal citizen identity in public views.
- Batch-first AI: citizen submit path returns fast; AI work happens asynchronously.
- Explainable ranking: every priority needs evidence and rationale.
- GitOps-first operations: runtime state should be reproducible from Git plus secrets.
- Public transparency: citizens should see progress without exposing private data.
- Cost-aware: expensive AI and cloud runtime need auth and start/stop controls.

## Core Objects

| Object | Meaning |
| --- | --- |
| Raw intake | Unprocessed citizen submission queued for batch processing |
| Submission | Processed, privacy-safe signal generated from raw intake |
| Ranked project | Aggregated priority created from related submissions and context |
| Area mapping | Ward, district, state, and MP routing configuration |
| RAG document | Indexed source used by Copilot for grounded answers |
| Receipt | Public-safe lookup key for submission status |
| Batch run | Processing run that converts raw intake to dashboard-ready data |

## Current Deployment

Production uses:

- GKE for application workloads.
- Cloud SQL Postgres for app and RAG persistence.
- Vertex AI for Gemini generation and embeddings.
- Google Cloud Load Balancer plus Certificate Manager for HTTPS.
- Argo CD for GitOps.
- Grafana/Prometheus/Loki/Tempo/OTel for observability.
