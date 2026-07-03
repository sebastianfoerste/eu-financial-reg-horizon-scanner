# Contributing

This is a personal portfolio project. External contributions are not accepted at this time.

If you are evaluating the repository, please read the [Reviewer Checklist](README.md#reviewer-checklist) in the README.

## Running the Tests

```bash
# Install dependencies
npm install

# Run all tests (108 Vitest tests, no database required)
npm run test

# Typecheck and lint
npm run typecheck
npm run lint

# Build (Next.js production build)
npm run build
```

## Safe Development Conventions

1. **No real credentials.** Use `.env.example` as the base template and never commit a populated `.env`.
2. **No real client data.** The repository uses synthetic fixture publications and product maps. Do not add real client matters, firm names or personal data.
3. **Delivery is blocked by default.** The proof-packet gate blocks alert delivery without explicit reviewer approval. Do not disable this gate in commits.
4. **Fixture-only demos.** Screenshots and demo recordings must use the bundled fixture publications only.
5. **Test before commit.** Run `npm run test && npm run typecheck && npm run lint && npm run build` before staging any change.

## Coding Agents

See `AGENTS.md` for guidelines on how future coding agents should work on this repository.
