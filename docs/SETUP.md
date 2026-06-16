# Setup & Configuration: eu-financial-reg-horizon-scanner

## Prerequisites

- Node.js and npm.
- Docker only for local Postgres mode.
- No external regulator credentials are required for demo mode.

## Demo Mode

Demo mode uses synthetic publications and local deterministic scoring.

```bash
npm install
npm run digest:dry-run
npm run ingest:fixture
npm run dev
```

`npm run ingest:fixture` prints dry-run output when `DATABASE_URL` is absent. It does not send alerts, write to Slack or Teams, or call external AI providers.

## Prisma Only

Use this path to validate schema and generated client compatibility.

```bash
npm run prisma:validate
npm run prisma:generate
```

The scripts default to `postgresql://horizon:horizon@localhost:5438/horizon_scanner?schema=public` when `DATABASE_URL` is not set.

## Local Postgres

Use this path when you want persistent seeded data.

```bash
docker compose up -d
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Delivery Configuration

Slack, Teams, email and HubSpot delivery are disabled by default. External delivery requires configured integration secrets and reviewer-approved alert drafts. Demo mode never sends external alerts.

## Troubleshooting

- If Prisma cannot connect, start the local Postgres container or unset `DATABASE_URL` and use demo mode.
- If a route loads demo data, verify that `HORIZON_ALLOW_DEMO_MODE` is not set to `false`.
- If delivery is blocked, inspect the alert proof packet and integration diagnostics before changing configuration.
