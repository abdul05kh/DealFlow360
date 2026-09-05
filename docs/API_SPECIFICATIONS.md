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

### `POST /api/v1/quotes`
- **Purpose**: Create and transactionally evaluate a new quote.
- **Request Body**:
```json
{
  "customerId": "cust_acme_101",
  "items": [
    {
      "productId": "prod_server_01",
      "quantity": 2,
      "discountPercent": 10.0
    },
    {
      "productId": "prod_service_01",
      "quantity": 1,
      "discountPercent": 18.0
    }
  ]
}
```
- **Response**: `201 Created`
```json
{
  "id": "quote_901",
  "quoteNumber": "QT-1001",
  "status": "APPROVAL_REQUIRED",
  "economics": {
    "grossRevenue": 350000.0,
    "discountAmount": 38000.0,
    "netRevenue": 312000.0,
    "estimatedCost": 210000.0,
    "grossMargin": 102000.0,
    "marginPercentage": 32.69
  },
  "riskEvaluation": {
    "score": 62.0,
    "level": "HIGH",
    "requiredApproverRole": "SALES_MANAGER",
    "triggeredRules": [
      {
        "ruleCode": "CATEGORY_DISCOUNT_LIMIT_EXCEEDED",
        "severity": "HIGH",
        "actualValue": 18.0,
        "threshold": 10.0,
        "explanation": "Discount of 18% on Implementation Services exceeds Services ceiling of 10%."
      }
    ]
  }
}
```

### `PUT /api/v1/quotes/:id`
- **Purpose**: Modify commercial terms of an existing quote. Triggers re-evaluation and invalidates prior approvals.
- **Request Body**: Same as POST `/api/v1/quotes`.
- **Response**: `200 OK`

---

## 3. Approval Workflow Endpoints

### `GET /api/v1/approvals`
- **Headers**: `X-Demo-Role: SALES_MANAGER`
- **Purpose**: Fetch pending approval requests queue.
- **Response**: `200 OK`

### `POST /api/v1/approvals/:id/action`
- **Headers**: `X-Demo-Role: SALES_MANAGER`
- **Purpose**: Approve or Reject a pending quote approval request.
- **Request Body**:
```json
{
  "action": "APPROVE",
  "reason": "Commercial justification accepted due to strategic enterprise volume."
}
```
- **Response**: `200 OK` (Updates quote status to `APPROVED` and records AuditEvent).

---

## 4. Recommendations & Audit Endpoints

### `GET /api/v1/quotes/:id/recommendations`
- **Purpose**: Fetch cross-sell and upsell add-on recommendations.

### `GET /api/v1/quotes/:id/audit`
- **Purpose**: Fetch chronological immutable audit log history for a quote.
