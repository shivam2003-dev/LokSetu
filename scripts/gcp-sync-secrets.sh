#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-people-priority}"
ENV_FILE="${ENV_FILE:-}"

if [[ -n "${ENV_FILE}" ]]; then
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ENV_FILE not found: ${ENV_FILE}" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

for name in APP_ACCESS_PASSWORD APP_AUTH_SECRET APP_ADMIN_USERNAME APP_ADMIN_PASSWORD GOOGLE_MAPS_API_KEY PUBLIC_GOOGLE_MAPS_API_KEY NEWS_API_KEY X_BEARER_TOKEN; do
  require_env "${name}"
done

kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "${NAMESPACE}" create secret generic loksetu-app-auth \
  --from-literal=password="${APP_ACCESS_PASSWORD}" \
  --from-literal=token-secret="${APP_AUTH_SECRET}" \
  --from-literal=admin-username="${APP_ADMIN_USERNAME}" \
  --from-literal=admin-password="${APP_ADMIN_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "${NAMESPACE}" create secret generic loksetu-google-maps-server \
  --from-literal=api-key="${GOOGLE_MAPS_API_KEY}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "${NAMESPACE}" create secret generic loksetu-google-maps-browser \
  --from-literal=api-key="${PUBLIC_GOOGLE_MAPS_API_KEY}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "${NAMESPACE}" create secret generic loksetu-external-signals \
  --from-literal=news-api-key="${NEWS_API_KEY}" \
  --from-literal=x-bearer-token="${X_BEARER_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Synced LokSetu runtime secrets into namespace ${NAMESPACE}."
