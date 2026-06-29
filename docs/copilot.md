# LokSetu AI Copilot

The Copilot is a grounded policy and constituency intelligence assistant. It answers from the current LokSetu intelligence corpus: ranked projects, citizen signals, daily intelligence, forecasts, recommendations, source coverage, and evidence snippets. It is not an unbounded chatbot.

## API

- `GET /api/copilot/capabilities`: supported roles, routed agents, source-family coverage, inputs, and current limitations.
- `GET /api/copilot/rag-status`: current retrieval mode, corpus size, source-type counts, embedding store target, privacy posture, and refresh cadence.
- `POST /api/copilot/query`: returns an answer, routed agent, intent, confidence, evidence, citations, retrieval metadata, retrieved context, suggested actions, follow-up questions, and guardrails.

Example request:

```json
{
  "role": "mp",
  "language": "English",
  "question": "Why is the highest ranked project urgent?",
  "projectId": "kalindi-nagar-education"
}
```

Example response fields:

```json
{
  "retrieval": {
    "mode": "local-hybrid-rag",
    "embeddingStore": "local-deterministic-index",
    "corpusDocuments": 42,
    "retrieved": 8,
    "latencyMs": 6
  },
  "retrievedContext": [
    {
      "id": "project:kalindi-nagar-education",
      "sourceType": "ranked_project",
      "title": "Repair classrooms and toilets in Kalindi Nagar",
      "snippet": "Education demand is supported by repeated citizen signals..."
    }
  ]
}
```

## Retrieval Design

Local development uses deterministic hybrid lexical retrieval over a generated corpus. The corpus excludes raw usernames and direct citizen identifiers; citizen content uses privacy-safe aliases and aggregate snippets. This keeps the chat functional without cloud credentials and makes tests stable.

Production should replace the local retrieval adapter with Vertex AI RAG Engine or Vertex AI Vector Search:

- Batch workers generate embeddings for ranked projects, normalized citizen submissions, public datasets, meeting minutes, source snapshots, and approved document chunks.
- The API retrieves top chunks by semantic similarity plus locality, source freshness, and project-status filters.
- Answers must include retrieved chunk IDs, source type, snippet, and confidence metadata.
- Vertex AI configuration should remain environment-driven through Kubernetes Secrets and Workload Identity.

## Agent Routes

- MP Copilot: strategic planning and public-meeting preparation.
- Budget Agent: funding path, budget risk, and expenditure reasoning.
- GIS Agent: ward, district, hotspot, and map-grounded reasoning.
- Document Agent: DPR, audit, survey, RTI, and meeting-minute analysis.
- Citizen Agent: privacy-safe public explanations.
- Forecast Agent: emerging risk and what-if planning.

## Guardrails

The Copilot exposes citations and never returns private citizen identity. Funding, eligibility, emergency advice, and official commitments require human confirmation.
