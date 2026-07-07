# LokSetu GCP Deployment Handoff

Last updated: 2026-07-01

This is the repo-safe handoff. It intentionally does not contain live passwords,
API keys, service-account JSON, Terraform tfvars, or database URLs.

## Current Shape

- Infrastructure is created with Terraform in `infra/terraform`.
- Runtime workloads are deployed to GKE through Argo CD and Helm.
- Active ingress is a Terraform-managed Google Cloud external HTTP(S) Load Balancer backed by GKE NEGs.
- Envoy Gateway is not the active ingress path for this deployment.
- TLS uses Google Certificate Manager DNS-authorized certificates. Vercel paid/custom certificate upload and Certbot are not required.
- Vertex AI is the production AI provider. OpenRouter is disabled in `charts/people-priority/values-gcp.yaml`.
- Google Maps is served through Kubernetes secrets and `/api/client-config`.
- Observability is GitOps-managed through Argo CD: Prometheus, Grafana, Loki, Tempo, and OpenTelemetry Collector.

## Public URLs

| Surface | URL |
| --- | --- |
| LokSetu web console | `https://loksetu.shivam2003.com/` |
| Apni Awaaz citizen intake | `https://awaaz.shivam2003.com/` |
| Argo CD | `https://argocd.shivam2003.com/` |
| Grafana observability | `https://observability.shivam2003.com/login` |

## DNS Mapping

Keep these records in Vercel DNS:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `loksetu.shivam2003.com` | `136.68.19.176` |
| `A` | `awaaz.shivam2003.com` | `136.68.19.176` |
| `A` | `argocd.shivam2003.com` | `136.68.42.115` |
| `A` | `observability.shivam2003.com` | `136.68.19.176` |

Certificate Manager DNS authorization records:

| Type | Name | Value |
| --- | --- | --- |
| `CNAME` | `_acme-challenge.loksetu.shivam2003.com` | `9d620b40-caf9-4bde-93f2-50e2a1282d57.2.authorize.certificatemanager.goog.` |
| `CNAME` | `_acme-challenge.awaaz.shivam2003.com` | `cc9786c4-dbf4-4783-84b1-aef68cfc9e12.8.authorize.certificatemanager.goog.` |
| `CNAME` | `_acme-challenge.argocd.shivam2003.com` | `d40a3df2-a46c-4e82-a8f0-c9c19b841fd8.4.authorize.certificatemanager.goog.` |
| `CNAME` | `_acme-challenge.observability.shivam2003.com` | `ca99f682-85a3-4c2f-9e44-89b03da3ee6d.3.authorize.certificatemanager.goog.` |

## Credentials

Live credentials are stored in Kubernetes or GCP secrets, not in Git:

| Credential | Location |
| --- | --- |
| LokSetu app login password | Kubernetes secret `people-priority/loksetu-app-auth`, key `password` |
| LokSetu app auth token secret | Kubernetes secret `people-priority/loksetu-app-auth`, key `token-secret` |
| Cloud SQL app URL | Kubernetes secret `people-priority/loksetu-db`, keys `DATABASE_URL` and `RAG_DATABASE_URL` |
| Google Maps browser key | Kubernetes secret `people-priority/loksetu-google-maps-browser`, key `api-key` |
| Google Maps server key | Kubernetes secret `people-priority/loksetu-google-maps-server`, key `api-key` |
| Grafana admin password | Kubernetes secret `observability/grafana-admin`, key `admin-password` |
| Argo CD admin password | Kubernetes secret `argocd/argocd-initial-admin-secret`, key `password`, unless rotated |

Read examples:

```bash
kubectl -n people-priority get secret loksetu-app-auth -o jsonpath='{.data.password}' | base64 --decode; echo
kubectl -n observability get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 --decode; echo
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode; echo
```

## GCP Project

| Item | Value |
| --- | --- |
| Project ID | `project-72558650-faf6-4529-a05` |
| Region | `us-east4` |
| GKE cluster | `loksetu` |
| GKE node pool | `primary` |
| Cloud SQL instance | `loksetu-postgres` |
| Artifact Registry repository | `people-priority` |
| App service account | `loksetu-app@project-72558650-faf6-4529-a05.iam.gserviceaccount.com` |

## Runtime Images

Image tags are controlled from `charts/people-priority/values-gcp.yaml`.

Repositories:

```text
us-east4-docker.pkg.dev/project-72558650-faf6-4529-a05/people-priority/api
us-east4-docker.pkg.dev/project-72558650-faf6-4529-a05/people-priority/rag-api
us-east4-docker.pkg.dev/project-72558650-faf6-4529-a05/people-priority/web
us-east4-docker.pkg.dev/project-72558650-faf6-4529-a05/people-priority/citizen
```

## Continuous Deployment

`.github/workflows/cd-gcp.yml` deploys automatically on every successful merge
to `main`. It can also be started manually from GitHub Actions.

The workflow:

1. Runs the deployment gate: `npm ci`, typecheck, build, Playwright functional
   tests, runtime config smoke, production dependency audit, Helm lint, and Helm
   render with `values-gcp.yaml`.
2. Authenticates to Google Cloud through Workload Identity Federation.
3. Builds and pushes immutable Artifact Registry images for `api`, `rag-api`,
   `web`, and `citizen`.
4. Updates the four image tags in `charts/people-priority/values-gcp.yaml` and
   commits that GitOps tag bump back to `main`.
5. Refreshes the existing Argo CD application `loksetu-gcp`, waits until Argo is
   synced to the new Git revision and healthy, checks Kubernetes rollout status,
   then runs public smoke checks against LokSetu and Apni Awaaz.

Required repository variables:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
GCP_PROJECT_ID=project-72558650-faf6-4529-a05
GCP_REGION=us-east4
GKE_CLUSTER_NAME=loksetu
ARGOCD_NAMESPACE=argocd
ARGOCD_APPLICATION=loksetu-gcp
VITE_CITIZEN_APP_URL=https://awaaz.shivam2003.com
```

Required IAM for the GitHub Actions service account:

```text
roles/artifactregistry.writer
roles/container.admin
```

The same identity must also have Kubernetes RBAC in the existing cluster for
the `argocd` and `people-priority` namespaces, because the workflow patches the
Argo CD `Application` and waits on workload rollouts.

## Cost Control

The GitHub Action `.github/workflows/gcp-power.yml` is for start/stop only. It does not delete infrastructure.

Stop does:

- Set GKE node pool autoscaling minimum to `0`.
- Resize the GKE node pool to `0`.
- Set Cloud SQL activation policy to `NEVER`.

Start does:

- Set Cloud SQL activation policy to `ALWAYS`.
- Restore node pool autoscaling minimum to `START_NODES`.
- Resize the node pool to `START_NODES`.

Preserved while stopped:

- Terraform state and resources.
- GKE cluster control plane.
- Static IP addresses.
- Load balancers and DNS mappings.
- Certificate Manager certificates.
- Artifact Registry images.
- Cloud SQL data and instance metadata.
- Argo CD GitOps manifests.

Required repository variables for power control:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
```

Required IAM for the GitHub Actions service account: `roles/container.admin`
and `roles/cloudsql.admin`.

Optional repository variables:

```text
GCP_PROJECT_ID=project-72558650-faf6-4529-a05
GCP_REGION=us-east4
GKE_CLUSTER_NAME=loksetu
GKE_NODE_POOL=primary
GKE_START_NODES=1
GKE_MAX_NODES=2
CLOUD_SQL_INSTANCE=loksetu-postgres
```

## RAG And Copilot

The Copilot is backed by the standalone RAG service and PostgreSQL/pgvector.

Current ingestion paths are configured in Helm:

```text
services/rag-api/fixtures/bihar/census-bihar-2011.md
services/rag-api/fixtures/loksetu/delhi-constituency-intelligence.md
services/rag-api/fixtures/loksetu/citizen-feedback-digest.md
services/rag-api/fixtures/loksetu/rag-architecture.md
```

`services/rag-api/fixtures/loksetu/rag-architecture.md` documents how the RAG system is built and is also ingested into the RAG corpus so broad technical questions can be answered from indexed context.

## Receipt Search

Apni Awaaz receipts can be searched by the 8-character receipt prefix shown after submission.

Endpoint:

```text
GET /api/citizen/receipts/:receiptId
```

The response is public-safe and does not expose raw citizen identity or personal details.

## Validation Commands

```bash
npm run typecheck
npm run build
helm lint charts/people-priority -f charts/people-priority/values-gcp.yaml
bash -n scripts/gcp-power.sh
```

## Terraform Commands

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" terraform -chdir=infra/terraform validate
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" terraform -chdir=infra/terraform plan -var-file=../../output/loksetu-gcp.auto.tfvars.json
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)" terraform -chdir=infra/terraform apply -var-file=../../output/loksetu-gcp.auto.tfvars.json
```
