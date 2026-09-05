# DealFlow360 — Rollback & Recovery Guide

## Stable Milestone Commits

| Commit SHA | Milestone Tag | Status | Description |
| :--- | :--- | :--- | :--- |
| *To be recorded after commit* | `docs-foundation` | STABLE | Architectural docs & Phase 0 foundation |
| *To be recorded after commit* | `app-foundation` | STABLE | Monorepo bootstrap, Prisma SQLite schema, seed & tests |

## Recovery Procedure
If a breaking regression occurs:
1. Identify last verified stable SHA from git history.
2. Checkout stable commit or revert bad commit (`git revert <bad-sha>`).
3. Re-run database migrations and seed script: `npm run db:migrate --workspace=server && npm run db:seed --workspace=server`.
4. Re-execute test suite: `npm test`.
