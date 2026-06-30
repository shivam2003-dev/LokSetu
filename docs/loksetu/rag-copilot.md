# RAG And Copilot

## Goal

Copilot should answer constituency, project, source, policy, and platform
questions from LokSetu data with visible evidence.

It is not an unbounded chatbot. It should stay grounded in:

- Citizen signal corpus.
- Ranked projects.
- Daily intelligence.
- RAG documents.
- Maps and locality context.
- Technical architecture docs.

## Runtime Components

| Component | Path | Role |
| --- | --- | --- |
| Copilot UI | `apps/web/src/App.tsx` | User-facing question surface |
| Copilot adapter | `services/api/src/copilot.ts` | Intent, retrieval expansion, answer shaping |
| RAG client | `services/api/src/ragClient.ts` | API-to-RAG service bridge |
| RAG API | `services/rag-api` | Retrieval, generation, citations, metrics |
| Fixtures | `services/rag-api/fixtures` | Seed corpus |

## Query Logic

1. User asks question in Copilot.
2. API classifies intent.
3. API expands retrieval query for broad questions.
4. RAG service retrieves chunks from pgvector.
5. RAG service generates answer with citations.
6. API returns answer, confidence, evidence, citations, guardrails, and retrieval metadata.

Broad fallback intents:

- Latest submitted problem.
- Top ranked priorities.
- Current briefing.
- RAG/architecture questions.

These prevent empty answers for normal questions such as:

```text
last submitted problem?
what are top problems?
how is RAG built?
what changed today?
```

## Corpus

Current configured fixture corpus:

```text
services/rag-api/fixtures/bihar/census-bihar-2011.md
services/rag-api/fixtures/loksetu/delhi-constituency-intelligence.md
services/rag-api/fixtures/loksetu/citizen-feedback-digest.md
services/rag-api/fixtures/loksetu/rag-architecture.md
```

`rag-architecture.md` exists for two reasons:

- Developer explanation.
- Indexed RAG source for technical questions.

## Quality Rules

Copilot answer should include:

- Clear direct answer.
- Retrieved context count.
- Citations when RAG returns context.
- Confidence.
- Guardrails.

Copilot should not:

- Expose private citizen identity.
- Invent official funding approvals.
- Claim a project is approved without status data.
- Hide retrieval misses.
- Use OpenRouter in GCP production.

## Adding New RAG Docs

1. Add markdown or text under `services/rag-api/fixtures/<domain>/`.
2. Add path to `rag.ingestionWorker.ingestPaths` in Helm values.
3. Build and push new `rag-api` image because fixtures are copied into image.
4. Update `charts/people-priority/values-gcp.yaml`.
5. Let Argo CD sync.
6. Check RAG status in Copilot or `/api/copilot/rag-status`.

## Useful Questions For Smoke Tests

```text
last submitted problem?
what are the top 10 issues in my constituency this month?
why is the highest ranked project urgent?
which scheme or budget path can fund this?
how is the LokSetu RAG architecture built technically?
what data sources are indexed?
```
