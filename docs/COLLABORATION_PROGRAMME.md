# Review-workspace programme

The research workspace persists version-bound plans, ranked authority passages, verification states, optimistic publication locks, comments, decisions, brief revisions and activity in PostgreSQL. `/api/research/workspace` is the authenticated mutation boundary.

Markdown and DOCX exports contain accepted changes and evidence references only. The export route requires all changes to be decided, an evidence gate and reviewer approval. Alert delivery remains governed by the existing proof packet and reviewed-send controls.

Run `npm run check:fast`, `npm run build`, a clean `prisma migrate deploy`, and the Docker-backed route smoke test. Client and organisation access continues to use Clerk membership checks.
