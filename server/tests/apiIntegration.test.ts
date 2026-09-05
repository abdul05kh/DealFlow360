import supertest from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db/client';

const request = supertest(app);

describe('Flow A REST API & Anti-Tampering Integration Tests', () => {
  beforeAll(async () => {
    // Ensure DB is initialized with seed data if needed
    const customer = await prisma.customer.findUnique({ where: { id: 'cust_acme_101' } });
    if (!customer) {
      console.warn('Seed data not found in DB. Tests expect seeded master data.');
    }
  });

  // 1. Valid Quote Evaluation
  it('1. POST /api/v1/quotes/evaluate - evaluates valid quote terms successfully', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .set('X-Demo-User-Id', 'rep_1')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 10,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.customer.id).toBe('cust_acme_101');
    expect(res.body.financials.grossRevenue).toBe(150000);
    expect(res.body.financials.netRevenue).toBe(135000);
    expect(res.body.financials.marginPercentage).toBe(33.33);
    expect(res.body.risk.riskLevel).toBe('LOW');
    expect(res.body.decision.quoteStatus).toBe('AUTO_APPROVED');
  });

  // 2. Malformed Request
  it('2. POST /api/v1/quotes/evaluate - rejects malformed payload (empty items)', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  // 3. Unknown Customer ID
  it('3. POST /api/v1/quotes/evaluate - returns 404 for unknown customerId', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_unknown_999',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 10,
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFoundError');
  });

  // 4. Unknown Product ID
  it('4. POST /api/v1/quotes/evaluate - returns 404 for unknown productId', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_nonexistent_999',
            quantity: 1,
            discountPercent: 10,
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFoundError');
  });

  // 5. Invalid Quantity
  it('5. POST /api/v1/quotes/evaluate - rejects non-positive or non-integer quantity', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: -5,
            discountPercent: 10,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  // 6. Invalid Discount Percentage
  it('6. POST /api/v1/quotes/evaluate - rejects discount percentage > 100 or < 0', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 150,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  // 7. Valid Quote Creation
  it('7. POST /api/v1/quotes - creates and persists a new quote returning 201 Created', async () => {
    const res = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .set('X-Demo-User-Id', 'rep_1')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 20, // > 15.0% Gold Tier ceiling -> PENDING_APPROVAL
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('PENDING_APPROVAL');
    expect(res.body.lines.length).toBe(1);
  });

  // 8. Manager Approval
  it('8. POST /api/v1/quotes/:id/approve - allows SALES_MANAGER to approve a pending quote', async () => {
    // First create a pending quote
    const createRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 20 }],
      });

    const quoteId = createRes.body.id;

    // Approve as SALES_MANAGER
    const approveRes = await request
      .post(`/api/v1/quotes/${quoteId}/approve`)
      .set('X-Demo-Role', 'SALES_MANAGER')
      .set('X-Demo-User-Id', 'mgr_1')
      .send({ reason: 'Approved special enterprise discount.' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('APPROVED');
  });

  // 9. Manager Rejection
  it('9. POST /api/v1/quotes/:id/reject - allows SALES_MANAGER to reject a pending quote', async () => {
    const createRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 25 }],
      });

    const quoteId = createRes.body.id;

    const rejectRes = await request
      .post(`/api/v1/quotes/${quoteId}/reject`)
      .set('X-Demo-Role', 'SALES_MANAGER')
      .set('X-Demo-User-Id', 'mgr_1')
      .send({ reason: 'Discount is unacceptably high.' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('REJECTED');
  });

  // 10. Unauthorized Approval Attempt by Sales Rep
  it('10. POST /api/v1/quotes/:id/approve - denies approval attempt by SALES_REP returning 403 Forbidden', async () => {
    const createRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 20 }],
      });

    const quoteId = createRes.body.id;

    const res = await request
      .post(`/api/v1/quotes/${quoteId}/approve`)
      .set('X-Demo-Role', 'SALES_REP') // Unauthorized role!
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  // 11. Unauthorized Rejection Attempt by Sales Rep
  it('11. POST /api/v1/quotes/:id/reject - denies rejection attempt by SALES_REP returning 403 Forbidden', async () => {
    const createRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 20 }],
      });

    const quoteId = createRes.body.id;

    const res = await request
      .post(`/api/v1/quotes/${quoteId}/reject`)
      .set('X-Demo-Role', 'SALES_REP') // Unauthorized role!
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  // 12. Invalid State Transition Attempt
  it('12. POST /api/v1/quotes/:id/approve - rejects illegal approval transition on already APPROVED quote (409 Conflict)', async () => {
    const createRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 20 }],
      });

    const quoteId = createRes.body.id;

    // Approve once
    await request
      .post(`/api/v1/quotes/${quoteId}/approve`)
      .set('X-Demo-Role', 'SALES_MANAGER')
      .send({});

    // Attempt to approve second time -> 409 Conflict
    const res = await request
      .post(`/api/v1/quotes/${quoteId}/approve`)
      .set('X-Demo-Role', 'SALES_MANAGER')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  // 13. Audit Event Persistence Check
  it('13. verifies that quote creation and approval generate immutable AuditEvent records', async () => {
    const createRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 20 }],
      });

    const quoteId = createRes.body.id;

    await request
      .post(`/api/v1/quotes/${quoteId}/approve`)
      .set('X-Demo-Role', 'SALES_MANAGER')
      .send({});

    const auditEvents = await prisma.auditEvent.findMany({
      where: { entityType: 'QUOTE', entityId: quoteId },
      orderBy: { createdAt: 'asc' },
    });

    expect(auditEvents.length).toBeGreaterThanOrEqual(2);
    expect(auditEvents[0].action).toBe('QUOTE_CREATED');
    expect(auditEvents[1].action).toBe('QUOTE_APPROVED');
  });

  // 14. Anti-Tampering: Financial Field Injection
  it('14. Anti-Tampering: rejects payload with injected unitPrice / unitCost fields (400 Bad Request)', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 10,
            unitPrice: 1.0, // Injected malicious field!
            unitCost: 1.0,  // Injected malicious field!
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details[0].message).toContain('Unexpected payload fields detected');
  });

  // 15. Anti-Tampering: Governance & Risk Field Injection
  it('15. Anti-Tampering: rejects payload with injected riskScore / approvalStatus fields (400 Bad Request)', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 10,
          },
        ],
        riskScore: 0,             // Injected malicious field!
        riskLevel: 'LOW',         // Injected malicious field!
        approvalStatus: 'APPROVED',// Injected malicious field!
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details[0].message).toContain('Unexpected payload fields detected');
  });

  // 16. Anti-Tampering: Body Role/User Injection
  it('16. Anti-Tampering: rejects body payload attempting to inject role or userId claims', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 10,
          },
        ],
        role: 'SALES_MANAGER', // Injected role attempt in body!
        userId: 'admin_root',  // Injected user attempt in body!
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  // 17. Anti-Tampering: Authoritative Recalculation Enforced
  it('17. Anti-Tampering: server enforces authoritative customer Gold Tier ceiling (15%) regardless of client claims', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 18, // Exceeds Gold Tier 15% limit
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.governance.requiresApproval).toBe(true);
    expect(res.body.risk.riskLevel).toBe('HIGH');
    expect(res.body.decision.quoteStatus).toBe('PENDING_APPROVAL');
  });

  // 18. Safe Error Response Check
  it('18. Security: returns safe JSON error message without exposing stack traces or Prisma internals', async () => {
    const res = await request
      .post('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_invalid_id_format',
        items: [
          {
            productId: 'prod_server_01',
            quantity: 1,
            discountPercent: 10,
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFoundError');
    expect(res.body.message).toBeDefined();
    expect(res.body.stack).toBeUndefined(); // Stack trace never exposed!
  });

  // 19. GET /api/v1/quotes/:id - Fetch Quote Details & Audit History
  it('19. GET /api/v1/quotes/:id - fetches existing quote with lines and audit history', async () => {
    const createRes = await request
      .post('/api/v1/quotes')
      .set('X-Demo-Role', 'SALES_REP')
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 10 }],
      });

    const quoteId = createRes.body.id;

    const getRes = await request
      .get(`/api/v1/quotes/${quoteId}`)
      .set('X-Demo-Role', 'SALES_REP');

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(quoteId);
    expect(getRes.body.auditHistory.length).toBeGreaterThanOrEqual(1);
  });

  // 20. GET /api/v1/customers - Read-only master data active customers
  it('20. GET /api/v1/customers - returns list of active customers with tier information', async () => {
    const res = await request
      .get('/api/v1/customers')
      .set('X-Demo-Role', 'SALES_REP');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0].tier).toBeDefined();
    expect(res.body[0].tier.maxOverallDiscount).toBeDefined();
  });

  // 21. GET /api/v1/products - Read-only master data active catalog products
  it('21. GET /api/v1/products - returns list of active catalog products with selling and cost prices', async () => {
    const res = await request
      .get('/api/v1/products')
      .set('X-Demo-Role', 'SALES_REP');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(6);
    expect(res.body[0].sellingPrice).toBeDefined();
    expect(res.body[0].costPrice).toBeDefined();
    expect(res.body[0].category.maxCategoryDiscount).toBeDefined();
  });

  // 22. Anti-Tampering: Rejects write methods on master data endpoints
  it('22. Anti-Tampering: rejects POST write attempt on /api/v1/customers (404 Not Found)', async () => {
    const res = await request
      .post('/api/v1/customers')
      .set('X-Demo-Role', 'SALES_REP')
      .send({ name: 'Fake Malicious Customer' });

    expect(res.status).toBe(404);
  });
});
