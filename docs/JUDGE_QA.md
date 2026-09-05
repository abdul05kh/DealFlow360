# DealFlow360 — Judge & Reviewer Q&A Reference

### Q1: What problem does DealFlow360 solve?
**A**: Normal sales software answers *"What is the status of this quotation?"*. DealFlow360 answers *"Is this deal commercially safe to move forward?"*. It replaces manual discount sign-offs with deterministic, server-evaluated commercial governance.

### Q2: Is the governance logic hardcoded or configurable?
**A**: Completely configurable via database seed records (`CustomerTier`, `DiscountPolicy`, `ApprovalRule`). Changing customer tiers or category ceilings in DB configuration changes system behavior dynamically.

### Q3: How do you prevent frontend price/discount tampering?
**A**: The frontend is never trusted. The server fetches list prices and costs directly from SQLite catalog tables, executes financial math in pure domain classes, and re-evaluates all policies on every request.

### Q4: What happens if an approved quote is modified?
**A**: Changing terms on an `APPROVED` quote immediately resets the status to `REVISION_REQUIRED` / `PENDING_APPROVAL`, forcing re-evaluation against commercial policy before proceeding.

### Q5: How would this integrate with Odoo?
**A**: DealFlow360 functions as an automated commercial governance gate inside the Odoo Sales (`sale.order`) lifecycle. Quotes in `APPROVAL_REQUIRED` state are blocked from confirming to Sales Orders (`sale.order.action_confirm`) until approved.
