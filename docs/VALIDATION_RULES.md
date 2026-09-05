# DealFlow360 — Validation Rules Specification

## 1. Request Boundary Constraints (Zod Schemas)

### 1.1 Quote Creation / Modification (`QuoteCreateSchema`)
- `customerId`: Required UUID string. Must match active record in `Customer` table.
- `items`: Non-empty array of quote lines (Min length: 1, Max length: 50).
  - `productId`: Required UUID string. Must match active record in `Product` table.
  - `quantity`: Positive Integer (`quantity > 0` and `quantity <= 1000`).
  - `discountPercent`: Number between `0.0` and `100.0` inclusive (`0 <= discountPercent <= 100`).

### 1.2 Approval Action Payload (`ApprovalActionSchema`)
- `action`: Enum string (`APPROVE` | `REJECT`).
- `reason`: String required (`minLength: 5`, `maxLength: 500`). Rejects blank/whitespace-only comments.

---

## 2. Business Boundary Validation Rules

1. **Inactive Product Check**: Attempting to add an inactive product (`isActive === false`) returns HTTP `400 Bad Request`.
2. **Invalid Customer Tier Check**: If customer lacks an assigned tier, quote creation returns HTTP `422 Unprocessable Entity`.
3. **Zero Quantity Check**: Items with `quantity <= 0` are rejected immediately at validation middleware layer.
4. **Out-of-Bound Discount Check**: Line discounts `< 0%` or `> 100%` return HTTP `400 Bad Request`.
