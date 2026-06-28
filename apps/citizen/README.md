# Apni Awaaz Citizen App

Phone-first citizen intake app for text, voice/photo metadata, privacy aliases, ratings, urgency, and local area capture.

## Commands
- `npm run dev -w apps/citizen -- --port 5174`: run locally.
- `npm run build -w apps/citizen`: production build.
- `npm run typecheck -w apps/citizen`: TypeScript validation.

## Environment
- `VITE_API_BASE_URL`: API origin. Empty uses same origin `/api`.

## Testing
```bash
npm run test:functional
```
The citizen spec submits a private problem and verifies the pending batch receipt.

## Deployment
Built as an Nginx static container and deployed through Helm/Argo CD. Citizen identity must remain private unless the user disables privacy mode.
