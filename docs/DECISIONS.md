# DealFlow360 — Architecture Decision Record (ADR)

## ADR-001: Technology Stack & Architectural Locks

### Status
**LOCKED & APPROVED** (Phase 0)

### Context & Product Thesis
DealFlow360 is a **Deal Governance Engine** layered around the sales lifecycle.
Positioning: *"Don't just manage deals. Make the sales system govern them."*
The solution must provide deterministic, explainable, server-calculated governance for discounts, margins, risk scoring, approval routing, audit logging, and upsell recommendations under strict 24-hour hackathon constraints.

---

## Decisions

### 1. Database & Persistence Layer
- **Chosen**: **SQLite + Prisma ORM + Prisma Migrations**
- **Why**:
  - Relational integrity with full foreign keys, unique constraints, and transaction boundaries.
  - Zero complex cloud infrastructure or docker overhead required for a 24-hour hackathon.
  - Prisma provides a typed schema (`schema.prisma`), migrations tracking, and reproducible seed capability.
- **Rejected Alternatives**:
  - *PostgreSQL / MySQL*: Unnecessary local infrastructure complexity for hackathon demo.
  - *Knex / TypeORM*: Avoided to maintain a single unified ORM standard with zero redundant query builders.
  - *Raw SQL*: Disallowed for standard CRUD. Allowed only if a specific SQLite/Prisma performance or feature edge case is encountered and documented.

### 2. Domain & Repository Layer Decoupling
- **Chosen**: Clean separation between **Domain Engines** (`src/domain`), **Services** (`src/services`), **Repositories** (`src/repositories`), and **Database Access** (`src/db`).
- **Why**:
  - The domain logic (margin calculations, discount policy evaluation, deal risk scoring, approval routing) must remain pure TypeScript functions/classes, independent of Prisma models.
  - Allows 100% fast unit testing of business rules without requiring mock DB connections or active database instances.

### 3. Server as Sole Commercial Source of Truth
- **Chosen**: Strict backend financial & governance recalculation on every request.
- **Rules**:
  - Frontend is **never trusted** for unit cost, selling price, margin, net revenue, risk score, approval status, or required approvers.
  - Frontend sends only raw inputs: `customerId`, `items: [{ productId, quantity, discountPercent }]`.
  - Backend fetches authoritative product prices and costs, validates input ranges, computes exact monetary math using fixed precision, evaluates governance policies, and determines state transitions.

### 4. Approval Lifecycle & Governance State Machine
- **Chosen Lifecycle**:
  - `DRAFT` → `EVALUATED` → `AUTO_APPROVED`
  - `DRAFT` → `EVALUATED` → `APPROVAL_REQUIRED` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED`
  - `APPROVED` + (commercial edit) → `REVISION_REQUIRED` → `PENDING_APPROVAL`
- **Why**: Ensures an approved deal cannot have its terms altered post-approval without forcing re-evaluation and approval re-routing.

### 5. Explainable Governance Risk Model
- **Chosen**: Multi-factor explainable risk evaluation structure (`score`, `level`, `triggeredRules`, `requiredApproval`, `reasons`).
- **Why**: Reviewers require clear context on why a deal is flagged as HIGH or MEDIUM risk. Each triggered rule yields structured metadata (`ruleCode`, `ruleName`, `severity`, `actualValue`, `threshold`, `explanation`).

### 6. Data-Driven Policy Configuration
- **Chosen**: Customer tier ceilings (Bronze/Silver/Gold), category discount limits, margin thresholds, and approval roles are loaded dynamically from the SQLite database seeded at startup.
- **Why**: Demonstrates real configurable business engine logic rather than hardcoded UI conditions.

### 7. Demo Identity & Role-Based Authorization
- **Chosen**: Demo header-based identity (`X-Demo-Role`: `SALES_REP` | `SALES_MANAGER`, `X-Demo-User-Id`).
- **Why**: Simple to demonstrate in UI identity switcher while ensuring backend REST endpoints strictly enforce role authorization (e.g. Sales Reps cannot call `/api/v1/approvals/:id/action`).

---

## Summary Matrix

| Decision Area | Selected Technology / Pattern | Rationale |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v24) + TypeScript | High performance, static typing, rapid development |
| **HTTP Server** | Express.js | Standard, transparent REST API routing |
| **ORM & DB** | Prisma + SQLite | Declarative schema, migrations, relational integrity |
| **Frontend** | React 18 + Vite + Tailwind CSS | High responsive performance, serious business UI |
| **Validation** | Zod | Runtime payload safety at API layer |
| **Testing** | Vitest + Supertest | Blazing fast unit & integration tests |
| **Architecture** | Input → Validate → Domain → Governance → Persist → Audit | No client-side trust, complete backend control |

---

## ADR-002: Financial Representation (Minor Integer Units) & Pure Domain Engines

### Status
**LOCKED & IMPLEMENTED** (Phase 2 / Flow A Increment 1)

### Context & Decisions
1. **Financial Arithmetic via Minor Integer Units**:
   - Floating point arithmetic drift is eliminated by converting major currency values to integer minor units internally (`Math.round(val * 100)`).
   - Line gross, discount amounts, net revenue, estimated cost, and gross margin are computed using minor unit integer arithmetic.
   - Conversion back to 2-decimal major units (`minorVal / 100`) occurs only at the domain boundary output.
2. **Pure Domain Engine Decoupling**:
   - `MarginCalculator`, `DiscountGovernance`, `DealRiskEngine`, `ApprovalRoutingEngine`, and `RecommendationEngine` have zero imports or runtime dependencies on Prisma, Express, or React.
3. **Configuration-Driven Recommendations**:
   - Cross-sell rule evaluation uses `CrossSellRule.minMarginPercent` directly from database configuration rather than hardcoding global threshold constants.

