output "cluster_name" {
  value = google_container_cluster.main.name
}

output "artifact_registry" {
  value = google_artifact_registry_repository.containers.name
}

output "raw_media_bucket" {
  value = google_storage_bucket.raw_media.name
}

output "processed_artifacts_bucket" {
  value = google_storage_bucket.processed_artifacts.name
}

output "ingress_static_ip_name" {
  value = google_compute_global_address.ingress_ip.name
}

output "ingress_static_ip_address" {
  value = google_compute_global_address.ingress_ip.address
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "app_service_account_email" {
  value = google_service_account.app.email
}

output "database_url_secret_id" {
  value = google_secret_manager_secret.database_url.secret_id
}
