#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PROJECT="${GOOGLE_CLOUD_PROJECT:-qwiklabs-gcp-00-1384d79b55f6}"
EXPECTED_ACCOUNT="${GOOGLE_CLOUD_ACCOUNT:-itz.shivam.off17@gmail.com}"

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
ACTIVE_PROJECT="$(gcloud config get-value core/project 2>/dev/null || true)"
ACTIVE_REGION="$(gcloud config get-value compute/region 2>/dev/null || true)"
ACTIVE_ZONE="$(gcloud config get-value compute/zone 2>/dev/null || true)"

echo "gcloud safety check"
echo "account: ${ACTIVE_ACCOUNT:-unset}"
echo "project: ${ACTIVE_PROJECT:-unset}"
echo "region:  ${ACTIVE_REGION:-unset}"
echo "zone:    ${ACTIVE_ZONE:-unset}"

if [[ "$ACTIVE_ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
  echo "ERROR: active account does not match expected account: $EXPECTED_ACCOUNT" >&2
  exit 1
fi

if [[ "$ACTIVE_PROJECT" != "$EXPECTED_PROJECT" ]]; then
  echo "ERROR: active project does not match expected project: $EXPECTED_PROJECT" >&2
  exit 1
fi

if ! gcloud projects describe "$EXPECTED_PROJECT" --format='value(projectId)' >/dev/null 2>&1; then
  echo "ERROR: active account cannot read project $EXPECTED_PROJECT." >&2
  echo "Do not run Terraform, API enablement, GKE, Cloud SQL, or deployment commands until IAM access is fixed." >&2
  exit 2
fi

echo "Project access: ok"

if gcloud billing projects describe "$EXPECTED_PROJECT" --format='value(billingEnabled)' >/tmp/loksetu-billing-enabled 2>/dev/null; then
  echo "billingEnabled: $(cat /tmp/loksetu-billing-enabled)"
else
  echo "billingEnabled: unknown; billing API access was not available"
fi

echo "Safe commands at this stage: gcloud config list, gcloud projects describe, terraform fmt, terraform validate, terraform plan."
echo "Blocked until explicitly approved: terraform apply, gcloud services enable, gcloud container clusters create, gcloud sql instances create."
