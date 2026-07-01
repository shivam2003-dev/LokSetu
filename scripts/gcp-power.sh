#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
PROJECT_ID="${PROJECT_ID:-project-72558650-faf6-4529-a05}"
REGION="${REGION:-us-east4}"
CLUSTER_NAME="${CLUSTER_NAME:-loksetu}"
NODE_POOL="${NODE_POOL:-primary}"
START_NODES="${START_NODES:-1}"
MAX_NODES="${MAX_NODES:-2}"
SQL_INSTANCE="${SQL_INSTANCE:-loksetu-postgres}"
WORKLOAD_NAMESPACE="${WORKLOAD_NAMESPACE:-people-priority}"

configure_kubectl() {
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for $ACTION but is not installed" >&2
    exit 1
  fi

  gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --quiet
}

case "$ACTION" in
  start)
    gcloud sql instances patch "$SQL_INSTANCE" \
      --project="$PROJECT_ID" \
      --activation-policy=ALWAYS \
      --quiet
    gcloud container node-pools update "$NODE_POOL" \
      --cluster="$CLUSTER_NAME" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --enable-autoscaling \
      --min-nodes="$START_NODES" \
      --max-nodes="$MAX_NODES" \
      --quiet
    gcloud container clusters resize "$CLUSTER_NAME" \
      --node-pool="$NODE_POOL" \
      --num-nodes="$START_NODES" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --quiet
    configure_kubectl
    kubectl -n argocd annotate application loksetu-gcp argocd.argoproj.io/refresh=hard --overwrite || true
    kubectl -n argocd patch application loksetu-gcp --type merge -p '{}' || true
    ;;
  stop)
    configure_kubectl
    kubectl -n "$WORKLOAD_NAMESPACE" delete pdb --all --ignore-not-found=true
    gcloud container node-pools update "$NODE_POOL" \
      --cluster="$CLUSTER_NAME" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --enable-autoscaling \
      --min-nodes=0 \
      --max-nodes="$MAX_NODES" \
      --quiet
    gcloud container clusters resize "$CLUSTER_NAME" \
      --node-pool="$NODE_POOL" \
      --num-nodes=0 \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --quiet
    gcloud sql instances patch "$SQL_INSTANCE" \
      --project="$PROJECT_ID" \
      --activation-policy=NEVER \
      --quiet
    ;;
  status)
    gcloud container node-pools describe "$NODE_POOL" \
      --cluster="$CLUSTER_NAME" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --format="table(name,status,autoscaling.enabled,autoscaling.minNodeCount,autoscaling.maxNodeCount,initialNodeCount)"
    gcloud sql instances describe "$SQL_INSTANCE" \
      --project="$PROJECT_ID" \
      --format="table(name,state,settings.activationPolicy,region,databaseVersion)"
    ;;
  *)
    echo "Usage: $0 start|stop|status" >&2
    exit 2
    ;;
esac
