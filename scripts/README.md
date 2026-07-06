# Operational Scripts

Local startup and bootstrap scripts for development and Argo CD verification.

## Commands
- `npm run local`: starts the full local development stack: pgvector Postgres, RAG API, embedding worker, API, LokSetu web, and Apni Awaaz.
- `npm run local:k8s`: builds images, creates kind cluster if needed, applies Argo CD, and deploys local apps.
- `./scripts/gcp-configure-safe.sh`: configures the local `loksetu-qwiklabs` gcloud profile without creating cloud resources.
- `./scripts/gcp-safety-check.sh`: verifies active account/project access before any cloud deployment command.
- `./scripts/gcp-sync-secrets.sh`: syncs production runtime secrets from environment variables or an ignored env file into Kubernetes Secrets.
- `./scripts/gcp-prune-artifact-images.sh`: removes old Artifact Registry image versions after keeping the latest tagged builds.

## Full Local Stack

```bash
npm install
npm run local
```

URLs:

- LokSetu web dashboard: `http://localhost:5173`
- Apni Awaaz citizen app: `http://localhost:5174`
- API: `http://localhost:18080`
- RAG API: `http://localhost:8090`
- Postgres: `postgres://loksetu:loksetu@localhost:5432/loksetu`

Default local login password: `local-dev`.

The script uses `pgvector/pgvector:pg16`, runs the RAG migrations, ingests the bundled LokSetu/Bihar fixture documents, creates hash embeddings, and then starts all long-running services with `concurrently`.

With `npm run local` still running, verify the local browser flows in another terminal:

```bash
npm run test:functional:local
```

If an older local Postgres volume was created from plain `postgres:16-alpine`, reset it once so pgvector is available:

```bash
docker compose -f docker-compose.local.yml down -v
npm run local
```

## Environment
- `LOCAL_IMAGE_TAG`: override local image tag.
- `VITE_GOOGLE_MAPS_API_KEY`: build-time browser Maps key.
- `GOOGLE_MAPS_API_KEY`: backend geocoding secret value.
- `OPENAI_COMPATIBLE_API_KEY`: AI secret value.
- `X_BEARER_TOKEN`: X recent-search bearer token for live external signals.
- `NEWS_API_KEY`: NewsAPI.org key for live news signals.
- `APP_ACCESS_PASSWORD`: local app login password. Defaults to `local-dev`.
- `RAG_INGEST_PATHS`: comma-separated local or `gs://` documents to seed into RAG.
- `RAG_EMBEDDING_PROVIDER`: defaults to `hash` for offline local development.

## Safety
`npm run local` loads `.env.local` when present. `.env.local` is ignored by Git.
Scripts create Kubernetes Secrets from environment variables. They do not write secrets to Git.
The GCP safety scripts only read or update local Cloud SDK config. They do not enable APIs, create resources, or run Terraform.

## GCP Runtime Secrets

Create an ignored env file such as `.env.gcp.local`, then run:

```bash
ENV_FILE=.env.gcp.local ./scripts/gcp-sync-secrets.sh
```

Required values:

- `APP_ACCESS_PASSWORD`: fallback API password for legacy/password-only clients.
- `APP_AUTH_SECRET`: token signing secret.
- `APP_ADMIN_USERNAME`: seeded admin username.
- `APP_ADMIN_PASSWORD`: seeded admin password.
- `GOOGLE_MAPS_API_KEY`: backend Maps key.
- `PUBLIC_GOOGLE_MAPS_API_KEY`: browser Maps key.
- `NEWS_API_KEY`: NewsAPI key.
- `X_BEARER_TOKEN`: X API bearer token.

Do not commit `.env.gcp.local` or any other secret file.

## Artifact Registry Pruning

Preview old image cleanup:

```bash
DRY_RUN=true KEEP=8 ./scripts/gcp-prune-artifact-images.sh
```

Delete old image versions after reviewing the preview:

```bash
DRY_RUN=false KEEP=8 ./scripts/gcp-prune-artifact-images.sh
```
