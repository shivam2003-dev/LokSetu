provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  services = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "pubsub.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
    "speech.googleapis.com",
    "vision.googleapis.com",
    "translate.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com"
  ])
}

resource "google_project_service" "required" {
  for_each           = local.services
  service            = each.key
  disable_on_destroy = false
}

resource "google_compute_network" "main" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.required]
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.cluster_name}-subnet"
  ip_cidr_range = "10.20.0.0/20"
  region        = var.region
  network       = google_compute_network.main.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.24.0.0/14"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.28.0.0/20"
  }
}

resource "google_compute_global_address" "private_service_range" {
  name          = "${var.cluster_name}-private-service-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range.name]
}

resource "google_compute_global_address" "ingress_ip" {
  name = "${var.cluster_name}-ingress-ip"
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "people-priority"
  format        = "DOCKER"
}

resource "google_storage_bucket" "raw_media" {
  name                        = "${var.project_id}-${var.cluster_name}-raw-media"
  location                    = var.region
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_storage_bucket" "processed_artifacts" {
  name                        = "${var.project_id}-${var.cluster_name}-processed-artifacts"
  location                    = var.region
  uniform_bucket_level_access = true
}

resource "google_pubsub_topic" "submissions" {
  name = "${var.cluster_name}-submissions"
}

resource "google_pubsub_subscription" "batch_submissions" {
  name                 = "${var.cluster_name}-batch-submissions"
  topic                = google_pubsub_topic.submissions.name
  ack_deadline_seconds = 120
}

resource "google_pubsub_topic" "batch_jobs" {
  name = "${var.cluster_name}-batch-jobs"
}

resource "google_pubsub_subscription" "batch_jobs" {
  name                 = "${var.cluster_name}-batch-jobs"
  topic                = google_pubsub_topic.batch_jobs.name
  ack_deadline_seconds = 300
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id                 = replace("${var.cluster_name}_analytics", "-", "_")
  location                   = var.region
  delete_contents_on_destroy = false
}

resource "google_bigquery_table" "processed_submissions" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "processed_submissions"

  time_partitioning {
    type  = "DAY"
    field = "processed_at"
  }

  clustering = ["state", "district", "category"]

  schema = jsonencode([
    { name = "id", type = "STRING", mode = "REQUIRED" },
    { name = "state", type = "STRING", mode = "NULLABLE" },
    { name = "district", type = "STRING", mode = "NULLABLE" },
    { name = "ward", type = "STRING", mode = "NULLABLE" },
    { name = "category", type = "STRING", mode = "NULLABLE" },
    { name = "detected_language", type = "STRING", mode = "NULLABLE" },
    { name = "score", type = "INTEGER", mode = "NULLABLE" },
    { name = "processed_at", type = "TIMESTAMP", mode = "NULLABLE" }
  ])
}

resource "google_sql_database_instance" "postgres" {
  name             = "${var.cluster_name}-postgres"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = "REGIONAL"
    disk_autoresize   = true
    disk_size         = 50

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "20:00"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }
  }

  deletion_protection = true
  depends_on          = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "app" {
  name     = "loksetu"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  name     = "loksetu"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

resource "google_service_account" "app" {
  account_id   = "${var.cluster_name}-app"
  display_name = "LokSetu GKE workload identity"
}

resource "google_project_iam_member" "app_roles" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/speech.client",
    "roles/cloudtranslate.user",
    "roles/bigquery.dataEditor",
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
    "roles/storage.objectAdmin",
    "roles/cloudsql.client",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter"
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[people-priority/people-priority]"
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.cluster_name}-database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgres://loksetu:${var.db_password}@/${google_sql_database.app.name}?host=/cloudsql/${google_sql_database_instance.postgres.connection_name}"
}

resource "google_container_cluster" "main" {
  name     = var.cluster_name
  location = var.region

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.main.id

  remove_default_node_pool = true
  initial_node_count       = 1

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_container_node_pool" "primary" {
  name       = "primary"
  location   = var.region
  cluster    = google_container_cluster.main.name
  node_count = 2

  autoscaling {
    min_node_count = 2
    max_node_count = 6
  }

  node_config {
    machine_type = "e2-standard-4"
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }
}
