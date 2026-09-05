# DealFlow360 — Developer Handbook

## 1. Project Philosophy
- **Server Authority**: Never trust client inputs for financial or governance state.
- **Pure Domain Engine**: Keep business logic in `server/src/domain/` pure and independent of database ORM logic.
- **Explainability**: Every flagged risk level must return human-readable, rule-indexed explanations.
- **Anti-Vibecode**: UI should feel like a high-density, serious B2B commercial system (clear visual hierarchy, high contrast badges, zero fluffy animations).

## 2. How to Add a New Business Rule
1. Define rule code constant in `server/src/domain/types.ts`.
2. Add evaluation method in `server/src/domain/governance/discountGovernance.ts` or `dealRiskEngine.ts`.
3. Update `BUSINESS_RULES.md` with rule code, severity, formula, and explanation.
4. Add unit test under `server/tests/`.

## 3. Domain Engine & Financial Rules
- **Pure Domain Location**: `server/src/domain/` (`types.ts`, `margin/`, `governance/`, `risk/`, `approval/`, `recommendation/`).
- **Minor Unit Financial Arithmetic**: Convert major currency values to integer minor units (`Math.round(val * 100)`). Execute line gross, discount, net revenue, estimated cost, and gross margin math using integer arithmetic. Convert back to major units (`minorVal / 100`) for returned domain outputs.
- **Testing**: Run `npx vitest run` in `server/` to execute all 37+ pure domain and security anti-tampering tests.

