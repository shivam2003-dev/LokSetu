# Repository Guidelines

## Project Structure & Module Organization

LokSetu is an npm workspace with separate apps and services:

- `apps/web`: MP/admin web console and India-wide operating dashboard.
- `apps/citizen`: citizen-facing submission experience.
- `services/api`: Express API, ranking pipeline, Vertex AI adapter, and Postgres persistence.
- `charts/people-priority`: Helm chart for Kubernetes deployment.
- `argocd`: Argo CD Application manifests.
- `infra/terraform`: GCP infrastructure skeleton.
- `scripts`: local Docker, Kubernetes, and Argo CD startup helpers.
- `docs`: architecture notes and implementation context.

Generated folders such as `dist/`, `node_modules/`, `.playwright-cli/`, and `output/` should not be committed.

## Build, Test, and Development Commands

- `npm install`: install all workspace dependencies.
- `npm run dev`: run API, MP/admin web app, and citizen app locally.
- `npm run local`: start local Postgres through Docker, then run the dev stack.
- `npm run local:k8s`: create/use local kind Kubernetes, install Argo CD, and deploy the Helm chart.
- `npm run build`: compile API and both frontend apps.
- `npm run typecheck`: run TypeScript checks across workspaces.
- `npm run lint`: currently aliases TypeScript lint checks.
- `helm lint charts/people-priority`: validate Helm chart structure.

## Coding Style & Naming Conventions

Use TypeScript with strict types. Prefer small typed functions, explicit domain names, and no hidden `any`. Use 2-space JSON indentation and existing formatting style in `.ts`, `.tsx`, YAML, and Terraform files. React components use `PascalCase`; local variables, functions, and API fields use `camelCase`; Kubernetes resource names use kebab-case.

## Testing Guidelines

No dedicated unit test framework is configured yet. Treat `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `helm lint`, and browser smoke checks as the current required validation. When adding tests, place them beside source as `*.test.ts` or `*.test.tsx` and add a root `npm test` script.

## Commit & Pull Request Guidelines

Git history uses concise imperative commit messages, for example `Build India-scale LokSetu platform` and `Fix local k8s web proxy and context`. Keep commits focused. Pull requests should include a short summary, validation commands run, screenshots for UI changes, and notes for Kubernetes, Argo CD, Terraform, or secret changes.

## Security & Configuration Tips

Never commit tokens, Argo CD passwords, service-account keys, or `.env` files. Store Git and cloud credentials in Kubernetes Secrets or local environment variables. Vertex AI config is environment-driven: `VERTEX_AI_PROJECT_ID`, `VERTEX_AI_LOCATION`, and `VERTEX_AI_MODEL`.
