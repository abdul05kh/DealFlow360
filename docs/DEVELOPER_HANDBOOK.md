# DealFlow360 — Developer Handbook

## 1. Project Philosophy
- **Server Authority**: Never trust client inputs for financial or governance state.
- **Pure Domain Engine**: Keep business logic in `server/src/domain/` pure and independent of database ORM logic.
- **Explainability**: Every flagged risk level must return human-readable, rule-indexed explanations.
- **Anti-Vibecode**: UI should feel like a high-density, serious B2B commercial system (clear visual hierarchy, high contrast badges, zero fluffy animations).

## 2. How to Add a New Business Rule
1. Define rule code constant in `server/src/types/governance.ts`.
2. Add evaluation method in `server/src/domain/DiscountGovernance.ts` or `DealRiskEngine.ts`.
3. Update `BUSINESS_RULES.md` with rule code, severity, formula, and explanation.
4. Add unit test in `server/tests/unit/DiscountGovernance.test.ts`.
