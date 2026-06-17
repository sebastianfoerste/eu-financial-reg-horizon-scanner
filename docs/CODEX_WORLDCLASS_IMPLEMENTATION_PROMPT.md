# Codex Worldclass Implementation Prompt

You are Codex working in the repository: /Users/sebastian/Developer/eu-financial-reg-horizon-scanner

The app is a Next.js EU financial regulatory monitoring cockpit with public-source ingestion, deterministic impact scoring, reviewer queues and proof-gated alert delivery.

Current problems: the implementation has strong review and proof surfaces, but the UI still carries internal scaffolding language, environment setup is under-explained and the demo should better prove blocked delivery. The target state is a polished legal-tech cockpit that feels credible to a financial regulation buyer.

Inspect first:
- `README.md`
- `package.json`
- `.env.example`
- `src/app/page.tsx`
- `src/components/app-shell.tsx`
- `src/lib/alert-proof-packet.ts`
- `src/lib/review-readiness.ts`
- `tests/`
- `docs/WORLDCLASS_PRODUCT_PLAN.md`

Implement focused improvements:
- Add a source-diligence and proof-packet demo path.
- Add or update tests for database unavailable state and fixture proof packets.
- Improve cockpit labels, empty states and delivery-blocking copy.
- Keep environment docs explicit and fail-closed.

Do not change:
- Delivery gates that require reviewer approval.
- Source hierarchy or proof-packet digest behavior without tests.
- Prisma schema or migrations unless explicitly requested.
- Any real regulator-source claims that are not backed by code or current sources.

Run checks:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run prisma:validate`

Update documentation:
- `README.md`
- `docs/SETUP.md`
- `docs/TESTING.md`
- any proof-packet demo docs you add

Final report:
- Summarize files changed.
- State each check result and any setup blocker.
- Identify remaining deployment or credential risks.
- Do not add fake clients, fake matter data, fake delivery credentials or unsupported regulatory conclusions.
