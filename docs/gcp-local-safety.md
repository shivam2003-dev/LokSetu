# GCP Local Safety Setup

This repository is configured to avoid accidental Google Cloud spend during local development. The current rule is: do not create cloud resources until the operator explicitly approves a deployment step.

## Current Local Profile

Use the dedicated local profile:

```bash
gcloud config configurations activate loksetu-qwiklabs
gcloud config list
```

Configured values:

```text
account: itz.shivam.off17@gmail.com
project: qwiklabs-gcp-00-1384d79b55f6
region: us-east4
zone: us-east4-b
run/region: us-east4
disable_prompts: true
disable_usage_reporting: true
impersonate_service_account: unset
```

This is local CLI configuration only. It does not enable APIs, create resources, or run Terraform.

## Safety Check

Run this before any cloud-facing command:

```bash
scripts/gcp-safety-check.sh
```

The check verifies the active account, project, region, zone, and whether the account can read the project. If project access fails, stop and fix IAM or Qwiklabs credentials first.

## Cost Guardrails

Allowed without approval:

```bash
gcloud config list
gcloud auth list
gcloud projects describe PROJECT_ID
terraform fmt -check -recursive infra/terraform
terraform validate
terraform plan
```

Requires explicit approval:

```bash
gcloud services enable ...
gcloud container clusters create ...
gcloud sql instances create ...
terraform apply
terraform destroy
```

For production, create billing budgets and alerts in the Google Cloud console before applying Terraform. Do not commit billing accounts, service account keys, API keys, access tokens, or generated `.tfvars` files.

## Current Access Note

On 2026-06-29, `gcloud auth login` authenticated `itz.shivam.off17@gmail.com`, but `gcloud projects describe qwiklabs-gcp-00-1384d79b55f6` returned permission denied. That means the local profile is configured, but the account cannot currently operate this project. No resources were created.
