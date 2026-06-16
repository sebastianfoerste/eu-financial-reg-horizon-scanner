# API & Interface Reference

The scanner exposes Next.js App Router routes and server actions for regulator ingestion, review queues, product-map scoring, alert drafting, and governed delivery.

## Operator Routes

- `/sources` and `/sources/diligence`: source freshness, reuse diligence, and polling status.
- `/review`: human review queue for classified publications.
- `/product-maps`: organisation footprint and impact-scoring configuration.
- `/alerts`: reviewed alert drafts and delivery state.
- `/audit`: audit log for material operator actions.
- `/agents`: bounded internal agent runs with audit trails.

## API Routes

- `POST /api/sources/poll`: runs configured source polling.
- `POST /api/impact/recalculate`: recalculates product-map impact scores.
- `POST /api/alerts/generate`: creates reviewed alert drafts from approved publications.
- `POST /api/alerts/{id}/approve`: records reviewer approval for an alert draft.
- `POST /api/alerts/{id}/send`: attempts governed delivery only after product-map, source hierarchy, reviewer, recipient, and integration gates pass.
- `POST /api/digest/preview`: prepares an internal digest preview.
- `POST /api/agents/run`: runs bounded internal operator agents.

## Alert Proof Packet

Before delivery, `POST /api/alerts/{id}/send` builds `horizon-scanner.alert-proof-packet.v1` from the persisted alert and publication source.

The packet contains:

- source title, URL, authority level, and current review status;
- reviewer approval state;
- recipient and HTTPS source checks;
- a SHA-256 digest of the alert payload;
- gate reasons when delivery is blocked.

The audit log stores the proof summary and digest only. It does not store the alert body again.

## Authentication And Configuration

The app supports demo-mode fixtures when no database URL is present. Production-like operation requires Postgres, Clerk configuration, and explicitly enabled integration settings for external delivery providers.
