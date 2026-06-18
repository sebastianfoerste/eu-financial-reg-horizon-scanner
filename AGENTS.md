<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Rules

- Treat `config/taxonomy.yaml` as product code. Every classification must store the taxonomy version used.
- Keep client product maps local. Do not send product-map or client-specific facts to LLM providers in the MVP foundation.
- Public regulator publication text may be classified by the AI seam once a provider is explicitly configured.
- Product-map impact scoring is deterministic and versioned in `config/scoring-rules.yaml`.
- Email, Slack, Teams, HubSpot, publishing, and outreach paths must stay draft-only unless a reviewed action explicitly sends them.
- Prefer fixture-backed ingestion tests before changing live adapter parsing.
- Agentic work is default-deny. Agents may draft findings, classifications and alert previews, but they may not send messages, approve review items, mutate product maps, change source status or bypass alert proof packets.
- Demo publications and product maps must stay synthetic or public-source only.

---

# Git and Branching Rules
- **NO Direct-to-Main/Master Merges**: You must **NEVER** autonomously merge feature branches (e.g., `codex/*`, `worldclass-*`) directly into default branches (`main`, `master`, or `develop`).
- **NO Autonomously Pushing to Default Branches**: You must **NEVER** autonomously push commits directly to remote default branches (`origin/main`, `origin/master`, or `origin/develop`).
- **Always Ask / PR Flow**: All merges and pushes to default branches must either:
  - Be explicitly approved by the user in the current chat session.
  - Be submitted as a Pull Request (PR) for user review.
- **Pre-flight & Parity Gating**: Before proposing any merge or push, you must run all local validation checks (e.g., schema parity checks, test suites, database migration validations) on the feature branch first to ensure stability.

