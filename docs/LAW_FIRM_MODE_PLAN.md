# Law Firm Mode Implementation Plan

This plan turns the scanner from an in-house compliance dashboard into a matter-led regulatory intelligence layer for financial-regulation practices.

The core design principle is simple. Regulator publications should become matter signals, client brief drafts, knowledge assets, and commercial follow-on opportunities, while every client-facing output remains review-gated.

## Implemented Product Surface

1. `/law-firm` is the law-firm workbench.
   It shows clients, matters, high-relevance signals, draft briefs, active playbooks, commercial opportunities and the profile-specific implementation plan.

2. `/law-firm/[matterId]` is the matter command center.
   It shows regulatory signals, source links, relevance explanations, brief drafting controls, brief status advancement, knowledge assets, commercial routing and ethical-wall metadata.

3. `prisma/schema.prisma` now contains the law-firm operating layer.
   The new models are `LawFirmClient`, `PracticeGroup`, `FirmMatter`, `MatterPublication`, `ClientBrief`, `KnowledgeAsset`, `RegulatoryPlaybook`, `EthicalWall`, and `CommercialOpportunity`.

4. `prisma/seed.ts` creates three representative client and matter profiles.
   The seed data covers a Kirkland & Ellis style global elite workflow, a YPOG style tech-boutique workflow, and an Annerton style fintech-specialist workflow.

5. `src/lib/law-firm.ts` contains deterministic law-firm matching.
   It scores publications against matter taxonomy, creates explanations, generates internal brief text, and keeps client facts inside the local application.

## Kirkland & Ellis Style Global Elite Plan

Objective:
Turn regulatory publications into transaction diligence, funds regulatory analysis and portfolio-company risk work product.

Workflow:
1. Map new publications to deal teams, fund teams and portfolio-company exposure.
2. Score each publication against matter taxonomy, with weight on regulation family, licence type, activities and jurisdictions.
3. Create diligence insert drafts for high-relevance publications.
4. Flag commercial follow-on work where a publication creates a covenant, condition precedent, governance issue or remediation project.
5. Route every client-facing note through partner approval.

Product requirements:
1. Matter-centric watchlists for acquisition targets and portfolio companies.
2. Diligence insert templates with source provenance.
3. Portfolio exposure board for recurring sponsor clients.
4. Commercial opportunity queue connected to fixed-fee service offerings.
5. Restricted access controls for privileged or sensitive transaction matters.

Implemented seed profile:
`matter-global-sponsor-diligence`, mapped to MiCAR, DORA, PSD, crypto custody, payment initiation, CASP, EMI and PI exposure.

## YPOG Style Tech Boutique Plan

Objective:
Support MiCAR, DLT, token, fund and payment authorisation mandates from one regulatory feed.

Workflow:
1. Route ESMA, EBA, BaFin and EUR-Lex publications to active authorisation and structuring matters.
2. Highlight MiCAR, CASP, ZAG, token-offering and payment-service overlaps.
3. Create founder-facing action notes as internal drafts.
4. Convert recurring issues into playbooks and checklists.
5. Promote a note to client-ready only after senior associate and partner review.

Product requirements:
1. CASP and payment-services matrix.
2. Token-offering checklist.
3. Crypto-fund and DLT structuring watchlist.
4. Authorisation tracker with publication provenance.
5. Reusable playbooks for repeated founder and scale-up questions.

Implemented seed profile:
`matter-casp-zag-authorisation`, mapped to MiCAR, PSD, CASP authorisation, white-paper review, crypto exchange, custody and issuance activities.

## Annerton Style Fintech Specialist Plan

Objective:
Turn BaFin, EBA, DORA, payments and crypto-custody updates into implementation tasks and authority-dialogue notes.

Workflow:
1. Route German and EU supervisory publications to implementation matters.
2. Score DORA, outsourcing, ICT, payment, e-money and crypto-custody relevance.
3. Create action-register updates and authority-dialogue notes as internal drafts.
4. Store reusable implementation precedents for future matters.
5. Keep restricted matters behind explicit ethical-wall metadata.

Product requirements:
1. BaFin implementation register.
2. DORA outsourcing control tracker.
3. Payment and e-money licensing board.
4. Authority-dialogue note library.
5. Matter-team scoped access controls for highly confidential implementation mandates.

Implemented seed profile:
`matter-emi-dora-outsourcing`, mapped to DORA, PSD, AML, EMI, PI, CASP, outsourcing, ICT risk management and German supervisory practice.

## Safety Rules

1. Product-map facts, matter taxonomy, client names and commercial opportunity data stay local.
2. Publication-only AI remains optional and provider-configured.
3. Briefs are internal drafts until the status reaches `CLIENT_READY`.
4. The law-firm UI has no email, Slack, Teams, HubSpot or public publishing send action.
5. Audit logs are written when internal brief drafts are generated or advanced.

## Validation Coverage

1. Unit tests cover implementation plan shape, matter scoring, restricted ethical walls, internal brief text and workbench metrics.
2. Smoke routes cover `/law-firm` and `/law-firm/matter-casp-zag-authorisation`.
3. Prisma validation and generation cover the added law-firm schema.
4. The seed script keeps database-backed local runs aligned with demo mode.
