# Argo CD Applications

GitOps definitions for deploying LokSetu components from the Helm chart.

## Files
- `application.yaml`: production-style split applications.
- `application-local.yaml`: local kind/Docker Desktop deployment.
- `application-gcp.yaml`: active GCP LokSetu application.
- `observability.yaml`: optional Grafana, Prometheus, Loki, Tempo, and OpenTelemetry applications.
- `kustomization.yaml`: GCP Argo app switchboard. Observability is commented by default to save cost.

## Commands
```bash
kubectl apply -k argocd
kubectl apply -f argocd/application-local.yaml
kubectl get applications -n argocd -o wide
kubectl -n argocd annotate application loksetu-web-local argocd.argoproj.io/refresh=hard --overwrite
```

## Enable Observability

Uncomment this line in `argocd/kustomization.yaml`:

```yaml
# - observability.yaml
```

Apply:

```bash
kubectl apply -k argocd
```

## Disable Observability

Comment the same line again, apply Kustomize, then delete the observability applications:

```bash
kubectl apply -k argocd
kubectl -n argocd delete application observability-kube-prometheus-stack observability-loki observability-tempo observability-otel-collector loksetu-observability-config --ignore-not-found
kubectl delete namespace observability --ignore-not-found
```

## Notes
Argo CD tracks Git state. Local Secrets for Maps and AI are created outside Git by `scripts/start-local-k8s-argocd.sh`.
