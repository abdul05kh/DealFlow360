# DealFlow360 — Business Rules Specification

## 1. Core Thesis
*"Don't just manage deals. Make the sales system govern them."*

---

## 2. Customer Tier Governance
Customer tiers determine overall discount ceilings and risk sensitivities.

| Tier Code | Tier Name | Default Overall Discount Ceiling | Risk Multiplier |
| :--- | :--- | :--- | :--- |
| `GOLD` | Gold Tier Customer | 15.0% | 1.0x |
| `SILVER` | Silver Tier Customer | 10.0% | 1.2x |
| `BRONZE` | Bronze Tier Customer | 5.0% | 1.5x |

### Rule BR-001: Customer Tier Ceiling Violation
If a quote's overall discount (`total_discount_amount / gross_revenue * 100`) exceeds the customer tier's ceiling:
- Triggered Rule Code: `CUSTOMER_TIER_DISCOUNT_EXCEEDED`
- Severity: `HIGH`
- Required Action: Requires `SALES_MANAGER` approval.

---

## 3. Product Category Governance
Product categories enforce maximum category-specific discount ceilings.

| Category Code | Category Name | Default Maximum Discount |
| :--- | :--- | :--- |
| `HARDWARE` | Hardware Products | 15.0% |
| `SERVICES` | Consulting & Implementation | 10.0% |
| `SOFTWARE` | Subscriptions & Licenses | 20.0% |

### Rule BR-002: Category Discount Ceiling Violation
If any line item's discount percentage exceeds its product category limit:
- Triggered Rule Code: `CATEGORY_DISCOUNT_LIMIT_EXCEEDED`
- Severity: `HIGH` (for Services/Hardware) or `MEDIUM`
- Explanation: `"Discount of X% on [Product] exceeds the [Category] ceiling of Y%."`
- Required Action: Requires `SALES_MANAGER` approval.

---

## 4. Margin Erosion Governance

### Financial Formulae
- `gross_revenue` = $\sum (\text{unit\_price} \times \text{quantity})$
- `discount_amount` = $\sum (\text{unit\_price} \times \text{quantity} \times \frac{\text{discount\_percent}}{100})$
- `net_revenue` = $\text{gross\_revenue} - \text{discount\_amount}$
- `estimated_cost` = $\sum (\text{unit\_cost} \times \text{quantity})$
- `gross_margin` = $\text{net\_revenue} - \text{estimated\_cost}$
- `margin_percentage` = $\frac{\text{gross\_margin}}{\text{net\_revenue}} \times 100$

### Rule BR-003: Target Margin Erosion Threshold
- Configured Standard Target Margin: `30.0%`
- Minimum Critical Margin: `15.0%`
- If `margin_percentage < 30.0%` and `>= 15.0%`:
  - Triggered Rule Code: `MARGIN_BELOW_TARGET`
  - Risk Severity: `MEDIUM`
- If `margin_percentage < 15.0%`:
  - Triggered Rule Code: `CRITICAL_MARGIN_EROSION`
  - Risk Severity: `HIGH`
  - Required Approval: `SALES_MANAGER` + `FINANCE_APPROVER`

---

## 5. Explainable Deal Risk Engine Scoring Formula

The deal risk score is a deterministic, bounded value $[0, 100]$ computed as follows:

$$\text{RiskScore} = \min\left(100, \text{BaseRisk} + \text{TierPenalty} + \text{CategoryPenalty} + \text{MarginPenalty} + \text{StackingPenalty}\right)$$

Where:
- $\text{BaseRisk} = 0$
- $\text{TierPenalty} = (\text{ActualOverallDiscount} - \text{TierCeiling}) \times 3$ (if positive, else 0)
- $\text{CategoryPenalty} = \sum \left( (\text{LineDiscount} - \text{CategoryCeiling}) \times 4 \right)$ (for each violating line)
- $\text{MarginPenalty} = (30.0 - \text{ActualMarginPercent}) \times 2$ (if positive, else 0)
- $\text{StackingPenalty} = 15$ if more than 1 policy is violated simultaneously.

### Risk Levels:
- **`LOW`** (0 - 29): `AUTO_APPROVED` (if no `HIGH` severity rules triggered).
- **`MEDIUM`** (30 - 59): `APPROVAL_REQUIRED` (`SALES_MANAGER`).
- **`HIGH`** (60 - 100): `APPROVAL_REQUIRED` (`SALES_MANAGER`).

---

## 6. Approval Lifecycle State Machine

```
      [DRAFT]
         │
         ▼
    (Evaluate)
         │
 ┌───────┴────────┐
 │                │
 ▼                ▼
[AUTO_APPROVED] [APPROVAL_REQUIRED]
                  │
                  ▼
          [PENDING_APPROVAL]
            │          │
    (Approve)          (Reject)
       │                  │
       ▼                  ▼
  [APPROVED]          [REJECTED]
       │
 (Modify Quote Terms)
       │
       ▼
 [REVISION_REQUIRED]
```

### Rule BR-004: Post-Approval Modification Governance
If a quote is in status `APPROVED` and any item quantity, price, or discount percentage is modified:
1. Status immediately converts to `REVISION_REQUIRED`.
2. Governance engine re-evaluates all policies against the new terms.
3. If new terms violate policies, status advances to `PENDING_APPROVAL`, invalidating the prior approval.

---

## 7. Cross-Sell / Upsell Governance Rule
Cross-sell rules trigger recommendations only if:
1. Trigger product is present in quote lines.
2. Recommended product is not already added.
3. Adding the recommended product at list price maintains `margin_percentage >= 30.0%`.
