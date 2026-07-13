# eu-financial-reg-horizon-scanner

The EU Financial Reg Horizon Scanner is a regulatory monitoring prototype for EU financial regulation. It uses public regulator publications, deterministic classification, product-impact scoring, reviewer queues, approval gates and audit metadata.

## Reviewer demo path

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
- Monitor review table: turns public regulator publications into review rows with source status, affected products, owner, proof-packet status, delivery blockers and next action.
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
