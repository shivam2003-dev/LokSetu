# API and Batch Worker

Express API for intake, public project data, role-scoped MP queues, external signals, official data lineage, and batch processing.

## Commands
- `npm run dev -w services/api`: local API on `PORT` or `8080`.
- `npm run batch -w services/api`: process pending raw intake.
- `npm run test:unit -w services/api`: fixture ingestion and external signal tests.
- `npm run build -w services/api`: compile to `dist/`.

## Environment
- `DATABASE_URL`: Postgres connection. Empty uses memory mode.
- `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL`: temporary Gemini-compatible AI path.
- `VERTEX_AI_PROJECT_ID`, `VERTEX_AI_LOCATION`, `VERTEX_AI_MODEL`, `VERTEX_AI_DISABLED`: Vertex AI path.
- `GOOGLE_MAPS_API_KEY`: backend reverse geocoding.
- `X_BEARER_TOKEN`: optional X recent-search ingestion.

## Testing
```bash
npm run typecheck -w services/api
npm run test:unit -w services/api
npm run test:functional
```

## Notes
Never log or commit API keys. Public endpoints return DTOs that hide usernames, phone numbers, raw media, and private text.
