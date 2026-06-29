#!/usr/bin/env bash
set -euo pipefail

CONFIG_NAME="${GCLOUD_CONFIG_NAME:-loksetu-qwiklabs}"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-qwiklabs-gcp-00-1384d79b55f6}"
ACCOUNT="${GOOGLE_CLOUD_ACCOUNT:-itz.shivam.off17@gmail.com}"
REGION="${GOOGLE_CLOUD_REGION:-us-east4}"
ZONE="${GOOGLE_CLOUD_ZONE:-us-east4-b}"

if gcloud config configurations describe "$CONFIG_NAME" >/dev/null 2>&1; then
  gcloud config configurations activate "$CONFIG_NAME"
else
  gcloud config configurations create "$CONFIG_NAME"
fi

gcloud config set core/account "$ACCOUNT"
gcloud config set core/project "$PROJECT_ID"
gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"
gcloud config set run/region "$REGION"
gcloud config set core/disable_prompts true
gcloud config set core/disable_usage_reporting true
gcloud config unset auth/impersonate_service_account >/dev/null 2>&1 || true

echo "Configured local gcloud profile only. No GCP resources were created."
gcloud config list --format="yaml(core,compute,run,auth)"
