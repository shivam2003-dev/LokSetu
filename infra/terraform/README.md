# GCP Terraform

Infrastructure-as-code for production Google Cloud resources: network, GKE, IAM, Artifact Registry, SQL/data services, and supporting outputs.

## Commands
```bash
scripts/gcp-safety-check.sh
terraform fmt -check -recursive infra/terraform
cd infra/terraform
terraform init
terraform validate
terraform plan
```

Do not run `terraform apply` until project access, billing alerts, and the intended resource list have been reviewed.

## Variables
See `variables.tf` for project, region, cluster, and networking inputs. Do not store credentials or API keys in `.tfvars` committed to Git.

## Deployment
Use Terraform for cloud infrastructure and Argo CD for Kubernetes workloads. Keep Secret Manager/Kubernetes secret injection separate from checked-in configuration.
