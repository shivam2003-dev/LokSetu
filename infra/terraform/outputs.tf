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

output "cloudbuild_service_account_email" {
  value = "${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
}

output "compute_default_service_account_email" {
  value = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

output "manual_lb_app_url_map" {
  value = var.manual_lb_enabled ? google_compute_url_map.manual_lb_app[0].name : null
}

output "maps_browser_api_key" {
  value     = google_apikeys_key.maps_browser.key_string
  sensitive = true
}

output "maps_server_api_key" {
  value     = google_apikeys_key.maps_server.key_string
  sensitive = true
}

output "certificate_manager_dns_authorization_records" {
  value = var.manual_lb_enabled ? {
    loksetu       = google_certificate_manager_dns_authorization.loksetu[0].dns_resource_record
    awaaz         = google_certificate_manager_dns_authorization.awaaz[0].dns_resource_record
    argocd        = google_certificate_manager_dns_authorization.argocd[0].dns_resource_record
    observability = var.manual_lb_grafana_neg_name != "" ? google_certificate_manager_dns_authorization.observability[0].dns_resource_record : []
  } : null
}

output "certificate_manager_app_certificate_state" {
  value = var.manual_lb_enabled ? google_certificate_manager_certificate.manual_lb_app[0].managed[0].state : null
}

output "certificate_manager_argocd_certificate_state" {
  value = var.manual_lb_enabled ? google_certificate_manager_certificate.manual_lb_argocd[0].managed[0].state : null
}

output "certificate_manager_observability_certificate_state" {
  value = var.manual_lb_enabled && var.manual_lb_grafana_neg_name != "" ? google_certificate_manager_certificate.manual_lb_observability[0].managed[0].state : null
}
