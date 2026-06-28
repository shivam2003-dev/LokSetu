# Operational Scripts

Local startup and bootstrap scripts for development and Argo CD verification.

## Commands
- `npm run local`: starts local Docker Compose services.
- `npm run local:k8s`: builds images, creates kind cluster if needed, applies Argo CD, and deploys local apps.

## Environment
- `LOCAL_IMAGE_TAG`: override local image tag.
- `VITE_GOOGLE_MAPS_API_KEY`: build-time browser Maps key.
- `GOOGLE_MAPS_API_KEY`: backend geocoding secret value.
- `OPENAI_COMPATIBLE_API_KEY`: AI secret value.

## Safety
Scripts create Kubernetes Secrets from environment variables. They do not write secrets to Git.
