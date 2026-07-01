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
ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"

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

scale_namespace_workloads() {
  local namespace="$1"
  local replicas="$2"

  kubectl -n "$namespace" scale deployment --all --replicas="$replicas" --timeout=180s || true
  kubectl -n "$namespace" scale statefulset --all --replicas="$replicas" --timeout=180s || true
}

scale_argocd_controller() {
  local replicas="$1"
  kubectl -n "$ARGOCD_NAMESPACE" scale statefulset/argocd-application-controller --replicas="$replicas" --timeout=120s || true
}

scale_argocd() {
  local replicas="$1"

  scale_namespace_workloads "$ARGOCD_NAMESPACE" "$replicas"
  scale_argocd_controller "$replicas"
}

set_sql_activation_policy() {
  local policy="$1"
  local current_policy

  current_policy="$(gcloud sql instances describe "$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --format="value(settings.activationPolicy)")"

  if [[ "$current_policy" == "$policy" ]]; then
    echo "Cloud SQL $SQL_INSTANCE already has activationPolicy=$policy"
    return
  fi

  gcloud sql instances patch "$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --activation-policy="$policy" \
    --quiet
}

case "$ACTION" in
  start)
    set_sql_activation_policy ALWAYS
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
    scale_argocd 1
    kubectl -n "$ARGOCD_NAMESPACE" rollout status deployment --all --timeout=300s || true
    kubectl -n "$ARGOCD_NAMESPACE" rollout status statefulset/argocd-application-controller --timeout=300s || true
    kubectl -n "$ARGOCD_NAMESPACE" annotate application loksetu-gcp argocd.argoproj.io/refresh=hard --overwrite || true
    kubectl -n "$ARGOCD_NAMESPACE" patch application loksetu-gcp --type merge -p '{}' || true
    ;;
  stop)
    configure_kubectl
    scale_argocd_controller 0
    kubectl -n "$WORKLOAD_NAMESPACE" delete cronjob --all --ignore-not-found=true
    kubectl -n "$WORKLOAD_NAMESPACE" delete job --all --ignore-not-found=true
    kubectl -n "$WORKLOAD_NAMESPACE" delete hpa --all --ignore-not-found=true
    kubectl -n "$WORKLOAD_NAMESPACE" delete pdb --all --ignore-not-found=true
    scale_namespace_workloads "$WORKLOAD_NAMESPACE" 0
    kubectl -n "$WORKLOAD_NAMESPACE" wait --for=delete pod --all --timeout=240s || true
    scale_argocd 0
    kubectl -n "$ARGOCD_NAMESPACE" wait --for=delete pod --all --timeout=240s || true
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
    set_sql_activation_policy NEVER
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
