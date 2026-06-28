# MP/Admin Web Dashboard

React/Vite app for MPs, ward staff, admins, analytics, public transparency, and Google Maps hotspot exploration.

## Commands
- `npm run dev -w apps/web -- --port 5173`: run locally.
- `npm run build -w apps/web`: production build.
- `npm run typecheck -w apps/web`: TypeScript validation.

## Environment
- `VITE_API_BASE_URL`: API origin. Empty uses same origin `/api`.
- `VITE_GOOGLE_MAPS_API_KEY`: browser key for Maps JavaScript. Restrict by HTTP referrer and API.
- `VITE_CITIZEN_APP_URL`: Apni Awaaz URL.

## Testing
Run full UI coverage from the repo root:
```bash
npm run test:functional
```

## Deployment
The web container is deployed by `charts/people-priority` and GitOps-managed by Argo CD. Vite env vars are build-time values, so browser keys must be injected during image build, never committed.
