# DealFlow360 — Flow B Multi-Warehouse Fulfillment Rules & Architecture

## 1. Fulfillment Thesis
Flow B governs operational fulfillment for approved deals. Once a quote passes commercial governance (Flow A) and enters an approved state (`APPROVED` or `AUTO_APPROVED`), the system determines optimal warehouse allocation, multi-warehouse splits, shipping costs, and backorder requirements.

## 2. Warehouse & Inventory Model
- **`Warehouse`**: Represents physical distribution hubs (`BOM-01` Mumbai Central, `DEL-02` Delhi North, `BLR-03` Bengaluru Tech Depot). Each warehouse has a `baseShippingCost`, priority number, and location.
- **`InventoryStock`**: Tracks per-product stock per warehouse with `quantityOnHand` and `quantityReserved`. Uniqueness enforced by `@@unique([warehouseId, productId])`.
- **`FulfillmentPlan`**: Tracks overall quote fulfillment state (`ALLOCATED`, `PARTIALLY_FULFILLED_BACKORDER`), shipment count, total shipping cost, and total backordered units.
- **`FulfillmentItem`**: Tracks line-item allocations to specific warehouses or backorders.

## 3. Available Quantity Definition
$$\text{availableQuantity} = \text{quantityOnHand} - \text{quantityReserved}$$
Server-authoritative calculation. Client-supplied inventory numbers are strictly rejected.

## 4. Allocation Algorithm Steps
1. **Candidate Selection**: Filter warehouses holding active stock (`availableQuantity > 0`) for requested product.
2. **Single-Warehouse Preference**: If any single warehouse has `availableQuantity >= requestedQuantity`, allocate 100% to that warehouse.
   - Deterministic Comparator: Lower base shipping cost → Higher available stock → Lower priority number → Alphabetical warehouse code.
3. **Multi-Warehouse Split**: If no single warehouse can satisfy 100%, split across warehouses sorted by `availableQuantity` DESC (to minimize shipment count).
4. **Backorder Handling**: If aggregate stock across all warehouses is insufficient, allocate all available stock and assign the remaining unfulfilled quantity to `status: 'BACKORDERED', warehouseId: null`.
5. **Aggregated Results**: Calculate `totalShipments` (count of unique non-null warehouses used) and `totalFulfillmentCost`.

## 5. Shipping Cost Aggregation Rule
Shipping cost represents the base fee of executing a warehouse shipment:
$$\text{totalShipments} = | \{ \text{warehouseId} \mid \text{item.status} = \text{'FULFILLED'} \} |$$
$$\text{totalFulfillmentCost} = \sum_{\text{wh} \in \text{uniqueWarehouses}} \text{wh.baseShippingCost}$$
If multiple products are shipped from the same warehouse within the same fulfillment plan, the base shipping fee for that warehouse is charged **once**.

## 6. Reservation Concurrency Requirement (Planned for 4B Boundary)
When persisting fulfillment plans in Increment 4B, inventory reservation MUST atomically verify:
$$\text{quantityOnHand} - \text{quantityReserved} \ge \text{allocatedQuantity}$$
within an isolated `prisma.$transaction` block before incrementing `quantityReserved`.

## 7. Manual Override Invariants (Planned for 4B Boundary)
Manual warehouse assignment overrides submitted by Operations Leads must be validated against server inventory. Overrides attempting to assign a warehouse without sufficient available stock will be rejected with HTTP 409 Conflict.
