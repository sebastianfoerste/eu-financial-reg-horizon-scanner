# Security Policy

## Scope

This repository is a regulatory monitoring prototype for public-source EU financial regulation updates. It must not be used with confidential product maps, client facts or external delivery credentials in public demos.

## Sensitive Data Surfaces

The app can hold product-map data, matter mappings, reviewer decisions, alert drafts, recipient metadata, delivery provider tokens, auth configuration, database records and audit metadata.

## Required Controls

1. Keep `DATABASE_URL`, Clerk secrets and delivery tokens outside source control.
2. Use `.env.example` only as a blank template.
3. Keep external delivery draft-only unless reviewer approval and alert proof-packet checks pass.
4. Do not send local product maps or client-specific facts to LLM providers.
5. Store audit digests and gate metadata rather than full alert bodies where possible.

## Reporting

Report suspected vulnerabilities privately through the maintainer's GitHub profile contact details. Include the affected path, impact and reproduction steps. Do not open public issues for suspected credential leaks or client-data exposure.
