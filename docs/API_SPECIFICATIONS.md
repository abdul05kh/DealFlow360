# DealFlow360 — API Specifications

## Overview
All REST API endpoints are exposed under `/api/v1`.
All requests expecting user context must pass standard headers:
- `X-Demo-Role`: `SALES_REP` | `SALES_MANAGER`
- `X-Demo-User-Id`: User UUID

---

## 1. Master Data Endpoints

### `GET /api/v1/customers`
- **Purpose**: Fetch all active customers with their customer tier information.
- **Response**: `200 OK`
```json
[
  {
    "id": "cust_acme_101",
    "name": "Acme Industries",
    "currency": "INR",
    "tier": {
      "code": "GOLD",
      "name": "Gold Tier Customer",
      "maxOverallDiscount": 15.0,
      "minMarginThreshold": 30.0
    }
  }
]
```

### `GET /api/v1/products`
- **Purpose**: Fetch catalog products with prices, costs, and category discount rules.
- **Response**: `200 OK`
```json
[
  {
    "id": "prod_server_01",
    "sku": "HW-SRV-001",
    "name": "Enterprise Server",
    "sellingPrice": 150000.0,
    "costPrice": 90000.0,
    "category": {
      "code": "HARDWARE",
      "name": "Hardware Products",
      "maxCategoryDiscount": 15.0
    }
  }
]
```

---

## 2. Quote & Governance Endpoints

### `POST /api/v1/quotes/evaluate`
- **Headers**: `X-Demo-Role`: `SALES_REP` | `SALES_MANAGER`
- **Purpose**: Evaluates a proposed quote against commercial policies, customer tier ceilings, category ceilings, risk engine, and recommendation engine without persisting it.
- **Request Body (Strict Zod Schema)**:
```json
{
  "customerId": "cust_acme_101",
  "items": [
    {
      "productId": "prod_server_01",
      "quantity": 1,
      "discountPercent": 10.0
    }
  ]
}
```
- **Security Rule**: Any client attempts to supply `unitPrice`, `costPrice`, `margin`, `riskScore`, `riskLevel`, `approvalStatus`, or `role` in the request body are strictly rejected with `400 Bad Request`.
- **Response**: `200 OK`

### `POST /api/v1/quotes`
- **Headers**: `X-Demo-Role`: `SALES_REP` | `SALES_MANAGER`
- **Purpose**: Evaluates, persists `Quote` + `QuoteLine` + `ApprovalRequest` records in a single Prisma transaction, and logs a `QUOTE_CREATED` `AuditEvent`.
- **Request Body**: Same strict schema as `/evaluate`.
- **Response**: `201 Created`

### `POST /api/v1/quotes/:quoteId/approve`
- **Headers**: `X-Demo-Role: SALES_MANAGER` (Required)
- **Purpose**: Approves a pending quote in `PENDING_APPROVAL` status. Validates role authorization and state transition safety.
- **Request Body**:
```json
{
  "reason": "Commercial justification accepted for strategic account."
}
```
- **Response**: `200 OK` (or `403 Forbidden` for Sales Reps, `409 Conflict` for invalid transitions).

### `POST /api/v1/quotes/:quoteId/reject`
- **Headers**: `X-Demo-Role: SALES_MANAGER` (Required)
- **Purpose**: Rejects a pending quote in `PENDING_APPROVAL` status.
- **Request Body**: Same as approve endpoint.
- **Response**: `200 OK`

### `GET /api/v1/quotes/:quoteId`
- **Headers**: `X-Demo-Role`: `SALES_REP` | `SALES_MANAGER`
- **Purpose**: Retrieves quote details, lines, customer info, approval requests, and chronological immutable audit log history.
- **Response**: `200 OK` (or `404 Not Found`).

