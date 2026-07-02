#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker missing"
  exit 1
fi

docker compose -f docker-compose.local.yml up -d postgres

echo "waiting for postgres"
until docker exec loksetu-postgres pg_isready -U loksetu -d loksetu >/dev/null 2>&1; do
  sleep 1
done

export DATABASE_URL="${DATABASE_URL:-postgres://loksetu:loksetu@localhost:5432/loksetu}"
export RAG_DATABASE_URL="${RAG_DATABASE_URL:-$DATABASE_URL}"
export RAG_API_URL="${RAG_API_URL:-http://127.0.0.1:8090}"
export RAG_EMBEDDING_PROVIDER="${RAG_EMBEDDING_PROVIDER:-hash}"
export RAG_LLM_PROVIDER="${RAG_LLM_PROVIDER:-extractive}"
export RAG_INGEST_PATHS="${RAG_INGEST_PATHS:-$ROOT_DIR/services/rag-api/fixtures/loksetu/rag-architecture.md,$ROOT_DIR/services/rag-api/fixtures/loksetu/delhi-constituency-intelligence.md,$ROOT_DIR/services/rag-api/fixtures/loksetu/citizen-feedback-digest.md,$ROOT_DIR/services/rag-api/fixtures/bihar/census-bihar-2011.md}"
export VERTEX_AI_LOCATION="${VERTEX_AI_LOCATION:-us-central1}"
export VERTEX_AI_MODEL="${VERTEX_AI_MODEL:-gemini-1.5-flash}"
export APP_ACCESS_PASSWORD="${APP_ACCESS_PASSWORD:-local-dev}"
export APP_AUTH_SECRET="${APP_AUTH_SECRET:-local-dev-secret}"

npm install

echo "seeding local RAG corpus"
WORKER_RUN_ONCE=true npm run ingestion-worker:dev -w services/rag-api
WORKER_RUN_ONCE=true npm run embedding-worker:dev -w services/rag-api

echo ""
echo "LokSetu local stack starting"
echo "  LokSetu web:  http://localhost:5173"
echo "  Apni Awaaz:   http://localhost:5174"
echo "  API:          http://localhost:18080"
echo "  RAG API:      http://localhost:8090"
echo "  Postgres:     postgres://loksetu:loksetu@localhost:5432/loksetu"
echo "  Login pass:   ${APP_ACCESS_PASSWORD}"
echo ""

npx concurrently \
  --names "rag,embed,api,web,awaaz" \
  --prefix-colors "magenta,cyan,green,blue,yellow" \
  "PORT=8090 npm run dev -w services/rag-api" \
  "npm run embedding-worker:dev -w services/rag-api" \
  "PORT=18080 npm run dev -w services/api" \
  "VITE_API_BASE_URL=http://127.0.0.1:18080 npm run dev -w apps/web" \
  "VITE_API_BASE_URL=http://127.0.0.1:18080 npm run dev -w apps/citizen"
