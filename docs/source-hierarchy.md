# Source Hierarchy and Status Model

Date: 2026-06-12

The scanner should treat every publication and alert as source-backed work. Current-law statements require current-source verification before client or public use.

## Authority Levels

| Level | Examples | Default status |
| --- | --- | --- |
| Binding law | EU regulations, EU directives, national legislation | `requires_review` until retrieved and checked. |
| Delegated or implementing acts | Commission delegated and implementing acts | `requires_review` until retrieved and checked. |
| Supervisory material | ESMA, EBA, ECB, BaFin, Bundesbank materials | `requires_review` unless source is verified. |
| Court decisions | EU and national court decisions | `requires_review` with citation review. |
| Legal commentary | Law firm updates, journals, treatises | `context_only`. |
| Industry material | Vendor reports, associations, press | `market_context`. |

## Status Values

| Status | Meaning |
| --- | --- |
| `unverified` | Stored but not checked by a reviewer. |
| `requires_review` | Relevant enough to queue for human review. |
| `verified_current` | Checked against the source on the stated date. |
| `stale` | Older than the configured currency window or superseded by a newer source. |
| `context_only` | Useful background without primary authority. |

## Implementation Slice

1. Store authority level, retrieved date, and verification status on each publication.
2. Make alert drafting require at least one `verified_current` primary or supervisory source.
3. Show stale or context-only sources in the reviewer queue.
4. Keep product-map and client-specific impact scoring local by default.
