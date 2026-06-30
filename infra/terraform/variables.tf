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

variable "db_availability_type" {
  description = "Cloud SQL availability type"
  type        = string
  default     = "REGIONAL"
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

variable "node_locations" {
  description = "GKE node zones. Keep this small in quota-limited projects."
  type        = list(string)
  default     = []
}

variable "node_count" {
  description = "Initial nodes per selected zone"
  type        = number
  default     = 1
}

variable "node_min_count" {
  description = "Minimum nodes per selected zone"
  type        = number
  default     = 1
}

variable "node_max_count" {
  description = "Maximum nodes per selected zone"
  type        = number
  default     = 3
}

variable "node_machine_type" {
  description = "GKE node machine type"
  type        = string
  default     = "e2-standard-2"
}

variable "node_disk_size_gb" {
  description = "GKE node boot disk size in GB"
  type        = number
  default     = 30
}

variable "manual_lb_enabled" {
  description = "Create Terraform-managed external HTTP(S) load balancers for GKE NEGs"
  type        = bool
  default     = false
}

variable "manual_lb_neg_zone" {
  description = "Zone containing GKE network endpoint groups"
  type        = string
  default     = ""
}

variable "manual_lb_web_neg_name" {
  description = "NEG name for web service"
  type        = string
  default     = ""
}

variable "manual_lb_api_neg_name" {
  description = "NEG name for API service"
  type        = string
  default     = ""
}

variable "manual_lb_rag_neg_name" {
  description = "NEG name for RAG API service"
  type        = string
  default     = ""
}

variable "manual_lb_citizen_neg_name" {
  description = "NEG name for citizen service"
  type        = string
  default     = ""
}

variable "manual_lb_argocd_neg_name" {
  description = "NEG name for Argo CD service"
  type        = string
  default     = ""
}
