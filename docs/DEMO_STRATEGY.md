# DealFlow360 — Demo Strategy & Reviewer Walkthrough

## 1. 60-90 Second Golden Path Script

1. **Identity Setup**: Start as **Sales Rep** (`rep_1`).
2. **Customer Selection**: Select **Acme Industries** (Identified as **Gold Tier** customer with 15% overall ceiling).
3. **Build Quote**: Add 2x Enterprise Server (Hardware, ₹1,50,000 unit list price) + 1x Implementation Services (Services, ₹50,000 list price).
4. **Apply Aggressive Discount**: Enter **18% discount** on Implementation Services.
5. **Observe Live Governance Engine**:
   - Live net revenue, gross cost, and gross margin automatically calculate on server.
   - **Risk Status changes to HIGH** (`score: 62.0`).
   - **Triggered Rule Explanation**: *"Services discount of 18% exceeds Gold customer Services ceiling of 10%."*
   - Status transitions to **`APPROVAL_REQUIRED`** (Target: `SALES_MANAGER`).
6. **Submit Quote**: Quote enters **`PENDING_APPROVAL`** state.
7. **Switch Identity**: Toggle Demo Switcher to **Sales Manager** (`mgr_1`).
8. **Manager Review Queue**: Open Approval Queue -> View quote `QT-1001` -> Inspect financial impact, policy violations, and risk score.
9. **Manager Decision**: Click **Approve** with reason *"Accepted due to strategic enterprise volume."*
10. **Audit Trail Verification**: Open Audit Trail drawer -> Observe immutable log recording Rep submission and Manager approval timestamp.
11. **Accept Upsell Recommendation**: Click **Add Extended Warranty** recommendation -> Quote recalculates, gross margin improves, and governance updates.
