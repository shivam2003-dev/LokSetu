# JanVaani AI / LokSetu Solution

## Summary

JanVaani AI is an AI-powered constituency intelligence platform for Members of Parliament and public administrators. It turns citizen submissions, official datasets, web signals, maps, and indexed documents into ranked development priorities with evidence, confidence, and execution workflows.

The citizen-facing app is **Apni Awaaz**. It accepts text, voice, and image reports, requires location before submission, queues the raw intake, runs AI processing in batch or on demand, and sends processed civic signals into the MP dashboard.

## Problem

Public representatives receive complaints from many fragmented channels: citizen visits, WhatsApp messages, social media, news, public meetings, documents, and local officials. These inputs are hard to compare, deduplicate, verify, prioritize, and convert into development work.

JanVaani AI addresses this by creating one auditable operating layer for:

- Capturing citizen demand with location and privacy controls.
- Detecting whether an input is a public civic issue or noise.
- Normalizing multilingual text, voice, and image evidence.
- Mapping each issue to the correct state, district, locality, and MP route from GPS/reverse geocoding.
- Ranking development projects by demand, need, urgency, equity, confidence, and evidence.
- Giving MPs dashboards, maps, RAG answers, reports, recommendations, and project tracking.

## Core User Flow

1. A citizen opens Apni Awaaz and logs in.
2. The app requests location permission. Submission is blocked until location is available.
3. The citizen submits text, voice, or image evidence.
4. The API stores the raw record in `raw_intake` and returns a receipt.
5. The scheduled batch or on-demand evaluator run processes pending intake.
6. Vertex/Gemini or deterministic fallback analyzes the content:
   - language
   - normalized issue text
   - civic issue detection
   - category
   - image summary or voice transcript
   - noise/private issue handling
7. Reverse geocoding places the issue using latitude/longitude.
8. Processed records are written to `submissions`, indexed into RAG, and reflected in dashboards.
9. MPs review demand signals, AI recommendations, maps, project queues, reports, and source data.

## Main Features

- **Overview**: executive constituency health dashboard.
- **Demand Signals**: category demand, source evidence, timelines, heatmaps, escalation watch.
- **AI Assistant (RAG)**: three modes: online sources, submitted issues, and all sources.
- **Recommendations**: AI-ranked development actions with priority, cost, beneficiaries, confidence, and evidence.
- **Projects**: project portfolio, Kanban, Gantt-style timeline, expenditure, milestones, documents, and delay alerts.
- **Reports**: AI-generated constituency reports with export actions.
- **Data Explorer**: live source workspace, Awaaz intake audit trail, on-demand pipeline run, and multimodal test kit.
- **Knowledge Base**: indexed PDFs, plans, reports, complaints, articles, census files, OCR/chunking/embedding/indexing state.
- **Map View**: GIS dashboard with layers for roads, schools, PHCs, water, complaints, projects, flood zones, population, satellite, and demand heatmaps.
- **Compare**: constituency, district, and state comparison dashboard.
- **Settings**: governance/admin interface for profile, organization, roles, integrations, API status, model selection, security, audit logs, backup, and billing.

## AI And Data Pipeline

JanVaani AI is batch-first. Citizen-facing APIs do not block on long AI calls. They enqueue raw input and return a receipt quickly. The batch processor handles AI, scoring, routing, indexing, and dashboard refresh.

The AI pipeline supports:

- Text normalization and classification.
- Voice transcription and analysis.
- Image understanding and problem extraction.
- Civic issue vs non-addressable/noisy input detection.
- Dynamic location placement from GPS coordinates.
- Category scoring and project-ranking evidence.
- RAG indexing for grounded answers.

The system stores both the raw intake and the processed AI explanation so evaluators can inspect what was submitted, what the AI inferred, where it was placed, how it was routed, and why.

## RAG Design

The RAG assistant is not a generic chatbot. It answers from platform evidence:

- Submitted citizen issues.
- Ranked projects.
- Source snapshots.
- Indexed documents.
- News/web sources where configured.
- Public datasets.
- Maps and locality context.

The assistant exposes three retrieval modes:

- **Online mode**: external/web and connector-backed sources.
- **Submitted issue mode**: processed citizen submissions and raw intake trail.
- **All mode**: combines online, official, document, and submitted issue evidence.

## Location Handling

No citizen issue can be submitted without location. GPS latitude/longitude is the source of truth. The API reverse-geocodes coordinates through configured providers and falls back only when necessary.

This avoids hardcoding every locality manually. New locations can be accepted dynamically as data arrives, while known administrative mappings can still improve MP routing and dashboard filters.

## Demo Data

The platform supports a local/demo-data switch for presentation reliability. Demo data is clearly marked and can be enabled or disabled from the dashboard. Live counters and the Data Explorer now include visible demo rows, raw intake counts, and processed submissions so the interface reflects actual submitted records.

## Security And Governance

- No API keys or passwords should be committed to Git.
- Runtime secrets are expected from Kubernetes Secrets, cloud secret stores, or deployment environment variables.
- MP-facing records use privacy mode and avoid exposing direct citizen identity.
- Admin controls cover user roles, access control, audit logs, API status, model configuration, backups, and billing.
- Human approval remains required before final development execution decisions.

## Deployment

The production architecture uses:

- React/Vite web dashboard.
- React/Vite Apni Awaaz citizen app.
- Express API.
- PostgreSQL/pgvector persistence.
- Kubernetes Helm chart.
- Argo CD GitOps.
- GCP/GKE deployment target.
- Vertex/Gemini-compatible AI adapters.
- Mappls/Google/OSM-capable map runtime configuration.

Current production entry points:

- JanVaani AI dashboard: `https://loksetu.shivam2003.com/`
- Apni Awaaz citizen app: `https://awaaz.shivam2003.com/`

## Evaluation Path

Recommended evaluator flow:

1. Log in to JanVaani AI.
2. Start the product tour.
3. Open Apni Awaaz and submit a text, image, or voice issue with location enabled.
4. Return to JanVaani AI Data Explorer.
5. Run the on-demand AI pipeline.
6. Open the Awaaz Intake Audit Trail and inspect:
   - receipt
   - submitted channel
   - AI tag
   - normalized evidence
   - image/voice summary if present
   - civic issue decision
   - region placed
   - MP route
   - model/runtime
   - AI explanation
7. Open Demand Signals, Recommendations, Map View, Projects, and Reports to see how the processed demand becomes action.

## Why It Matters

JanVaani AI gives elected representatives a practical way to move from scattered citizen complaints to explainable, evidence-backed development decisions. It combines public participation, AI triage, geospatial intelligence, grounded retrieval, and execution tracking in one governance workflow.
