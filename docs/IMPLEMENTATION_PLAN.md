# Implementation Plan - DealFlow360 Flow A (Commercial Governance Engine)

## Executive Summary
DealFlow360 is a **Deal Governance Engine** layered around the sales lifecycle for the Odoo Hackathon 2026.
**Thesis**: *"Don't just manage deals. Make the sales system govern them."*
Flow A focuses on **Commercial Intelligence + Governance**, ensuring every quote creation, discount application, margin shift, policy violation, approval requirement, and upsell recommendation is evaluated deterministically by the backend business logic and stored in a persistent audit trail.

---

## Architecture Locks (Phase 0)
- **Database & Persistence**: SQLite + Prisma ORM + Prisma Migrations (`prisma/schema.prisma`).
- **Domain Decoupling**: Pure domain engines in `/server/src/domain/` with zero DB dependencies.
- **Server Source of Truth**: Frontend calculations are never trusted; backend re-computes costs, prices, margins, risk scores, and approval state.
- **Explainable Governance Risk**: Risk output includes `score`, `level`, `triggeredRules`, `requiredApproval`, `reasons`.
- **Configurable Policies**: Ceilings, thresholds, and roles loaded dynamically from database seed.
- **Re-evaluation Rule**: Commercial edits to `APPROVED` quotes reset status to `REVISION_REQUIRED` / `PENDING_APPROVAL`.
- **Demo Security**: Backend header-based authorization (`X-Demo-Role`, `X-Demo-User-Id`).
- **Immutable Audit Trail**: Persistent `AuditEvent` records for all governance lifecycle transitions.

---

## Milestone Execution Plan

### Phase 0: Inspection & Architectural Foundations (COMPLETED)
- Inspect environment: Git initialized on `main`, remote origin `https://github.com/abdul05kh/DealFlow360.git`, Node `v24.13.0`, npm `11.6.2`.
- Lock architecture decisions in `docs/DECISIONS.md`.
- Document high-level system architecture (`docs/SYSTEM_ARCHITECTURE.md`), folder layout (`docs/FOLDER_STRUCTURE.md`), and implementation plan (`docs/IMPLEMENTATION_PLAN.md`).
- Commit: `docs: establish DealFlow360 architecture foundation`

### Phase 1: Application Foundation & Database Schema (IN PROGRESS)
- Initialize monorepo root `package.json`, server workspace, and client workspace.
- Setup TypeScript configs (`tsconfig.json`), Express, Prisma ORM, SQLite database configuration.
- Implement foundational database schema in `server/prisma/schema.prisma`:
  - `CustomerTier`, `Customer`, `ProductCategory`, `Product`, `User`, `DiscountPolicy`, `ApprovalRule`, `Quote`, `QuoteLine`, `ApprovalRequest`, `AuditEvent`, `CrossSellRule`.
- Run Prisma migrations (`npx prisma migrate dev`).
- Create comprehensive seed script (`server/prisma/seed.ts`):
  - Customers: Acme (Gold, 15% ceiling), Nova (Silver, 10%), BluePeak (Bronze, 5%).
  - Categories: Hardware, Services (10% ceiling), Software.
  - Products: Server, Network Appliance, Implementation Services, Premium Support, Analytics Suite, Extended Warranty.
  - Demo Users: Sales Rep (`rep_1`), Sales Manager (`mgr_1`).
  - Cross-sell rule (Laptop/Server -> Extended Warranty).
- Setup Vitest & Supertest test infrastructure (`server/tests/`).
- Implement foundation integration tests:
  - Application startup test.
  - Database connectivity test.
  - Migration & seed verification test.
  - Health check & API route test.
  - Input validation error handling test.
- Commit: `chore: initialize DealFlow360 application foundation`
- Push stable commits to remote repository (`https://github.com/abdul05kh/DealFlow360`).
- **STOP & REPORT** to Command Center.

### Phase 2: Domain Engine & Master Data Services (NEXT)
- Implement `MarginCalculator.ts`, `DiscountGovernance.ts`, `DealRiskEngine.ts`, `ApprovalRoutingEngine.ts`, `RecommendationEngine.ts`.
- Master data API endpoints (`/api/v1/customers`, `/api/v1/products`, `/api/v1/policies`).
- Complete domain unit test suite.

### Phase 3: Quote Engine & Backend Governance Pipeline
- Transactional quote creation & update endpoints (`/api/v1/quotes`).
- Anti-tampering unit & integration tests.

### Phase 4: Approval Routing & Audit Trail Workflow
- Manager approval / rejection API endpoints (`/api/v1/approvals`).
- Re-evaluation logic on quote modification.
- Immutable audit trail queries (`/api/v1/audit`).

### Phase 5: Recommendation Engine Integration
- Cross-sell / upsell recommendation endpoint (`/api/v1/recommendations`).
- Recalculation on recommendation acceptance.

### Phase 6: Anti-Vibecode Business UI & Reviewer Scenario
- React / Vite frontend with identity switcher, live quote builder, risk panel, approval queue, and audit trail drawer.

### Phase 7: QA, Security & Reviewer Stabilization
- Comprehensive test suite execution, security red-teaming, and golden path validation.

---

## Verification Plan

### Automated Verification
- `npm run test` executing Vitest across domain logic, backend APIs, DB connectivity, and validation constraints.
- `npm run lint` / TypeScript check (`tsc --noEmit`).

### Manual Verification Checklist
- Run Prisma Studio / SQLite query to verify seeded master data.
- Execute HTTP requests against API server to confirm Zod validation failures on invalid payloads.
