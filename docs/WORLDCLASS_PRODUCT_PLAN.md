# Worldclass Product Plan

## App Summary
EU Financial Reg Horizon Scanner is a Next.js cockpit for public-source financial regulatory monitoring, deterministic impact routing, reviewer queues and proof-gated alerts.

## Ideal Target User
Financial regulation lawyers, legal engineers, compliance leads and business-development teams tracking EU financial regulatory change.

## Main Competitor Set
Thomson Reuters CoCounsel, Lexis+ AI, Harvey, Legora, Airtable, Linear, Zapier and generic ChatGPT monitoring workflows.

## Product Positioning
Review-gated regulatory monitoring for EU financial services, with proof packets before external delivery.

## One Sentence Value Proposition
Convert public regulator updates into source-aware review items, product-impact routes and alert drafts that cannot be sent without approval.

## Three Sentence Homepage Pitch
The scanner watches public regulatory sources and routes updates into a review queue. It scores impact against product maps, records source diligence and blocks delivery until a proof packet passes. The product is built for regulated legal workflows where traceability matters as much as speed.

## Best Possible Demo Flow
Run fixture ingestion, open the cockpit, show review readiness, inspect a source diligence item, generate an alert proof packet and show blocked delivery without approval.

## UX Weaknesses
The cockpit is broad and can feel dense. Navigation labels and first-screen copy need to keep the user oriented around review, source diligence and approved delivery.

## Technical Weaknesses
Persistent mode depends on Prisma/Postgres setup. Demo mode is strong, but deployment readiness needs clearer environment docs.

## Security Weaknesses
Delivery integrations create risk if tokens are misconfigured. The proof-packet gate is the right pattern and should remain central.

## Documentation Weaknesses
The README needs clearer environment configuration and a stronger public-safe demo path.

## Immediate Fixes
Add `.env.example`, replace MVP wording, clarify the action queue and remove fixture placeholder language.

## Seven Day Improvement Plan
Add screenshots, a seeded proof-packet demo, a database-unavailable test and a deployment checklist.

## Thirty Day Improvement Plan
Add a source freshness dashboard, reviewer SLA analytics, signed alert proof exports and better product-map onboarding.

## Ninety Day Improvement Plan
Add multi-jurisdiction taxonomy packs, law-firm client-matter routing and a hosted synthetic demo.

## Killer Feature Proposal
Regulatory Action Packet: source hierarchy, paragraph diff, product impact, recommended reviewer action and blocked alert proof in one export.

## Commercialization Angle
Business-development and compliance monitoring product for financial-regulation teams, with custom source packs and service-offering maps.

## GitHub README Improvement Plan
Lead with credential-free demo, explain proof packets, show source hierarchy and add screenshots of review queue and alert gate.

## Portfolio Storytelling Angle
This is Sebastian turning financial-regulatory expertise into a productized monitoring and review workflow.
