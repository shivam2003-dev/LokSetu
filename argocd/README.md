# Argo CD Applications

GitOps definitions for deploying LokSetu components from the Helm chart.

## Files
- `application.yaml`: production-style split applications.
- `application-local.yaml`: local kind/Docker Desktop deployment.

## Commands
```bash
kubectl apply -f argocd/application-local.yaml
kubectl get applications -n argocd -o wide
kubectl -n argocd annotate application loksetu-web-local argocd.argoproj.io/refresh=hard --overwrite
```

## Notes
Argo CD tracks Git state. Local Secrets for Maps and AI are created outside Git by `scripts/start-local-k8s-argocd.sh`.
