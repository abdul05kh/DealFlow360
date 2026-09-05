import {
  DomainValidationError,
  FulfillmentCandidateWarehouse,
  FulfillmentEvaluationResult,
  FulfillmentItemDecision,
  FulfillmentLineInput,
  FulfillmentPlanStatus,
} from '../types';

export class FulfillmentEngine {
  /**
   * Evaluates optimal warehouse allocation for quote line items against live inventory candidates.
   * Pure domain function: zero side-effects, zero DB access, zero HTTP dependencies.
   */
  evaluateFulfillment(
    lines: FulfillmentLineInput[],
    candidateInventory: FulfillmentCandidateWarehouse[]
  ): FulfillmentEvaluationResult {
    // 1. Validation
    if (!lines || lines.length === 0) {
      throw new DomainValidationError('At least one quote line is required for fulfillment evaluation.');
    }

    for (const line of lines) {
      if (!line.requestedQuantity || line.requestedQuantity <= 0 || !Number.isInteger(line.requestedQuantity)) {
        throw new DomainValidationError(`Invalid requested quantity: ${line.requestedQuantity}. Quantity must be a positive integer.`);
      }
    }

    // Working stock map: key = `${warehouseId}:${productId}` -> current working available stock
    const workingStock = new Map<string, number>();
    const warehouseMeta = new Map<string, FulfillmentCandidateWarehouse>();

    for (const cand of candidateInventory) {
      const key = `${cand.warehouseId}:${cand.warehouseCode}`;
      workingStock.set(cand.warehouseId, Math.max(0, cand.availableQuantity));
      warehouseMeta.set(cand.warehouseId, cand);
    }

    // Map candidate inventory by productId
    const inventoryByProduct = new Map<string, FulfillmentCandidateWarehouse[]>();
    for (const cand of candidateInventory) {
      const list = inventoryByProduct.get(cand.productId) || [];
      list.push(cand);
      inventoryByProduct.set(cand.productId, list);
    }

    const items: FulfillmentItemDecision[] = [];

    // Process each quote line
    for (const line of lines) {
      let unallocatedQuantity = line.requestedQuantity;
      const candidates = inventoryByProduct.get(line.productId) || [];

      // Filter candidates with available stock > 0
      const activeCandidates = candidates.filter(
        (c) => (workingStock.get(c.warehouseId) ?? 0) > 0
      );

      // STEP 2: Single-Warehouse Preference Check
      // Find candidate warehouses that can satisfy 100% of requestedQuantity
      const fullFillCandidates = activeCandidates.filter(
        (c) => (workingStock.get(c.warehouseId) ?? 0) >= unallocatedQuantity
      );

      if (fullFillCandidates.length > 0) {
        // Sort full-fill candidates by deterministic comparator
        fullFillCandidates.sort((a, b) => {
          // 1. Lower shipping cost
          if (a.baseShippingCost !== b.baseShippingCost) {
            return a.baseShippingCost - b.baseShippingCost;
          }
          // 2. Higher available stock
          const stockA = workingStock.get(a.warehouseId) ?? 0;
          const stockB = workingStock.get(b.warehouseId) ?? 0;
          if (stockA !== stockB) {
            return stockB - stockA;
          }
          // 3. Lower priority number
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          // 4. Alphabetical warehouse code tie-breaker
          return a.warehouseCode.localeCompare(b.warehouseCode);
        });

        const chosen = fullFillCandidates[0];
        const currentAvail = workingStock.get(chosen.warehouseId) ?? 0;
        workingStock.set(chosen.warehouseId, currentAvail - unallocatedQuantity);

        items.push({
          quoteLineId: line.quoteLineId,
          productId: line.productId,
          warehouseId: chosen.warehouseId,
          warehouseCode: chosen.warehouseCode,
          allocatedQuantity: unallocatedQuantity,
          status: 'FULFILLED',
          shippingCost: chosen.baseShippingCost,
        });

        unallocatedQuantity = 0;
      } else {
        // STEP 3: Multi-Warehouse Split Allocation
        // Sort active candidates to minimize shipment fragmentation
        const splitCandidates = [...activeCandidates].sort((a, b) => {
          const stockA = workingStock.get(a.warehouseId) ?? 0;
          const stockB = workingStock.get(b.warehouseId) ?? 0;
          // 1. Higher available stock first to minimize shipment split count
          if (stockA !== stockB) {
            return stockB - stockA;
          }
          // 2. Lower shipping cost
          if (a.baseShippingCost !== b.baseShippingCost) {
            return a.baseShippingCost - b.baseShippingCost;
          }
          // 3. Lower priority number
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          // 4. Alphabetical tie-breaker
          return a.warehouseCode.localeCompare(b.warehouseCode);
        });

        for (const cand of splitCandidates) {
          if (unallocatedQuantity <= 0) break;
          const currentAvail = workingStock.get(cand.warehouseId) ?? 0;
          if (currentAvail <= 0) continue;

          const allocAmount = Math.min(unallocatedQuantity, currentAvail);
          workingStock.set(cand.warehouseId, currentAvail - allocAmount);
          unallocatedQuantity -= allocAmount;

          items.push({
            quoteLineId: line.quoteLineId,
            productId: line.productId,
            warehouseId: cand.warehouseId,
            warehouseCode: cand.warehouseCode,
            allocatedQuantity: allocAmount,
            status: 'FULFILLED',
            shippingCost: cand.baseShippingCost,
          });
        }

        // STEP 4: Backorder Allocation for Remaining Unfulfilled Quantity
        if (unallocatedQuantity > 0) {
          items.push({
            quoteLineId: line.quoteLineId,
            productId: line.productId,
            warehouseId: null,
            warehouseCode: null,
            allocatedQuantity: unallocatedQuantity,
            status: 'BACKORDERED',
            shippingCost: 0.0,
          });
        }
      }
    }

    // STEP 5: Aggregated Result Calculation
    // Find unique warehouses used across all fulfilled items
    const usedWarehouses = new Set<string>();
    let backorderCount = 0;

    for (const item of items) {
      if (item.status === 'BACKORDERED') {
        backorderCount += item.allocatedQuantity;
      } else if (item.warehouseId) {
        usedWarehouses.add(item.warehouseId);
      }
    }

    const totalShipments = usedWarehouses.size;

    // Shipping cost rule: count base shipping cost ONCE per unique warehouse used
    let totalFulfillmentCost = 0;
    for (const whId of usedWarehouses) {
      const meta = warehouseMeta.get(whId);
      if (meta) {
        totalFulfillmentCost += meta.baseShippingCost;
      }
    }

    // Update item-level shippingCost so item shipping cost is recorded accurately per shipment
    const countedWarehouseForShipping = new Set<string>();
    const finalItems = items.map((item) => {
      if (item.status === 'FULFILLED' && item.warehouseId) {
        if (!countedWarehouseForShipping.has(item.warehouseId)) {
          countedWarehouseForShipping.add(item.warehouseId);
          return item; // keeps baseShippingCost
        } else {
          // Already counted shipment cost for this warehouse in the plan
          return { ...item, shippingCost: 0.0 };
        }
      }
      return item;
    });

    const status: FulfillmentPlanStatus =
      backorderCount > 0 ? 'PARTIALLY_FULFILLED_BACKORDER' : 'ALLOCATED';

    return {
      items: finalItems,
      totalShipments,
      totalFulfillmentCost,
      backorderCount,
      status,
    };
  }
}

export const fulfillmentEngine = new FulfillmentEngine();
