# Features: eu-financial-reg-horizon-scanner

## Feature List & Descriptions
### Horizon Scanner Queue

- **What it does**: A dashboard displaying newly ingested regulations sorted by impact scoring.
- **Why it matters**: Enables compliance teams to prioritize reading.
- **Where it is implemented**: [page.tsx](file:///Users/sebastian/Developer/eu-financial-reg-horizon-scanner/src/app/queue/page.tsx)
- **Input**: Database list of regulatory updates.
- **Output**: Ranked UI table with metadata.
- **Key files**: `src/app/queue/page.tsx, src/components/queue-table.tsx`
- **Current limitations**: Relies on manual refresh in local mode.
- **Possible improvements**: Implement live updates via Server-Sent Events (SSE).

### Inngest Run Orchestrator

- **What it does**: Manages background jobs, polling intervals, and retry states.
- **Why it matters**: Decouples request-response cycles from long-running network operations.
- **Where it is implemented**: [inngest.ts](file:///Users/sebastian/Developer/eu-financial-reg-horizon-scanner/src/lib/inngest.ts)
- **Input**: Feed URLs and schedule cron triggers.
- **Output**: Execution logs and parsed document records.
- **Key files**: `src/lib/inngest.ts, src/app/api/inngest/route.ts`
- **Current limitations**: Requires local Inngest dev server to run background jobs locally.
- **Possible improvements**: Support fallback cron systems if Inngest is unavailable.

### Monitor Review Profile

- **What it does**: Adds `horizon-scanner.monitor-review.v1` to the deterministic alert review table.
- **Why it matters**: Gives operators one review-gated profile for regulatory perimeter, source controls, draft alert Skills, tabular review, Portal-style operator room, Lists tasks and governance gates.
- **Where it is implemented**: `src/lib/horizon-review-table.ts`, `src/app/page.tsx`
- **Input**: Public regulator publications, source diligence, review queue, alert drafts and product-map delivery readiness.
- **Output**: Legora-inspired product pattern, no Legora integration or dependency. Rows include review cells, pinpoint citations, reviewer decisions and blocked delivery status. `externalActionAllowed` is false.

## Implementation Status
- All core features listed are implemented.
- Mock servers and endpoints simulate external third-party API services.

## Missing or Incomplete Features
- Direct automated API integrations with third-party service providers.
