# Water-cannon email alerts

LokSetu records a Google Cloud Monitoring custom metric when an authorized dashboard user requests a water-cannon deployment for an area with severe air pollution. The production threshold defaults to AQI 301. A Cloud Monitoring alert policy sends the incident email; no SMTP password, Gmail token, or service-account key is stored in the repository.

The API uses the existing GKE Workload Identity service account and its `roles/monitoring.metricWriter` permission. Production enables the integration with `WATER_CANNON_ALERTS_ENABLED=true`. Local and test environments validate the request but do not contact Google Cloud.

Configure or reconcile the metric descriptor, notification channel, and alert policy with the authenticated `gcloud` account:

```bash
GCP_PROJECT_ID=project-72558650-faf6-4529-a05 \
  ./scripts/configure-water-cannon-alert.sh shivam.sk2003@gmail.com
```

Add `--test` as the second argument to emit one AQI 318 test event. Cloud Monitoring emails when the incident opens. The dashboard action and `POST /api/alerts/water-cannon` require `projects:update`, enforce the signed-in user's configured geography, reject AQI below the configured threshold, and add an audit event.
