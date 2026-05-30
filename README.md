# EU Financial Reg Horizon Scanner

MVP foundation for a regulatory horizon-scanning workflow focused on EU crypto, payments, digital assets, and prudential supervision.

The current working slice ingests Tier 1 public regulator sources, normalises publications, stores version history, classifies against the delivered taxonomy, scores publications against local product maps, routes items through human review, prepares approved alert drafts, and keeps delivery behind explicit reviewed sends. Classification uses deterministic rules by default and can use structured AI Gateway output for public publication text after explicit configuration. Product maps maintain local concern watchlists, multiple licences, product lines, jurisdictions, quarterly footprint confirmation, and auditable score recalculation. Stored score explanations retain topic, home-state, passporting, critical-line and score-floor components. Score-affecting footprint edits retire pending alert drafts until the edited footprint is confirmed again. Reviewers can rerun classification, correct tags, deadlines, confidence, summaries, and service routing, with correction history and score recalculation. Governed service-package updates invalidate pending alert drafts and flow into newly generated payloads. A bounded agent layer now creates source-monitoring findings, review QA suggestions, classification triage drafts, diff explanations, impact explanations, alert draft previews, service-routing suggestions, audit QA findings, and internal briefing artifacts. The law-firm mode maps publications to clients, practice groups, matters, brief drafts, knowledge assets, ethical walls, and fixed-fee opportunity routing for Kirkland & Ellis style, YPOG style, and Annerton style workflows. Client product maps and matter facts stay local. No legal, client, recruiting, or public communications are sent automatically.

For a reviewer-friendly demo path, architecture map, checks and safety posture, see [`docs/launch-readiness.md`](docs/launch-readiness.md).

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Prisma with Postgres, `pgvector`, and `pg_trgm`
- Inngest for scheduled source polling and dry-run digest jobs
- Clerk-ready auth, optional in local demo mode
- Clerk organisation mapping and internal-operator gating for firm-governed screens
- Resend, Slack, Teams, and explicit HubSpot lead/deal delivery behind reviewed send buttons
- Config-backed workflow agents with Prisma run ledgers, artifact review states, Inngest triggers, and default-deny capabilities
- Law-firm operating layer for matter-led regulatory intelligence, client brief drafts, playbooks, ethical walls, and commercial opportunity routing
- Vitest for taxonomy, service-routing, ingestion, review, paragraph diffing, extraction, delivery blocking, saved views, diligence, law-firm matching, and scoring tests

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

- `config/taxonomy.yaml`: versioned taxonomy and service-offering triggers.
- `config/scoring-rules.yaml`: versioned deterministic impact-scoring rules.
- `config/agents.yaml`: versioned agent registry, capabilities, schedules, LLM policy, and budgets.
- `prisma/schema.prisma`: delivered schema plus adapter state and tenant access fields.
- `prisma.config.ts`: Prisma schema, migration, seed, and datasource configuration.
- `src/lib/ingestion`: source adapters, diligence-gated polling, RSS parsing, detail extraction, paragraph versioning, and persistence.
- `src/lib/impact-scoring.ts`: local product-map scoring, no LLM calls.
- `src/lib/ai/classification.ts`: publication-only deterministic classifier and optional AI Gateway structured-output execution.
- `src/lib/review.ts`: internal review state transitions, validated corrections, correction history, and alert invalidation after revised classifications.
- `src/lib/alerts.ts` and `src/lib/delivery.ts`: alert draft generation, approval, and reviewed delivery attempts.
- `src/lib/agents`: agent registry loading, policy checks, deterministic implementations, run persistence, artifacts, and review status updates.
- `src/lib/law-firm.ts`: deterministic law-firm matter matching, implementation plans, workbench data, brief drafting, and reviewed brief status changes.
- `src/app`: dashboard, law-firm workbench, agent control room, review queue, alert cockpit, service catalogue, source diligence, audit log, diagnostics, publication detail, digest preview, source registry, and API routes.
- `docs/launch-readiness.md`: reviewer runbook for demo path, checks, architecture and safety posture.
- `docs/LAW_FIRM_MODE_PLAN.md`: detailed implementation plan for Kirkland & Ellis style, YPOG style, and Annerton style law-firm workflows.
- `docs/launch/launch-post.md`: launch asset, stored as a draft.
- `docs/BACKLOG.md`: later 12-month features deliberately left outside this MVP pass.

## Source References

- BaFin RSS discovery: https://www.bafin.de/EN/Service/TopNavigation/RSS/rss_artikel_en.html
- ESMA RSS and Q&A search: https://www.esma.europa.eu/rss.xml and https://www.esma.europa.eu/esma-qa-search-page/all
- EBA RSS and Single Rulebook Q&A: https://www.eba.europa.eu/news-press/news/rss.xml and https://www.eba.europa.eu/single-rulebook-qa
- EUR-Lex reuse and Cellar access: https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html?locale=en
- Bundesbank RSS discovery: https://www.bundesbank.de/de/startseite/rss

## Safety Defaults

- Email, Slack, Teams, and HubSpot delivery remain blocked until a human approves an alert draft and presses the reviewed send action.
- Alert sends atomically claim an approved draft, preventing duplicate delivery attempts from concurrent clicks.
- Reviewer attribution for persisted decisions and approvals is taken from the authenticated operator identity.
- Configured Postgres reads fail visibly on error and never substitute sample client records.
- Secrets stay in environment variables. Postgres stores only non-secret integration metadata.
- The classifier sends only public regulator publication text to AI Gateway when `HORIZON_AI_PROVIDER="gateway"`, a model is selected, and gateway authentication is configured.
- Agents are disabled by default in production through `HORIZON_AGENTS_ENABLED`, scheduled autorun is disabled unless `HORIZON_AGENT_AUTORUN_ENABLED="true"`, and agent LLM calls require `HORIZON_AGENT_LLM_ENABLED="true"`.
- Agent LLM use is publication-only in this pass. Product-map and client facts are either kept local or redacted before any future local-fact policy is introduced.
- Agent artifacts are drafts or findings. Approved alert-draft artifacts can be applied only as in-app draft alerts. Existing alert approval and explicit-send actions remain the only route to external delivery.
- Law-firm brief drafts remain internal until reviewed into `CLIENT_READY`; the law-firm screens have no external-send action.
- Matter taxonomy, client names, ethical-wall metadata, and commercial opportunity records stay local and are not sent to AI providers.
- Reviewer-triggered classification reruns return the publication to pending review and retire related pending alert drafts.
- Product-map impact scoring is deterministic and local in this pass.
- Product-map edits are organisation-scoped, audit logged, and immediately recalculate the persisted explanation breakdown.
- Alert generation and reviewed send require current quarterly confirmation for every active product map in the organisation.
- Live polling honours source reuse status and allowed cadence; sources awaiting diligence remain blocked.
- Production mode denies an unconfigured authenticated app. Read-only demo rendering is available only when explicitly permitted with `HORIZON_ALLOW_DEMO_MODE="true"` and no database is configured.
- External publishing, outreach, billing, Neo4j, and fine-tuning remain out of scope for this pilot-ready core.


## ⚠️ System Disclaimers & Regulatory Compliance

### 1. Decoupled AI Architecture
This system is structured as an autonomous multi-agent pipeline using Large Language Models (LLMs) to automate processing, information retrieval, and synthesis. It functions via a decoupled architecture consisting of specialized agent personas (e.g., scoring, profiling, outreach drafts, translation) communicating asynchronously.

### 2. Operational Limits & Hallucinations
- **Accuracy Constraints**: Output generation is subject to LLM limitations. This includes potential hallucinations, logical inconsistencies, and processing lag.
- **Data Latency**: Vector store updates and local database states are updated periodically and do not reflect real-time regulatory or institutional shifts.

### 3. Mandatory Human-in-the-Loop Review
**CRITICAL**: Under no circumstances should any raw output (including client profiles, generated LinkedIn posts, email sequences, or automated outreach drafts) be sent, published, or finalized without thorough human validation. The operator retains sole responsibility for reviewing and verifying the accuracy and appropriateness of all generated artifacts.

### 4. No Legal Advice Framing
**This software does not provide legal representation or binding legal counsel.** All synthesized analyses, regulatory scans, contract clause comparisons, and case triage scores are for administrative automation and operational assistance only. This tool is not a licensed attorney, does not operate as a law firm, and does not establish any attorney-client relationship. Operators must consult qualified legal professionals for binding advice or representation.
