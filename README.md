# eu-financial-reg-horizon-scanner

The EU Financial Reg Horizon Scanner is a regulatory monitoring prototype for EU financial regulation. It uses public regulator publications, deterministic classification, product-impact scoring, reviewer queues, approval gates and audit metadata.

## Local verification

```bash
npm install
npm run test
npm run digest:dry-run
npm run ingest:fixture
npm run typecheck
npm run build
```

## Core features

- Feed ingestion and document normalisation.
- Regulatory taxonomy mapping.
- Product-impact scoring over synthetic profiles.
- Human reviewer queue.
- Approved alert draft workflow.
- Monitor review table: turns public regulator publications into review rows with source status, affected products, owner, evidence-packet status, delivery blockers and next action.
- Research workspace (`/research`): source-status knowledge base, cited impact research assistant and a role-scoped shared impact space. Product maps remain local and external delivery remains disabled.
- The research workspace also exposes versioned `research.plan.v1` records, optimistic publication-review collaboration, and evidence-bound briefing change sets. Markdown and DOCX export stay behind evidence and reviewer approval gates.

## Demo coverage

The bundled synthetic publications cover crypto and MiCAR white-paper updates, payments and PSD3 updates, prudential supervision, AI Act implementation, DORA, and ICT third-party risk. No confidential product map, client data or personal data is included.

## Transferable pattern

Replace the taxonomy and source adapters and the same pattern can monitor AI regulation, DORA, the Data Act and the Cyber Resilience Act: source ingestion, deterministic classification, product-impact scoring, reviewer approval, audit trail and approval-gated outputs.

## Tech stack

Next.js, React, TypeScript, Prisma, PostgreSQL, pgvector and Vitest.

## Safety

This is a public-safe prototype using synthetic demo data. It does not provide legal advice, binding regulatory interpretation or filing guidance. Human review is required before reliance.

## Related

Part of a portfolio of deterministic, review-gated EU-regulation tools:

- [micar-whitepaper-linter](https://github.com/sebastianfoerste/micar-whitepaper-linter) — MiCAR whitepaper linter with pinpoint citations and a CI action.
- [eu-ai-act-classifier](https://github.com/sebastianfoerste/eu-ai-act-classifier) — EU AI Act risk-tier classifier with cited obligations.
- [dora-third-party-register-and-resilience-workbench](https://github.com/sebastianfoerste/dora-third-party-register-and-resilience-workbench) — DORA ICT third-party register and resilience workbench.

Curated index of EU financial-regulation primary sources and tools: [awesome-eu-fintech-regulation](https://github.com/sebastianfoerste/awesome-eu-fintech-regulation).
