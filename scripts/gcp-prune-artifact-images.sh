#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-project-72558650-faf6-4529-a05}"
LOCATION="${LOCATION:-us-east4}"
REPOSITORY="${REPOSITORY:-people-priority}"
KEEP="${KEEP:-8}"
DRY_RUN="${DRY_RUN:-true}"
PACKAGES="${PACKAGES:-api web citizen rag-api}"

if ! [[ "${KEEP}" =~ ^[0-9]+$ ]] || [[ "${KEEP}" -lt 1 ]]; then
  echo "KEEP must be a positive integer" >&2
  exit 1
fi

for package_name in ${PACKAGES}; do
  image_path="${LOCATION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${package_name}"
  echo "Checking ${image_path}; keeping latest ${KEEP} tagged versions"
  old_versions=()
  while IFS= read -r digest; do
    [[ -n "${digest}" ]] && old_versions+=("${image_path}@${digest}")
  done < <(
    gcloud artifacts docker images list "${image_path}" \
      --project="${PROJECT_ID}" \
      --include-tags \
      --sort-by='~UPDATE_TIME' \
      --format='value(DIGEST)' | awk -v keep="${KEEP}" 'NF && NR > keep { print }'
  )

  if [[ "${#old_versions[@]}" -eq 0 ]]; then
    echo "No old versions to prune for ${package_name}."
    continue
  fi

  for version in "${old_versions[@]}"; do
    if [[ "${DRY_RUN}" == "true" ]]; then
      echo "DRY_RUN delete ${version}"
    else
      gcloud artifacts docker images delete "${version}" \
        --project="${PROJECT_ID}" \
        --delete-tags \
        --quiet
    fi
  done
done

echo "Artifact image prune complete. Set DRY_RUN=false to delete."
