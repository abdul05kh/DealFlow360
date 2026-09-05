# DealFlow360 — Security Design & Threat Model

## 1. Security Architecture Principles
1. **Server as Sole Commercial Source of Truth**: Financial math (net revenue, margin, gross margin %) and governance metrics (risk score, triggered policy rules, approval routing) are computed strictly on the backend. Frontend prices, costs, or calculated margins are ignored.
2. **Role-Based Authorization Enforcement**: Backend middleware (`authMiddleware.ts`) inspects identity headers (`X-Demo-Role`) and rejects unauthorized manager actions (e.g. Sales Rep approving quotes) with HTTP 403 Forbidden.
3. **Payload Strictness**: Zod schemas validate request boundaries to reject invalid negative prices, floating point junk, or un-seeded IDs.
4. **Immutable Audit Persistence**: Audit records are stored append-only in SQLite and cannot be modified via public REST endpoints.

---

## 2. Threat Vector Matrix & Mitigations

| Threat Vector | Description | Risk | Mitigation |
| :--- | :--- | :--- | :--- |
| **Price Tampering** | Client submits fake low `unitPrice` or `unitCost` | HIGH | Backend ignores client prices/costs; fetches authoritative values from DB catalog. |
| **Margin Manipulation** | Client sends `marginPercentage: 99%` | HIGH | Margin is calculated strictly in `MarginCalculator.ts` on server. |
| **Unauthorized Approval** | Sales Rep submits `POST /api/v1/approvals/:id/action` | HIGH | `authMiddleware` checks `X-Demo-Role === 'SALES_MANAGER'`. Returns `403`. |
| **Post-Approval Change** | Rep edits quote after Manager approval | HIGH | Modifying terms sets status to `REVISION_REQUIRED` / `PENDING_APPROVAL`. |
| **SQL Injection** | Malicious strings in API parameters | CRITICAL | Prisma ORM parameterizes all SQLite queries. |
| **XSS** | Script injection in audit comments / reasons | MEDIUM | React escapes rendered strings; backend sanitizes string inputs. |
