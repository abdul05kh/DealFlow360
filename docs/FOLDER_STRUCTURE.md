# DealFlow360 — Folder Structure

```
DealFlow360/
├── docs/                        # Architecture, PRD, ER Diagrams, API Specs & Guides
│   ├── DECISIONS.md             # ADR Architecture Decisions & Locks
│   ├── SYSTEM_ARCHITECTURE.md   # High-level architecture & sequence diagrams
│   ├── FOLDER_STRUCTURE.md      # Repository directory layout breakdown
│   ├── IMPLEMENTATION_PLAN.md   # Milestone tracking & phase plan
│   ├── PRD.md                   # Product Requirements Document
│   ├── ER_DIAGRAM.md            # Entity Relationship diagrams
│   ├── SEQUENCE_DIAGRAMS.md     # Flow A Sequence diagrams
│   ├── CLASS_DIAGRAMS.md        # Domain engine class diagrams
│   ├── DATABASE_DESIGN.md       # Relational schema design & precision spec
│   ├── API_SPECIFICATIONS.md    # REST API endpoints & DTO contracts
│   ├── FRONTEND_DESIGN_SYSTEM.md# Anti-vibecode UX & Design Tokens
│   ├── BACKEND_DESIGN.md        # Layering, services & domain engines
│   ├── SECURITY_DESIGN.md       # Red-teaming & authorization bounds
│   ├── VALIDATION_RULES.md      # Payload boundary & business validation rules
│   ├── BUSINESS_RULES.md        # Discount policy, risk formula & approval routing
│   ├── GIT_STRATEGY.md          # Branch & commit conventions
│   ├── DEMO_STRATEGY.md         # 60-90s reviewer presentation strategy
│   ├── JUDGE_QA.md              # Evidence-based jury Q&A
│   ├── DEPLOYMENT_GUIDE.md      # Local setup & execution guide
│   ├── DEVELOPER_HANDBOOK.md    # Code standards & adding business rules
│   ├── HANDOVER.md              # Status & known limitations
│   ├── TEST_CHECKLIST.md        # Verification suite checklist
│   └── ROLLBACK.md              # Recovery & stable commit points
├── server/                      # Node.js / Express / TypeScript Backend
│   ├── prisma/                  # Prisma ORM schema & seed script
│   │   ├── schema.prisma        # SQLite Relational Database Model
│   │   └── seed.ts              # Seed master data (Acme, Nova, Products, Policies)
│   ├── src/                     # Server Source Code
│   │   ├── config/              # Environment & application settings
│   │   ├── db/                  # Prisma client instance
│   │   ├── domain/              # Pure Domain Logic Engines (Zero DB dependencies)
│   │   │   ├── MarginCalculator.ts
│   │   │   ├── DiscountGovernance.ts
│   │   │   ├── DealRiskEngine.ts
│   │   │   ├── ApprovalRoutingEngine.ts
│   │   │   └── RecommendationEngine.ts
│   │   ├── middleware/          # Role auth & payload validation middleware
│   │   ├── repositories/        # Data access layer (Prisma abstractions)
│   │   ├── routes/              # Express API router definitions
│   │   ├── services/            # Transactional service orchestration
│   │   ├── types/               # TypeScript interfaces & DTO contracts
│   │   ├── utils/               # Precision math & formatting helpers
│   │   └── app.ts               # Express application entry point
│   ├── tests/                   # Vitest & Supertest suite
│   │   ├── unit/                # Domain engines unit tests
│   │   ├── integration/         # REST API endpoint tests
│   │   └── security/            # Anti-tampering & role auth tests
│   ├── package.json
│   └── tsconfig.json
├── client/                      # React 18 / Vite / TypeScript Frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components (Tables, Badges, Modals)
│   │   ├── features/            # Feature modules (QuoteBuilder, ApprovalQueue, AuditTrail)
│   │   ├── context/             # Demo Identity & Quote State Management
│   │   ├── services/            # API Client services (Fetch wrappers)
│   │   ├── types/               # Frontend DTO interfaces
│   │   ├── App.tsx              # Main Dashboard Layout
│   │   └── main.tsx             # React entrypoint
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── .gitignore
├── package.json                 # Monorepo root scripts
└── README.md                    # Main project overview & quickstart
```
