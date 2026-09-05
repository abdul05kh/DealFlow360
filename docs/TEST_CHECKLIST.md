# DealFlow360 — Test Verification Checklist

## 1. Foundation Verification (Phase 1)
- [ ] Monorepo `npm install` installs dependencies cleanly.
- [ ] Prisma migration creates SQLite tables (`dev.db`).
- [ ] Seed script populates Customers, Tiers, Categories, Products, Users, Policies.
- [ ] Express server starts on configured port.
- [ ] Health check endpoint (`GET /api/v1/health`) returns `200 OK`.
- [ ] Zod middleware rejects malformed JSON payloads with `400 Bad Request`.
- [ ] Vitest test suite executes cleanly via `npm test`.

## 2. Domain & Integration Tests (Phases 2-8)
- [ ] Margin calculation exact precision tests.
- [ ] Customer tier ceiling violation tests (Gold 15%, Silver 10%, Bronze 5%).
- [ ] Category ceiling violation tests (Services 10%).
- [ ] Multi-factor risk scoring formula test.
- [ ] Approval request state machine transition tests.
- [ ] Unauthorized manager action rejection (403 Forbidden).
- [ ] Anti-tampering price modification rejection test.
