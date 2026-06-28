#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
export VERTEX_AI_LOCATION="${VERTEX_AI_LOCATION:-us-central1}"
export VERTEX_AI_MODEL="${VERTEX_AI_MODEL:-gemini-1.5-flash}"

npm install
npm run dev
