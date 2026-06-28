# Helm Chart

Kubernetes packaging for API, web dashboard, citizen app, batch CronJob, Postgres, services, ingress, HPA, and service accounts.

## Commands
- `helm lint charts/people-priority`
- `helm template people-priority charts/people-priority`
- `helm template people-priority charts/people-priority -f charts/people-priority/values-local.yaml`

## Values
- `values.yaml`: production defaults for GCP/GKE.
- `values-local.yaml`: local image tags and in-cluster Postgres.
- `values-*-platform/web/apni-awaaz.yaml`: split Argo CD application surfaces.

## Secrets
Use Kubernetes Secrets for `OPENAI_COMPATIBLE_API_KEY` and `GOOGLE_MAPS_API_KEY`. Browser Maps keys are build-time Vite values and should be restricted by referrer.

## Deployment
Argo CD reads this chart from Git and reconciles cluster state. Do not edit live Kubernetes resources except for local secret creation.
