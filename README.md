# eu-financial-reg-horizon-scanner

The EU Financial Reg Horizon Scanner is a Next.js 16 regulatory monitoring prototype for EU financial regulation. It ingests public regulator publications, normalizes sources, classifies them against a deterministic taxonomy, scores product impact, routes items to a human reviewer queue and prepares alert drafts that stay blocked until approval.

## What it does
The horizon scanner periodically pulls regulator feeds (e.g., ESMA updates). It parses document paragraphs, stores them with vector embeddings in a PostgreSQL pgvector database, classifies them against a taxonomy, calculates impact scores based on company profile mappings, and places them in a dashboard queue. Reviewers log in, verify the findings, draft notifications, and approve delivery actions before external channels are used.

The repository is the standalone scanner slice of Regulatory Compliance OS. In the consolidated parent product, the scanner code lives under `src/lib/scanner` and the operator surface is mounted at `/scanner`.

## Safety Gates
No alert reaches an external channel without a reviewer approving it.
Product-map impact scoring is deterministic and local.
Only public regulator publication text is eligible for classification unless an approved provider configuration is present.
External delivery now carries a `horizon-scanner.alert-proof-packet.v1` gate with source authority, currency status, reviewer approval, recipient checks, HTTPS source validation, and a payload digest. Audit logs store the digest and gate metadata, not the alert body.

## Reviewer Demo Path

Start with credential-free proof:

```bash
npm install
npm run test
npm run digest:dry-run
npm run ingest:fixture
```

Then run type and build checks:

```bash
npm run typecheck
npm run build
```

For persistent mode, configure `.env.example`, run `npm run prisma:generate`,
then validate with `npm run prisma:validate`. Production use requires database,
auth and delivery secrets, plus reviewer approval before any external channel is
used.

## Core Features
### Implemented Use Cases
- **Automated feed ingestion and document normalisation.**
- **Vector-based semantic search and regulatory mapping.**
- **Reviewer queue with approval controls.**
- **Organization-gated dashboard views (Clerk integration).**
- **Monitor review profile**: Exposes `horizon-scanner.monitor-review.v1`, a Legora-inspired product pattern, no Legora integration or dependency. It covers regulatory perimeter, source controls, tabular review, draft alert skills, Portal-style operator room, Lists tasks and blocked external delivery.

### Future Use Cases
- **Automatic paragraph diffing comparing consecutive law drafts.**
- **Multi-regulator support.**

## Credential-Free Demo

Run a dry-run regulatory digest without Postgres, Clerk, Slack or Teams:

```bash
npm install
npm run digest:dry-run
```

Run fixture ingestion without external credentials:

```bash
npm run ingest:fixture
```

When `DATABASE_URL` is absent, fixture ingestion reports dry-run mode and does not mutate a database.

## Demo Publication Coverage

The bundled synthetic publications cover:

1. Crypto and MiCAR white-paper updates.
2. Payments and PSD3 fraud-control updates.
3. Prudential supervision, SREP, liquidity and governance.
4. AI Act GPAI and high-risk implementation.
5. DORA and ICT third-party risk.

All demo publications use public-source style facts only. No confidential product map, client data or personal data is included.

## Transferable Pattern

The same workflow applies beyond financial regulation. Replace the taxonomy and source adapters and the engine can monitor AI regulation, DORA, the Data Act and the Cyber Resilience Act: source ingestion, deterministic classification, product-impact scoring, reviewer approval, audit trail and blocked delivery.

## Tech Stack

- Next.js 16 App Router, React 19 and TypeScript.
- Prisma with PostgreSQL and pgvector for persistent mode.
- Deterministic taxonomy and scoring rules in `config/`.
- Vitest for source, taxonomy, scoring, review and delivery gates.

### Major Configuration & Dependency Files
None

## Repository Structure
- `config/`: Directory containing config components.
- `docs/`: Directory containing docs components.
- `prisma/`: Directory containing prisma components.
- `public/`: Directory containing public components.
- `scripts/`: Directory containing scripts components.
- `src/`: Directory containing src components.
- `tests/`: Directory containing tests components.

## Setup Instructions

Demo mode:

```bash
npm install
npm run digest:dry-run
npm run dev
```

Prisma only:

```bash
npm run prisma:validate
npm run prisma:generate
```

Local Postgres:

```bash
docker compose up -d
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Required Environment Variables

No environment variables are required for dry-run fixture demos. Persistent or
multi-user review requires `DATABASE_URL` and auth configuration. Delivery
integrations require provider tokens, kept outside source control. See
[.env.example](.env.example).

## Development Commands
- Start dev server: See [SETUP.md](docs/SETUP.md) for detailed execution commands.

## Test Commands
- Run test suite: See [TESTING.md](docs/TESTING.md) for testing execution commands.
- Public proof bundle: `npm run check:fast` (lint, `npm run typecheck`, `npm run test`, Prisma validation), `npm run ingest:fixture`, `npm run digest:dry-run`, `npm audit --omit=dev`.

## Build Commands
- Production build: Run the build compiler defined in package/project configuration.

## Deployment Notes
Deployment steps are configured for local execution and staging review. Ensure no production secrets are deployed directly.

## Current Status
Active public-safe regulatory monitoring slice. The strongest proof surfaces are
source diligence, review readiness checks, alert proof packets and audit
metadata that avoid storing alert bodies.

## Known Limitations
- Requires Postgres Docker container with pgvector extension enabled.
- Clerk auth integration requires setting up API credentials for full authentication gates.
- Inngest background workflows need the Inngest local dev agent running (`npx inngest-cli@latest dev`).

## Not Legal Advice

This tool classifies public regulator publications against a deterministic taxonomy and routes findings into a human review queue. Output classifications, impact scores and alert drafts are workflow inputs, not legal assessments. Delivery of any communication based on scanner output requires qualified human review and approval. The tool does not provide legal advice, binding regulatory interpretation or filing guidance.

## Synthetic Demo Data

The bundled fixture publications and product maps are synthetic. They do not represent real regulatory events, actual client products or real matters. Do not use real client product maps, confidential implementation notes or personal recipient lists for screenshots or demos.

## Reviewer Checklist

Use this checklist when evaluating the repository as a portfolio project or employer demo:
- [ ] Run `npm install && npm run test` - 108 tests pass without credentials.
- [ ] Run `npm run digest:dry-run` - dry-run digest completes without database or delivery tokens.
- [ ] Run `npm run ingest:fixture` - fixture ingestion runs without Postgres.
- [ ] Run `npm run typecheck && npm run build` - TypeScript and Next.js build clean.
- [ ] Review `tests/alert-proof-packet.test.ts` - confirms delivery is blocked without reviewer approval.
- [ ] Review `tests/source-hierarchy.test.ts` - confirms source authority levels are enforced.
- [ ] Review `tests/review-readiness.test.ts` - confirms readiness checks gate publication processing.
- [ ] Confirm no real credentials appear in `.env.example`.
- [ ] Confirm external delivery is blocked in all fixture and dry-run paths.

## Deeper Documentation Links
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - High-level system structure and details.
- [FEATURES.md](docs/FEATURES.md) - User-facing capabilities and modules.
- [API.md](docs/API.md) - Endpoint reference and tool interfaces.
- [SETUP.md](docs/SETUP.md) - Comprehensive setup and configuration.
- [TESTING.md](docs/TESTING.md) - Automated tests and validation strategy.
- [reviewer-queue-snapshot.md](docs/reviewer-queue-snapshot.md) - Text snapshot of the review queue.
- [approved-alert-sample.md](docs/approved-alert-sample.md) - Sample approved alert with delivery disabled by default.
- [AGENTS.md](AGENTS.md) - Guidelines for future coding agents working on this repo.
