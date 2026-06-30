# Contribution Guide

## Before Coding

Read:

- `AGENTS.md`
- `docs/loksetu/README.md`
- `docs/loksetu/implementation-logic.md`
- Relevant app/service code.

Do not commit:

- `.env`
- Terraform state.
- Service-account JSON.
- API keys.
- Passwords.
- Kubernetes secret values.
- Files under `output/`.

## Common Workflows

Frontend change:

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

Citizen app change:

```bash
npm run typecheck -w apps/citizen
npm run build -w apps/citizen
```

API change:

```bash
npm run typecheck -w services/api
npm run build -w services/api
```

RAG change:

```bash
npm run typecheck -w services/rag-api
npm run build -w services/rag-api
```

Helm change:

```bash
helm lint charts/people-priority
helm lint charts/people-priority -f charts/people-priority/values-gcp.yaml
```

Full validation:

```bash
npm run typecheck
npm run build
helm lint charts/people-priority -f charts/people-priority/values-gcp.yaml
```

## Coding Rules

- Use TypeScript strict types.
- Keep API responses privacy-safe.
- Keep ranking and Copilot rationale visible.
- Prefer explicit domain names over generic helpers.
- Match existing React/CSS patterns.
- Keep Kubernetes resource names kebab-case.
- Keep secrets in Kubernetes/GCP, not Git.

## PR Checklist

- Summary explains user-visible change.
- Validation commands included.
- Screenshots included for UI changes.
- Helm/Terraform/secret impact called out.
- New endpoints documented.
- RAG corpus changes listed.
- No generated folders committed.
- No live secrets committed.

## Production Rollout Checklist

1. Build images.
2. Push images to Artifact Registry.
3. Update `charts/people-priority/values-gcp.yaml`.
4. Commit and push to `main`.
5. Check Argo CD app `loksetu-gcp`.
6. Wait for pods and backends healthy.
7. Smoke test login.
8. Smoke test Apni Awaaz submit and receipt search.
9. Smoke test LokSetu dashboard.
10. Smoke test Copilot RAG query.
11. Smoke test Grafana.

## Cost-Control Workflow

Use GitHub Action `GCP Power Control`.

For stop:

```text
action=stop
confirm=STOP
```

For start:

```text
action=start
confirm=START
```

For status:

```text
action=status
confirm=
```

Stop only scales/stops runtime billing surfaces. It does not delete resources.
