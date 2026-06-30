provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  services = toset([
    "apikeys.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "geocoding-backend.googleapis.com",
    "iam.googleapis.com",
    "maps-backend.googleapis.com",
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

  node_locations = length(var.node_locations) > 0 ? var.node_locations : ["${var.region}-a"]
  manual_lb_zone = var.manual_lb_neg_zone != "" ? var.manual_lb_neg_zone : local.node_locations[0]
  maps_allowed_referrers = [
    "http://loksetu.shivam2003.com/*",
    "https://loksetu.shivam2003.com/*",
    "http://awaaz.shivam2003.com/*",
    "https://awaaz.shivam2003.com/*",
    "http://argocd.shivam2003.com/*",
    "https://argocd.shivam2003.com/*"
  ]
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each           = local.services
  service            = each.key
  disable_on_destroy = false
}

resource "google_apikeys_key" "maps_browser" {
  name         = "${var.cluster_name}-maps-browser"
  display_name = "${var.cluster_name} Maps browser key"

  restrictions {
    browser_key_restrictions {
      allowed_referrers = local.maps_allowed_referrers
    }

    api_targets {
      service = "maps-backend.googleapis.com"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_apikeys_key" "maps_server" {
  name         = "${var.cluster_name}-maps-server"
  display_name = "${var.cluster_name} Maps server key"

  restrictions {
    api_targets {
      service = "geocoding-backend.googleapis.com"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_compute_network" "main" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.required]
}

resource "google_compute_subnetwork" "main" {
  name                     = "${var.cluster_name}-subnet"
  ip_cidr_range            = "10.20.0.0/20"
  region                   = var.region
  network                  = google_compute_network.main.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.24.0.0/14"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.28.0.0/20"
  }
}

resource "google_compute_router" "main" {
  name    = "${var.cluster_name}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "${var.cluster_name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_compute_firewall" "allow_gfe_health_checks" {
  name    = "${var.cluster_name}-allow-gfe-health-checks"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80", "8080", "8090"]
  }

  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
}

data "google_compute_network_endpoint_group" "web" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = var.manual_lb_web_neg_name
  zone  = local.manual_lb_zone
}

data "google_compute_network_endpoint_group" "api" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = var.manual_lb_api_neg_name
  zone  = local.manual_lb_zone
}

data "google_compute_network_endpoint_group" "rag" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = var.manual_lb_rag_neg_name
  zone  = local.manual_lb_zone
}

data "google_compute_network_endpoint_group" "citizen" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = var.manual_lb_citizen_neg_name
  zone  = local.manual_lb_zone
}

data "google_compute_network_endpoint_group" "argocd" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = var.manual_lb_argocd_neg_name
  zone  = local.manual_lb_zone
}

resource "google_compute_health_check" "manual_lb_web" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = "${var.cluster_name}-manual-web-hc"

  http_health_check {
    port_specification = "USE_SERVING_PORT"
    request_path       = "/"
  }
}

resource "google_compute_health_check" "manual_lb_api" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = "${var.cluster_name}-manual-api-hc"

  http_health_check {
    port_specification = "USE_SERVING_PORT"
    request_path       = "/healthz"
  }
}

resource "google_compute_health_check" "manual_lb_rag" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = "${var.cluster_name}-manual-rag-hc"

  http_health_check {
    port_specification = "USE_SERVING_PORT"
    request_path       = "/ready"
  }
}

resource "google_compute_health_check" "manual_lb_argocd" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = "${var.cluster_name}-manual-argocd-hc"

  http_health_check {
    port_specification = "USE_SERVING_PORT"
    request_path       = "/healthz"
  }
}

resource "google_compute_backend_service" "manual_lb_web" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-web"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  health_checks         = [google_compute_health_check.manual_lb_web[0].id]

  backend {
    group                 = data.google_compute_network_endpoint_group.web[0].id
    balancing_mode        = "RATE"
    max_rate_per_endpoint = 100
  }
}

resource "google_compute_backend_service" "manual_lb_api" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-api"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  health_checks         = [google_compute_health_check.manual_lb_api[0].id]

  backend {
    group                 = data.google_compute_network_endpoint_group.api[0].id
    balancing_mode        = "RATE"
    max_rate_per_endpoint = 100
  }
}

resource "google_compute_backend_service" "manual_lb_rag" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-rag"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  health_checks         = [google_compute_health_check.manual_lb_rag[0].id]

  backend {
    group                 = data.google_compute_network_endpoint_group.rag[0].id
    balancing_mode        = "RATE"
    max_rate_per_endpoint = 100
  }
}

resource "google_compute_backend_service" "manual_lb_citizen" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-citizen"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  health_checks         = [google_compute_health_check.manual_lb_web[0].id]

  backend {
    group                 = data.google_compute_network_endpoint_group.citizen[0].id
    balancing_mode        = "RATE"
    max_rate_per_endpoint = 100
  }
}

resource "google_compute_backend_service" "manual_lb_argocd" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-argocd"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  health_checks         = [google_compute_health_check.manual_lb_argocd[0].id]

  backend {
    group                 = data.google_compute_network_endpoint_group.argocd[0].id
    balancing_mode        = "RATE"
    max_rate_per_endpoint = 100
  }
}

resource "google_compute_managed_ssl_certificate" "manual_lb_app" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = "${var.cluster_name}-manual-app-cert"

  managed {
    domains = ["loksetu.shivam2003.com", "awaaz.shivam2003.com"]
  }
}

resource "google_compute_managed_ssl_certificate" "manual_lb_argocd" {
  count = var.manual_lb_enabled ? 1 : 0
  name  = "${var.cluster_name}-manual-argocd-cert"

  managed {
    domains = ["argocd.shivam2003.com"]
  }
}

resource "google_compute_url_map" "manual_lb_app" {
  count           = var.manual_lb_enabled ? 1 : 0
  name            = "${var.cluster_name}-manual-app-url-map"
  default_service = google_compute_backend_service.manual_lb_web[0].id

  host_rule {
    hosts        = ["loksetu.shivam2003.com"]
    path_matcher = "loksetu"
  }

  host_rule {
    hosts        = ["awaaz.shivam2003.com"]
    path_matcher = "awaaz"
  }

  path_matcher {
    name            = "loksetu"
    default_service = google_compute_backend_service.manual_lb_web[0].id

    path_rule {
      paths   = ["/api", "/api/*"]
      service = google_compute_backend_service.manual_lb_api[0].id
    }

    path_rule {
      paths   = ["/rag", "/rag/*"]
      service = google_compute_backend_service.manual_lb_rag[0].id
    }
  }

  path_matcher {
    name            = "awaaz"
    default_service = google_compute_backend_service.manual_lb_citizen[0].id
  }
}

resource "google_compute_url_map" "manual_lb_argocd" {
  count           = var.manual_lb_enabled ? 1 : 0
  name            = "${var.cluster_name}-manual-argocd-url-map"
  default_service = google_compute_backend_service.manual_lb_argocd[0].id
}

resource "google_compute_target_http_proxy" "manual_lb_app" {
  count   = var.manual_lb_enabled ? 1 : 0
  name    = "${var.cluster_name}-manual-app-http-proxy"
  url_map = google_compute_url_map.manual_lb_app[0].id
}

resource "google_compute_target_https_proxy" "manual_lb_app" {
  count            = var.manual_lb_enabled ? 1 : 0
  name             = "${var.cluster_name}-manual-app-https-proxy"
  url_map          = google_compute_url_map.manual_lb_app[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.manual_lb_app[0].id]
}

resource "google_compute_target_http_proxy" "manual_lb_argocd" {
  count   = var.manual_lb_enabled ? 1 : 0
  name    = "${var.cluster_name}-manual-argocd-http-proxy"
  url_map = google_compute_url_map.manual_lb_argocd[0].id
}

resource "google_compute_target_https_proxy" "manual_lb_argocd" {
  count            = var.manual_lb_enabled ? 1 : 0
  name             = "${var.cluster_name}-manual-argocd-https-proxy"
  url_map          = google_compute_url_map.manual_lb_argocd[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.manual_lb_argocd[0].id]
}

resource "google_compute_global_forwarding_rule" "manual_lb_app_http" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-app-http"
  ip_address            = google_compute_global_address.ingress_ip.address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_http_proxy.manual_lb_app[0].id
}

resource "google_compute_global_forwarding_rule" "manual_lb_app_https" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-app-https"
  ip_address            = google_compute_global_address.ingress_ip.address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_https_proxy.manual_lb_app[0].id
}

resource "google_compute_global_forwarding_rule" "manual_lb_argocd_http" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-argocd-http"
  ip_address            = google_compute_global_address.argocd_ingress_ip.address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_http_proxy.manual_lb_argocd[0].id
}

resource "google_compute_global_forwarding_rule" "manual_lb_argocd_https" {
  count                 = var.manual_lb_enabled ? 1 : 0
  name                  = "${var.cluster_name}-manual-argocd-https"
  ip_address            = google_compute_global_address.argocd_ingress_ip.address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_https_proxy.manual_lb_argocd[0].id
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
  name       = "${var.cluster_name}-ingress-ip"
  depends_on = [google_project_service.required["compute.googleapis.com"]]
}

resource "google_compute_global_address" "argocd_ingress_ip" {
  name       = "${var.cluster_name}-argocd-ingress-ip"
  depends_on = [google_project_service.required["compute.googleapis.com"]]
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "people-priority"
  format        = "DOCKER"
  depends_on    = [google_project_service.required["artifactregistry.googleapis.com"]]
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
    edition           = "ENTERPRISE"
    availability_type = var.db_availability_type
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
  depends_on = [
    google_project_service.required["sqladmin.googleapis.com"],
    google_service_networking_connection.private_vpc_connection
  ]
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

resource "google_project_iam_member" "cloudbuild_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.current.number}@cloudbuild.gserviceaccount.com"

  depends_on = [google_project_service.required["cloudbuild.googleapis.com"]]
}

resource "google_project_iam_member" "compute_cloudbuild_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  depends_on = [google_project_service.required["cloudbuild.googleapis.com"]]
}

resource "google_project_iam_member" "compute_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  depends_on = [google_project_service.required["cloudbuild.googleapis.com"]]
}

resource "google_project_iam_member" "compute_storage_object_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  depends_on = [google_project_service.required["cloudbuild.googleapis.com"]]
}

resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[people-priority/people-priority]"
  depends_on         = [google_container_cluster.main]
}

resource "google_secret_manager_secret" "database_url" {
  secret_id  = "${var.cluster_name}-database-url"
  depends_on = [google_project_service.required["secretmanager.googleapis.com"]]

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
  name           = "primary"
  location       = var.region
  cluster        = google_container_cluster.main.name
  node_locations = local.node_locations
  node_count     = var.node_count

  autoscaling {
    min_node_count = var.node_min_count
    max_node_count = var.node_max_count
  }

  node_config {
    machine_type = var.node_machine_type
    disk_size_gb = var.node_disk_size_gb
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  lifecycle {
    ignore_changes = [node_count]
  }
}
