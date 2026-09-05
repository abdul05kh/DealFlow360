import { describe, expect, it } from 'vitest';
import { fulfillmentEngine } from '../src/domain/fulfillment/fulfillmentEngine';
import { DomainValidationError, FulfillmentCandidateWarehouse, FulfillmentLineInput } from '../src/domain/types';

describe('Flow B — Pure Fulfillment Allocation Engine Unit Tests', () => {
  // Helper test candidate inventory
  const mockInventory: FulfillmentCandidateWarehouse[] = [
    {
      warehouseId: 'wh_bom_01',
      warehouseCode: 'BOM-01',
      warehouseName: 'Mumbai Central Hub',
      productId: 'prod_server_01',
      availableQuantity: 5,
      baseShippingCost: 500.0,
      priority: 1,
    },
    {
      warehouseId: 'wh_del_02',
      warehouseCode: 'DEL-02',
      warehouseName: 'Delhi North Hub',
      productId: 'prod_server_01',
      availableQuantity: 3,
      baseShippingCost: 750.0,
      priority: 2,
    },
    {
      warehouseId: 'wh_blr_03',
      warehouseCode: 'BLR-03',
      warehouseName: 'Bengaluru Tech Depot',
      productId: 'prod_server_01',
      availableQuantity: 0,
      baseShippingCost: 600.0,
      priority: 3,
    },
  ];

  it('1. Single warehouse full fulfillment — allocates 100% to single best warehouse with 1 shipment & 0 backorder', () => {
    const lines: FulfillmentLineInput[] = [
      {
        quoteLineId: 'line_1',
        productId: 'prod_server_01',
        requestedQuantity: 4,
      },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, mockInventory);

    expect(result.status).toBe('ALLOCATED');
    expect(result.totalShipments).toBe(1);
    expect(result.totalFulfillmentCost).toBe(500.0);
    expect(result.backorderCount).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      quoteLineId: 'line_1',
      productId: 'prod_server_01',
      warehouseId: 'wh_bom_01',
      warehouseCode: 'BOM-01',
      allocatedQuantity: 4,
      status: 'FULFILLED',
      shippingCost: 500.0,
    });
  });

  it('2. Multi-warehouse split fulfillment — splits across 2 warehouses when no single warehouse has enough', () => {
    const lines: FulfillmentLineInput[] = [
      {
        quoteLineId: 'line_1',
        productId: 'prod_server_01',
        requestedQuantity: 7,
      },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, mockInventory);

    expect(result.status).toBe('ALLOCATED');
    expect(result.totalShipments).toBe(2);
    expect(result.totalFulfillmentCost).toBe(1250.0); // 500 + 750
    expect(result.backorderCount).toBe(0);
    expect(result.items).toHaveLength(2);

    expect(result.items[0]).toEqual({
      quoteLineId: 'line_1',
      productId: 'prod_server_01',
      warehouseId: 'wh_bom_01',
      warehouseCode: 'BOM-01',
      allocatedQuantity: 5,
      status: 'FULFILLED',
      shippingCost: 500.0,
    });

    expect(result.items[1]).toEqual({
      quoteLineId: 'line_1',
      productId: 'prod_server_01',
      warehouseId: 'wh_del_02',
      warehouseCode: 'DEL-02',
      allocatedQuantity: 2,
      status: 'FULFILLED',
      shippingCost: 750.0,
    });
  });

  it('3. Backorder — allocates all available stock and assigns remaining unfulfilled quantity to backorder', () => {
    const lines: FulfillmentLineInput[] = [
      {
        quoteLineId: 'line_1',
        productId: 'prod_server_01',
        requestedQuantity: 10,
      },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, mockInventory);

    expect(result.status).toBe('PARTIALLY_FULFILLED_BACKORDER');
    expect(result.totalShipments).toBe(2);
    expect(result.totalFulfillmentCost).toBe(1250.0);
    expect(result.backorderCount).toBe(2);
    expect(result.items).toHaveLength(3);

    // BOM-01 (5), DEL-02 (3), BACKORDERED (2)
    const backorderItem = result.items.find((i) => i.status === 'BACKORDERED');
    expect(backorderItem).toBeDefined();
    expect(backorderItem?.allocatedQuantity).toBe(2);
    expect(backorderItem?.warehouseId).toBeNull();
    expect(backorderItem?.warehouseCode).toBeNull();
    expect(backorderItem?.shippingCost).toBe(0.0);
  });

  it('4. Zero inventory — creates 100% backorder when candidate warehouses have zero stock', () => {
    const zeroStockInventory: FulfillmentCandidateWarehouse[] = [
      {
        warehouseId: 'wh_bom_01',
        warehouseCode: 'BOM-01',
        warehouseName: 'Mumbai Central Hub',
        productId: 'prod_server_01',
        availableQuantity: 0,
        baseShippingCost: 500.0,
        priority: 1,
      },
    ];

    const lines: FulfillmentLineInput[] = [
      {
        quoteLineId: 'line_1',
        productId: 'prod_server_01',
        requestedQuantity: 5,
      },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, zeroStockInventory);

    expect(result.status).toBe('PARTIALLY_FULFILLED_BACKORDER');
    expect(result.totalShipments).toBe(0);
    expect(result.totalFulfillmentCost).toBe(0.0);
    expect(result.backorderCount).toBe(5);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      quoteLineId: 'line_1',
      productId: 'prod_server_01',
      warehouseId: null,
      warehouseCode: null,
      allocatedQuantity: 5,
      status: 'BACKORDERED',
      shippingCost: 0.0,
    });
  });

  it('5. Shipping cost aggregation — counts base shipping cost ONCE per unique warehouse used', () => {
    const multiProductInventory: FulfillmentCandidateWarehouse[] = [
      {
        warehouseId: 'wh_bom_01',
        warehouseCode: 'BOM-01',
        warehouseName: 'Mumbai Hub',
        productId: 'prod_server_01',
        availableQuantity: 10,
        baseShippingCost: 500.0,
        priority: 1,
      },
      {
        warehouseId: 'wh_bom_01',
        warehouseCode: 'BOM-01',
        warehouseName: 'Mumbai Hub',
        productId: 'prod_network_02',
        availableQuantity: 10,
        baseShippingCost: 500.0,
        priority: 1,
      },
    ];

    const lines: FulfillmentLineInput[] = [
      { quoteLineId: 'line_1', productId: 'prod_server_01', requestedQuantity: 2 },
      { quoteLineId: 'line_2', productId: 'prod_network_02', requestedQuantity: 3 },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, multiProductInventory);

    expect(result.totalShipments).toBe(1);
    expect(result.totalFulfillmentCost).toBe(500.0); // Base cost counted once!
    expect(result.backorderCount).toBe(0);
  });

  it('6. Multiple warehouses shipment count — calculates correct total shipments and combined cost', () => {
    const multiWhInventory: FulfillmentCandidateWarehouse[] = [
      {
        warehouseId: 'wh_bom_01',
        warehouseCode: 'BOM-01',
        warehouseName: 'Mumbai Hub',
        productId: 'prod_server_01',
        availableQuantity: 10,
        baseShippingCost: 500.0,
        priority: 1,
      },
      {
        warehouseId: 'wh_del_02',
        warehouseCode: 'DEL-02',
        warehouseName: 'Delhi Hub',
        productId: 'prod_network_02',
        availableQuantity: 10,
        baseShippingCost: 750.0,
        priority: 2,
      },
    ];

    const lines: FulfillmentLineInput[] = [
      { quoteLineId: 'line_1', productId: 'prod_server_01', requestedQuantity: 2 },
      { quoteLineId: 'line_2', productId: 'prod_network_02', requestedQuantity: 3 },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, multiWhInventory);

    expect(result.totalShipments).toBe(2);
    expect(result.totalFulfillmentCost).toBe(1250.0); // 500 + 750
  });

  it('7. Determinism — 10 consecutive executions produce identical outputs', () => {
    const lines: FulfillmentLineInput[] = [
      { quoteLineId: 'line_1', productId: 'prod_server_01', requestedQuantity: 7 },
    ];

    const firstRun = fulfillmentEngine.evaluateFulfillment(lines, mockInventory);
    for (let i = 0; i < 10; i++) {
      const run = fulfillmentEngine.evaluateFulfillment(lines, mockInventory);
      expect(run).toEqual(firstRun);
    }
  });

  it('8. No negative quantities — allocatedQuantity and backorderCount are non-negative', () => {
    const lines: FulfillmentLineInput[] = [
      { quoteLineId: 'line_1', productId: 'prod_server_01', requestedQuantity: 15 },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, mockInventory);

    expect(result.backorderCount).toBeGreaterThanOrEqual(0);
    for (const item of result.items) {
      expect(item.allocatedQuantity).toBeGreaterThan(0);
    }
  });

  it('9. Reserved inventory — correctly uses availableQuantity = onHand - reserved', () => {
    // Inventory where onHand=10 but reserved=8 -> available=2
    const inventoryWithReserved: FulfillmentCandidateWarehouse[] = [
      {
        warehouseId: 'wh_bom_01',
        warehouseCode: 'BOM-01',
        warehouseName: 'Mumbai Hub',
        productId: 'prod_server_01',
        availableQuantity: 2, // 10 on hand - 8 reserved
        baseShippingCost: 500.0,
        priority: 1,
      },
    ];

    const lines: FulfillmentLineInput[] = [
      { quoteLineId: 'line_1', productId: 'prod_server_01', requestedQuantity: 5 },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, inventoryWithReserved);

    expect(result.items[0].allocatedQuantity).toBe(2);
    expect(result.backorderCount).toBe(3);
  });

  it('10. Warehouse ranking tie-breakers — breaks ties deterministically based on priority and code', () => {
    const tiedInventory: FulfillmentCandidateWarehouse[] = [
      {
        warehouseId: 'wh_b',
        warehouseCode: 'WH-B',
        warehouseName: 'Warehouse B',
        productId: 'prod_server_01',
        availableQuantity: 10,
        baseShippingCost: 500.0,
        priority: 2,
      },
      {
        warehouseId: 'wh_a',
        warehouseCode: 'WH-A',
        warehouseName: 'Warehouse A',
        productId: 'prod_server_01',
        availableQuantity: 10,
        baseShippingCost: 500.0,
        priority: 1, // Lower priority number preferred
      },
    ];

    const lines: FulfillmentLineInput[] = [
      { quoteLineId: 'line_1', productId: 'prod_server_01', requestedQuantity: 5 },
    ];

    const result = fulfillmentEngine.evaluateFulfillment(lines, tiedInventory);

    expect(result.items[0].warehouseCode).toBe('WH-A');
  });

  it('11. Multiple quote lines for same product — tracks stock sequentially across lines', () => {
    const lines: FulfillmentLineInput[] = [
      { quoteLineId: 'line_1', productId: 'prod_server_01', requestedQuantity: 3 },
      { quoteLineId: 'line_2', productId: 'prod_server_01', requestedQuantity: 4 },
    ];

    // Total initial BOM-01 available = 5, DEL-02 available = 3
    const result = fulfillmentEngine.evaluateFulfillment(lines, mockInventory);

    // Line 1 gets 3 from BOM-01 (remaining BOM-01 available = 2)
    expect(result.items[0].quoteLineId).toBe('line_1');
    expect(result.items[0].warehouseCode).toBe('BOM-01');
    expect(result.items[0].allocatedQuantity).toBe(3);

    // Line 2 needs 4 units. Remaining stock: DEL-02 (3), BOM-01 (2).
    // Greedy split takes larger pool DEL-02 (3) first, then BOM-01 (1).
    const line2Allocations = result.items.filter((i) => i.quoteLineId === 'line_2');
    expect(line2Allocations).toHaveLength(2);
    expect(line2Allocations[0].warehouseCode).toBe('DEL-02');
    expect(line2Allocations[0].allocatedQuantity).toBe(3);
    expect(line2Allocations[1].warehouseCode).toBe('BOM-01');
    expect(line2Allocations[1].allocatedQuantity).toBe(1);
  });

  it('12. Invalid demand — throws DomainValidationError on non-positive or missing requested quantity', () => {
    expect(() =>
      fulfillmentEngine.evaluateFulfillment(
        [{ quoteLineId: 'l1', productId: 'p1', requestedQuantity: 0 }],
        mockInventory
      )
    ).toThrow(DomainValidationError);

    expect(() =>
      fulfillmentEngine.evaluateFulfillment(
        [{ quoteLineId: 'l1', productId: 'p1', requestedQuantity: -5 }],
        mockInventory
      )
    ).toThrow(DomainValidationError);

    expect(() =>
      fulfillmentEngine.evaluateFulfillment([], mockInventory)
    ).toThrow(DomainValidationError);
  });
});
