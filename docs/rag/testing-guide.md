# RAG Testing Guide

## Commands

```bash
npm run typecheck
npm run test:unit -w services/rag-api
npm test
helm lint charts/people-priority -f charts/people-priority/values-local.yaml
```

## Required Regression

Queries with no indexed match must not return unrelated documents.

Example:

```bash
curl -s http://localhost:8090/query \
  -H 'content-type: application/json' \
  -d '{"question":"unindexed impossible issue","tenantId":"loksetu","namespace":"india"}'
```

Expected answer:

`No indexed documents match the query.`

## Evaluation Metrics

The evaluation module measures:

- Recall@K
- Precision@K
- MRR
- Groundedness
- Faithfulness
- Citation accuracy
- Hallucination rate

Regression datasets should include negative examples such as `bihar stats` before Bihar documents are indexed.
