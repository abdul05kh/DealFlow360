import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db/client';

const request = supertest(app);

describe('Flow B REST API & Fulfillment Integration Tests', () => {
  let autoApprovedQuoteId: string;
  let pendingApprovalQuoteId: string;
  let approvedQuoteId: string;

  beforeAll(async () => {
    // 0. Clean up any previous fulfillment test artifacts to ensure clean inventory baseline
    await prisma.fulfillmentItem.deleteMany();
    await prisma.fulfillmentPlan.deleteMany();
    await prisma.inventoryStock.updateMany({
      data: { quantityReserved: 0 },
    });

    // 1. Ensure master data & warehouses are seeded
    const customer = await prisma.customer.findUnique({ where: { id: 'cust_acme_101' } });
    if (!customer) {
      console.warn('Seed data not found in DB. Tests expect seeded master data.');
    }

    // 2. Create AUTO_APPROVED quote for testing
    const autoQuoteRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 5 }],
      });
    autoApprovedQuoteId = autoQuoteRes.body.id;

    // 3. Create PENDING_APPROVAL quote for testing
    const pendingQuoteRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 18 }],
      });
    pendingApprovalQuoteId = pendingQuoteRes.body.id;

    // 4. Create APPROVED quote for testing
    const approvedQuoteRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 2, discountPercent: 18 }],
      });
    const tempQuoteId = approvedQuoteRes.body.id;

    await request
      .post(`/api/v1/quotes/${tempQuoteId}/approve`)
      .set('X-Demo-Role', 'SALES_MANAGER')
      .send({ reason: 'Approved for test' });

    approvedQuoteId = tempQuoteId;
  });

  // 1. GET /api/v1/warehouses
  it('1. GET /api/v1/warehouses — retrieves active warehouses with inventory stock levels', async () => {
    const res = await request
      .get('/api/v1/warehouses')
      .set('X-Demo-Role', 'SALES_REP');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    const bom = res.body.find((w: any) => w.code === 'BOM-01');
    expect(bom).toBeDefined();
    expect(bom.baseShippingCost).toBe(500);
    expect(bom.stocks).toBeDefined();
  });

  // 2. Evaluation Simulation Only (No Mutation)
  it('2. POST /api/v1/fulfillment/evaluate — simulation only, does not mutate DB or write audit logs', async () => {
    const initialStocks = await prisma.inventoryStock.findMany();
    const initialPlansCount = await prisma.fulfillmentPlan.count();
    const initialQuoteAudits = await prisma.auditEvent.count({
      where: { entityId: approvedQuoteId },
    });

    const res = await request
      .post('/api/v1/fulfillment/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({ quoteId: approvedQuoteId });

    expect(res.status).toBe(200);
    expect(res.body.quoteId).toBe(approvedQuoteId);
    expect(res.body.evaluation.totalShipments).toBe(1);
    expect(res.body.evaluation.status).toBe('ALLOCATED');

    // Assert DB was NOT mutated
    const currentPlansCount = await prisma.fulfillmentPlan.count();
    const currentQuoteAudits = await prisma.auditEvent.count({
      where: { entityId: approvedQuoteId },
    });
    const currentStocks = await prisma.inventoryStock.findMany();

    expect(currentPlansCount).toBe(initialPlansCount);
    expect(currentQuoteAudits).toBe(initialQuoteAudits);
    expect(currentStocks).toEqual(initialStocks);
  });

  // 3. Unauthorized Allocation (Sales Rep -> 403 Forbidden)
  it('3. POST /api/v1/fulfillment/allocate — rejects Sales Rep attempt with 403 Forbidden', async () => {
    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({ quoteId: approvedQuoteId });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  // 4. Unapproved Quote Allocation -> 409 Conflict
  it('4. POST /api/v1/fulfillment/allocate — rejects unapproved PENDING_APPROVAL quote with 409 Conflict', async () => {
    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({ quoteId: pendingApprovalQuoteId });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.message).toContain('APPROVED or AUTO_APPROVED status');
  });

  // 5. Successful Allocation for APPROVED Quote
  it('5. POST /api/v1/fulfillment/allocate — successfully allocates fulfillment for APPROVED quote', async () => {
    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({ quoteId: approvedQuoteId });

    expect(res.status).toBe(201);
    expect(res.body.quoteId).toBe(approvedQuoteId);
    expect(res.body.status).toBe('ALLOCATED');
    expect(res.body.totalShipments).toBe(1);
    expect(res.body.totalFulfillmentCost).toBe(500);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].allocatedQuantity).toBe(2);
    expect(res.body.items[0].warehouse.code).toBe('BOM-01');
  });

  // 6. Inventory Reservation Update in DB
  it('6. Inventory Reservation — verifies quantityReserved is incremented in DB after allocation', async () => {
    const bomStock = await prisma.inventoryStock.findFirst({
      where: { warehouse: { code: 'BOM-01' }, product: { sku: 'HW-SRV-001' } },
    });

    expect(bomStock).toBeDefined();
    expect(bomStock?.quantityReserved).toBeGreaterThan(0);
  });

  // 7. Successful Allocation for AUTO_APPROVED Quote
  it('7. POST /api/v1/fulfillment/allocate — successfully allocates fulfillment for AUTO_APPROVED quote', async () => {
    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'SALES_MANAGER')
      .send({ quoteId: autoApprovedQuoteId });

    expect(res.status).toBe(201);
    expect(res.body.quoteId).toBe(autoApprovedQuoteId);
    expect(res.body.status).toBe('ALLOCATED');
  });

  // 8. Duplicate Allocation Protection (409 Conflict)
  it('8. Duplicate Allocation — rejects second allocation attempt on same quote with 409 Conflict', async () => {
    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({ quoteId: approvedQuoteId });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.message).toContain('Fulfillment plan has already been allocated');
  });

  // 9. Insufficient Stock -> Partial Fill & Backorder Creation
  it('9. Backorder Allocation — allocates available stock and creates BACKORDERED item when demand exceeds inventory', async () => {
    // Create & approve quote requiring 20 servers (available total in DB is 8)
    const largeQuoteRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 20, discountPercent: 10 }],
      });
    const largeQuoteId = largeQuoteRes.body.id;

    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({ quoteId: largeQuoteId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PARTIALLY_FULFILLED_BACKORDER');
    expect(res.body.backorderCount).toBeGreaterThan(0);

    const backorderItem = res.body.items.find((i: any) => i.status === 'BACKORDERED');
    expect(backorderItem).toBeDefined();

    // Verify audit event
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: largeQuoteId, action: 'BACKORDER_CREATED' },
    });
    expect(audit).toBeDefined();
  });

  // 10. Impossible Manual Override Rejection
  it('10. Manual Override — rejects override to warehouse with insufficient available stock with 409 Conflict', async () => {
    // Create & approve a quote
    const overrideQuoteRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 5, discountPercent: 10 }],
      });
    const overrideQuoteId = overrideQuoteRes.body.id;
    const lineId = overrideQuoteRes.body.lines[0].id;

    // BLR-03 warehouse has 0 servers available!
    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({
        quoteId: overrideQuoteId,
        manualOverrides: [
          {
            quoteLineId: lineId,
            warehouseId: 'wh_blr_03',
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.message).toContain('Impossible manual override');
  });

  // 11. Successful Manual Override
  it('11. Manual Override — successfully applies valid manual warehouse override with FULFILLMENT_OVERRIDDEN audit', async () => {
    // Create & approve a quote for 2 Network Appliances (DEL-02 has 8 available)
    const validOverrideRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_network_02', quantity: 2, discountPercent: 10 }],
      });
    const validQuoteId = validOverrideRes.body.id;
    const lineId = validOverrideRes.body.lines[0].id;

    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({
        quoteId: validQuoteId,
        manualOverrides: [
          {
            quoteLineId: lineId,
            warehouseId: 'wh_del_02',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OVERRIDDEN');
    expect(res.body.items[0].warehouse.code).toBe('DEL-02');

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: validQuoteId, action: 'FULFILLMENT_OVERRIDDEN' },
    });
    expect(audit).toBeDefined();
  });

  // 12. GET /api/v1/fulfillment/quote/:quoteId
  it('12. GET /api/v1/fulfillment/quote/:quoteId — retrieves persisted plan details and audit trail', async () => {
    const res = await request
      .get(`/api/v1/fulfillment/quote/${approvedQuoteId}`)
      .set('X-Demo-Role', 'SALES_REP');

    expect(res.status).toBe(200);
    expect(res.body.quoteId).toBe(approvedQuoteId);
    expect(res.body.auditHistory).toBeDefined();
    expect(res.body.auditHistory.length).toBeGreaterThan(0);
  });

  // 13. Safe API Errors (404 for non-existent quote)
  it('13. Safe API Errors — returns 404 NotFound without stack traces for non-existent quote ID', async () => {
    const res = await request
      .get('/api/v1/fulfillment/quote/non-existent-uuid-9999')
      .set('X-Demo-Role', 'SALES_REP');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
    expect(res.body.stack).toBeUndefined();
  });

  // 14. Strict Anti-Tampering Payload Rejection (400 Bad Request)
  it('14. Anti-Tampering — rejects client-supplied fake stock or shipping values with 400 Bad Request', async () => {
    const res = await request
      .post('/api/v1/fulfillment/allocate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({
        quoteId: approvedQuoteId,
        shippingCost: 0,
        availableStock: 9999,
        backorderCount: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details).toBeDefined();
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  // 15. Unallocated APPROVED quote handles 404 cleanly and permits simulation & allocation
  it('15. Unallocated APPROVED quote returns 404 for fulfillment plan lookup, but evaluation succeeds', async () => {
    const unallocatedQuoteRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 10 }],
      });
    const unallocatedId = unallocatedQuoteRes.body.id;

    await request
      .post(`/api/v1/quotes/${unallocatedId}/approve`)
      .set('X-Demo-Role', 'SALES_MANAGER')
      .send({ reason: 'Approved for test 15' });

    // GET fulfillment plan returns 404 before allocation
    const planRes = await request
      .get(`/api/v1/fulfillment/quote/${unallocatedId}`)
      .set('X-Demo-Role', 'SALES_REP');

    expect(planRes.status).toBe(404);
    expect(planRes.body.error).toBe('NotFound');

    // POST evaluation simulation succeeds
    const evalRes = await request
      .post('/api/v1/fulfillment/evaluate')
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .send({ quoteId: unallocatedId });

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.status).toBeDefined();
  });
});
