#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLUSTER_NAME="${CLUSTER_NAME:-loksetu}"
NAMESPACE="${NAMESPACE:-people-priority}"
LOCAL_IMAGE_TAG="${LOCAL_IMAGE_TAG:-local-20260629-dashboard}"

for bin in docker kind kubectl helm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "$bin missing"
    exit 1
  fi
done

if ! kind get clusters | grep -qx "$CLUSTER_NAME"; then
  kind create cluster --name "$CLUSTER_NAME"
fi
kubectl config use-context "kind-${CLUSTER_NAME}"

docker build -f services/api/Dockerfile -t "people-priority-api:${LOCAL_IMAGE_TAG}" .
docker build -f apps/web/Dockerfile -t "people-priority-web:${LOCAL_IMAGE_TAG}" .
docker build -f apps/citizen/Dockerfile -t "people-priority-citizen:${LOCAL_IMAGE_TAG}" .
kind load docker-image "people-priority-api:${LOCAL_IMAGE_TAG}" --name "$CLUSTER_NAME"
kind load docker-image "people-priority-web:${LOCAL_IMAGE_TAG}" --name "$CLUSTER_NAME"
kind load docker-image "people-priority-citizen:${LOCAL_IMAGE_TAG}" --name "$CLUSTER_NAME"

kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply --server-side -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deployment/argocd-server --timeout=180s

kubectl -n argocd delete application people-priority-local --ignore-not-found
kubectl apply -f argocd/application-local.yaml

kubectl -n "$NAMESPACE" rollout status deployment/people-priority-api --timeout=180s
kubectl -n "$NAMESPACE" rollout status deployment/people-priority-web --timeout=180s
kubectl -n "$NAMESPACE" rollout status deployment/people-priority-citizen --timeout=180s

cat <<EOF
Local Kubernetes ready.

Dashboard:
  kubectl -n $NAMESPACE port-forward svc/people-priority-web 5173:80

Citizen app:
  kubectl -n $NAMESPACE port-forward svc/people-priority-citizen 5174:80

API:
  kubectl -n $NAMESPACE port-forward svc/people-priority-api 8080:8080

Argo CD:
  kubectl -n argocd port-forward svc/argocd-server 8081:443
  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
EOF
