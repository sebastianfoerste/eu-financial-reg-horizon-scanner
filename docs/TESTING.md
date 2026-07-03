# Testing & Quality Assurance

The scanner is tested as an operator workflow: source ingestion, classification, impact scoring, review readiness, alert gating, delivery safety, and audit surfaces.

## Fast Proof Gate

Run the local proof bundle:

```bash
npm run check:fast
```

This runs ESLint, TypeScript, Vitest, and Prisma schema validation with the local default database URL.

## Focused Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run prisma:validate
npm run ingest:fixture
npm run digest:dry-run
npm run smoke:routes
npm audit --omit=dev
```

`npm run smoke:routes` expects the Next.js app to be running. It reports unavailable routes as operator-readable failures rather than throwing an unhandled connection error.

## Key Test Areas

- Source hierarchy and diligence gates, including stale and context-only material.
- Alert proof packets, including reviewer approval, HTTPS source checks, recipient checks, and digest-only audit summaries.
- Review queue readiness and blocked alert drafting.
- Product-map impact scoring and delivery governance.
- RSS ingestion, extraction, paragraph diffing, and route inventory smoke helpers.

## Safety Boundary

Tests use fixtures and synthetic data. External delivery remains disabled unless a reviewer approves the alert and integration configuration is explicitly enabled.
