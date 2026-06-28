# Functional Tests

Playwright tests covering API, MP/admin web, and citizen intake flows.

## Commands
```bash
npm run test:functional
npx playwright test tests/functional/api.spec.ts
```

## Coverage
- API health, priorities, public DTOs, role-scoped MP queues, batch status, AI status, external signals.
- Web navigation, Google Maps fallback, public project detail.
- Citizen private submission and pending batch receipt.

## Notes
Tests start local web servers from `playwright.config.ts` and do not require real Maps or AI keys.
