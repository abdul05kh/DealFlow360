# DealFlow360 — Database Design & Precision Specification

## 1. Database Overview
- **DBMS**: SQLite (via Prisma ORM)
- **File Location**: `server/prisma/dev.db`
- **Monetary Precision**: Stored as `Float` in SQLite, converted and processed via fixed 2-decimal rounding functions in domain services (`Math.round(val * 100) / 100`) to prevent floating-point accumulation errors.

---

## 2. Entity Descriptions & Field Specifications

### 2.1 `CustomerTier`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `code` | String | Unique | `BRONZE`, `SILVER`, `GOLD` |
| `name` | String | Not Null | Display name |
| `maxOverallDiscount` | Float | Not Null | Default overall max discount % |
| `minMarginThreshold` | Float | Not Null | Default min margin % requirement |

### 2.2 `Customer`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `name` | String | Not Null | Company / Client name |
| `tierId` | String | FK -> CustomerTier | Associated Customer Tier |
| `currency` | String | Default 'INR' | Account currency |
| `status` | String | Default 'ACTIVE' | Account status |

### 2.3 `ProductCategory`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `code` | String | Unique | `HARDWARE`, `SERVICES`, `SOFTWARE` |
| `name` | String | Not Null | Display name |
| `maxCategoryDiscount`| Float | Not Null | Maximum allowed discount % |

### 2.4 `Product`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `sku` | String | Unique | Stock keeping unit |
| `name` | String | Not Null | Product name |
| `categoryId` | String | FK -> ProductCategory | Parent category |
| `costPrice` | Float | Not Null | Authoritative unit cost price |
| `sellingPrice` | Float | Not Null | Authoritative list selling price |
| `isActive` | Boolean| Default true | Active catalog flag |

### 2.5 `User` (Demo Identities)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `name` | String | Not Null | User name |
| `email` | String | Unique | Email address |
| `role` | String | Not Null | `SALES_REP`, `SALES_MANAGER` |

### 2.6 `Quote`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `quoteNumber` | String | Unique | Unique quote identifier (e.g. `QT-1001`) |
| `customerId` | String | FK -> Customer | Associated customer |
| `salesRepId` | String | FK -> User | Quote creator |
| `status` | String | Not Null | `DRAFT`, `EVALUATED`, `APPROVAL_REQUIRED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISION_REQUIRED` |
| `grossRevenue` | Float | Not Null | Sum of gross line totals |
| `discountAmount` | Float | Not Null | Total discount amount |
| `netRevenue` | Float | Not Null | Net revenue (`grossRevenue - discountAmount`) |
| `estimatedCost` | Float | Not Null | Total estimated cost |
| `grossMargin` | Float | Not Null | Net revenue minus cost |
| `marginPercentage` | Float | Not Null | Gross margin % |
| `riskLevel` | String | Not Null | `LOW`, `MEDIUM`, `HIGH` |
| `riskScore` | Float | Not Null | Bounded 0-100 score |
| `riskReasonsJson` | String | Not Null | JSON array of explainable reasons |
| `requiredApproverRole`| String | Nullable | Role needed for approval |

### 2.7 `QuoteLine`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `quoteId` | String | FK -> Quote | Parent quote |
| `productId` | String | FK -> Product | Selected product |
| `quantity` | Int | Not Null | Line quantity |
| `unitPrice` | Float | Not Null | Authoritative unit selling price |
| `unitCost` | Float | Not Null | Authoritative unit cost price |
| `discountPercent` | Float | Not Null | Requested line discount % |
| `discountAmount` | Float | Not Null | Computed line discount amount |
| `subtotal` | Float | Not Null | Gross line total |
| `netTotal` | Float | Not Null | Net line total |
| `lineCost` | Float | Not Null | Total cost for line |
| `lineMargin` | Float | Not Null | Total net margin for line |

### 2.8 `ApprovalRequest`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `quoteId` | String | FK -> Quote | Target quote |
| `status` | String | Not Null | `PENDING`, `APPROVED`, `REJECTED` |
| `requiredRole` | String | Not Null | `SALES_MANAGER` |
| `assignedApproverId`| String | Nullable | Assigned user |
| `actionedById` | String | Nullable | User who acted |
| `actionReason` | String | Nullable | Approval / rejection rationale |
| `createdAt` | DateTime| Default now | Creation timestamp |
| `actionedAt` | DateTime| Nullable | Action timestamp |

### 2.9 `AuditEvent`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `entityType` | String | Not Null | e.g. `Quote`, `ApprovalRequest` |
| `entityId` | String | Not Null | Id of entity |
| `actorId` | String | Not Null | User ID performing action |
| `actorName` | String | Not Null | User name |
| `action` | String | Not Null | Action type e.g. `QUOTE_EVALUATED` |
| `previousStateJson` | String | Nullable | Previous entity snapshot |
| `newStateJson` | String | Nullable | New entity snapshot |
| `contextJson` | String | Nullable | Extra metadata |
| `createdAt` | DateTime| Default now | Immutable timestamp |

### 2.10 `CrossSellRule`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | PK | UUID |
| `triggerProductId` | String | FK -> Product | Source product |
| `recommendedProductId`| String | FK -> Product | Recommended add-on |
| `reasonTemplate` | String | Not Null | Explanation copy |
| `minMarginPercent` | Float | Default 30.0 | Margin safety threshold |
