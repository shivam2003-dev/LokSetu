variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
  default     = "people-priority"
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-2-7680"
}

variable "db_password" {
  description = "Initial Postgres app user password"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Production host for GKE Ingress and managed certificate"
  type        = string
  default     = "people-priority.example.gov"
}
