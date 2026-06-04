# EU Financial Reg Horizon Scanner

EU Financial Reg Horizon Scanner is a working slice of a source-verified regulatory horizon-scanning workflow. The worked domain is EU crypto, payments, digital assets and prudential supervision. The transferable pattern is monitoring emerging AI regulation: source ingestion, classification, impact scoring, reviewer queues and approved delivery.

It ingests Tier 1 public regulator sources, normalises and version-controls publications, classifies them against a delivered taxonomy, scores them against local product maps, and routes items through human review before any alert is sent.

Classification is deterministic by default and can use structured AI Gateway output for public publication text after explicit configuration. No alert reaches an external channel without a reviewer approving it.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Prisma with Postgres, `pgvector`, and `pg_trgm`
- Inngest for scheduled source polling and dry-run digest jobs
- Clerk-ready auth, optional in local demo mode
- Clerk organisation mapping and internal-operator gating for governed review screens
- Resend, Slack and Teams delivery behind reviewed send buttons
- Config-backed workflow agents with Prisma run ledgers, artifact review states, Inngest triggers and default-deny capabilities
- Vitest for taxonomy, service-routing, ingestion, review, paragraph diffing, extraction, delivery blocking, saved views, diligence and scoring tests

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app works without `DATABASE_URL` by using demo publications. Connect Postgres when you want persistence:

```bash
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run prisma:validate
npm run prisma:generate
npm run ingest:fixture
npm run smoke:routes
npm run build
npm audit --omit=dev
```

## Production Access

Client-specific records are tenant-scoped when Clerk is configured. Set `User.externalId` to the Clerk user ID and `Organisation.externalId` to the Clerk organisation ID, then create the relevant `Membership` row. Users only see scores, product maps, alerts, saved views, integration settings, and audit events for the active organisation.

Review decisions, service catalogue governance, source diligence edits, and manual source polling require `User.isInternalOperator = true`. The seed creates one local fixture reviewer for development. Production operator actions require Clerk, even when read-only demo fallback is explicitly enabled.

## Main Paths

- `/` overview dashboard
- `/sources` regulator source catalogue and diligence fields
- `/publications` publication list, classification state, review routing and detail pages
- `/saved-views` monitored queries and alert rules
- `/product-map` product and service impact scoring setup
- `/review` reviewer queue
- `/ingestion` manual source polling and Inngest dry-run diagnostics
- `/settings` integration and organisation controls

## Relationship to Regulatory Compliance OS

This repository is the standalone proof product for the scanner module inside `Regulatory Compliance OS`.

The consolidated parent app mounts the scanner under `/scanner` and keeps the same domain boundaries:

- `src/lib/scanner`: taxonomy loading, scoring, source diligence, review, delivery, runtime hardening, and agent helpers.
- `src/app/scanner`: operator workspaces for review, alerts, sources, product maps, law-firm mode, and briefing.
- `tests/scanner`: ported domain and API tests that protect the consolidated module.

The standalone repository remains useful because it is smaller, easier to review, and focused on one regulatory-intelligence workflow. The parent app uses the same discipline at a broader product level: deterministic classification and scoring first, optional public-text AI only after explicit configuration, and reviewed delivery gates for every external alert.

## Proof and Validation

The current proof bundle for a fresh local checkout is:

```bash
npm run prisma:generate
npm run typecheck
npm run test
npm run lint
npm run ingest:fixture
npm run build
npm audit --omit=dev
```

On 4 June 2026, this bundle produced:

- `npm run typecheck`: passed.
- `npm run test`: 95 tests passed.
- `npm run lint`: passed.
- `npm run ingest:fixture`: dry-run mode with one publication.
- `npm run build`: passed and rendered the scanner route surface.
- `npm audit --omit=dev`: zero vulnerabilities.

The route smoke check requires a running dev server:

```bash
npm run dev
npm run smoke:routes
```

Reviewers should treat those results as proof of current repository health only. Regulatory completeness requires separate legal review.

## Safety Principles

- Public sources only.
- Deterministic classification first.
- Explicit configuration before AI use.
- Human review before delivery.
- No alert reaches an external channel without a reviewer approving it.
- Product-map impact scoring is deterministic and local.
- AI Gateway use is limited to public regulator publication text after explicit configuration.
- Tenant-scoped access when auth is configured.
- Synthetic demo data only.

## License

MIT. See [LICENSE](LICENSE).
