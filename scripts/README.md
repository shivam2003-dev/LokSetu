# Operational Scripts

Local startup and bootstrap scripts for development and Argo CD verification.

## Commands
- `npm run local`: starts local Docker Compose services.
- `npm run local:k8s`: builds images, creates kind cluster if needed, applies Argo CD, and deploys local apps.
- `./scripts/gcp-configure-safe.sh`: configures the local `loksetu-qwiklabs` gcloud profile without creating cloud resources.
- `./scripts/gcp-safety-check.sh`: verifies active account/project access before any cloud deployment command.

## Environment
- `LOCAL_IMAGE_TAG`: override local image tag.
- `VITE_GOOGLE_MAPS_API_KEY`: build-time browser Maps key.
- `GOOGLE_MAPS_API_KEY`: backend geocoding secret value.
- `OPENAI_COMPATIBLE_API_KEY`: AI secret value.

## Safety
Scripts create Kubernetes Secrets from environment variables. They do not write secrets to Git.
The GCP safety scripts only read or update local Cloud SDK config. They do not enable APIs, create resources, or run Terraform.
