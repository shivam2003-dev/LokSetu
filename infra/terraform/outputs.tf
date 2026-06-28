output "cluster_name" {
  value = google_container_cluster.main.name
}

output "artifact_registry" {
  value = google_artifact_registry_repository.containers.name
}

output "raw_media_bucket" {
  value = google_storage_bucket.raw_media.name
}
