# LokSetu Developer Wiki

LokSetu is a constituency intelligence platform. It turns citizen signals into
ranked, evidence-backed public works priorities for MPs, district teams, and
public transparency boards.

This wiki is for developers who need to understand the problem, the product
surfaces, the implementation logic, and the contribution path.

## Start Here

| Topic | File |
| --- | --- |
| Problem, users, and product model | [product-context.md](product-context.md) |
| Feature map and user journeys | [feature-map.md](feature-map.md) |
| Implementation logic | [implementation-logic.md](implementation-logic.md) |
| RAG and Copilot behavior | [rag-copilot.md](rag-copilot.md) |
| Contribution guide | [contribution-guide.md](contribution-guide.md) |
| GCP handoff | [../loksetu-gcp-handoff.md](../loksetu-gcp-handoff.md) |

## Repository Map

| Path | Purpose |
| --- | --- |
| `apps/web` | MP/admin LokSetu dashboard, Copilot, maps, projects, public board, admin tools |
| `apps/citizen` | Apni Awaaz citizen issue submission and receipt lookup |
| `services/api` | Express API, auth, intake queue, batch pipeline, dashboards, Copilot adapter |
| `services/rag-api` | Standalone pgvector-backed RAG service, ingestion worker, embedding worker |
| `charts/people-priority` | Helm chart for GKE/local Kubernetes runtime |
| `argocd` | Argo CD application manifests |
| `infra/terraform` | GCP infrastructure, load balancers, certificates, SQL, GKE, APIs |
| `scripts` | Local startup, Kubernetes bootstrap, and GCP power-control helpers |
| `docs` | Architecture, operations, and developer wiki |

## Local Development

```bash
npm install
npm run dev
```

Local stack with Postgres:

```bash
npm run local
```

Local Kubernetes plus Argo CD:

```bash
npm run local:k8s
```

## Required Validation

```bash
npm run typecheck
npm run build
helm lint charts/people-priority
```

For GCP values:

```bash
helm lint charts/people-priority -f charts/people-priority/values-gcp.yaml
```
