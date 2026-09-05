import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { config } from '../src/config/index';

const prisma = new PrismaClient();

describe('P0-4 Customer Negotiation Portal Integration & Security Tests', () => {
  let customerAToken: string;
  let customerBToken: string;
  let managerToken: string;
  let repToken: string;
  let adminToken: string;

  beforeEach(async () => {
    config.nodeEnv = 'test';

    // Customer A token (Acme Corp -> cust_acme_101)
    customerAToken = jwt.sign(
      { userId: 'cust_user_1', role: 'CUSTOMER', customerId: 'cust_acme_101' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Customer B token (Nova Retail -> cust_nova_102)
    customerBToken = jwt.sign(
      { userId: 'cust_user_2', role: 'CUSTOMER', customerId: 'cust_nova_102' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Sales Manager token
    managerToken = jwt.sign(
      { userId: 'mgr_1', role: 'SALES_MANAGER' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Sales Rep token
    repToken = jwt.sign(
      { userId: 'rep_1', role: 'SALES_REP' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Admin token
    adminToken = jwt.sign(
      { userId: 'admin_1', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  // 1. Tenant Isolation & 404 Prevention of ID Enumeration
  it('1. Enforces strict customer tenant isolation and returns 404 for unauthorized quote access', async () => {
    // Create a quote for Customer B (Nova Retail - cust_nova_102)
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_nova_102',
        items: [{ productId: 'prod_server_01', quantity: 2, discountPercent: 5 }],
      });
    expect(createRes.status).toBe(201);
    const novaQuoteId = createRes.body.id;

    // Customer A attempts GET for Nova Retail quote -> 404 Not Found
    const getRes = await request(app)
      .get(`/api/v1/customer/quotes/${novaQuoteId}`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(getRes.status).toBe(404);

    // Customer A attempts POST negotiation for Nova Retail quote -> 404 Not Found
    const negRes = await request(app)
      .post(`/api/v1/customer/quotes/${novaQuoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: createRes.body.lines[0].id, requestedDiscount: 10 }],
      });
    expect(negRes.status).toBe(404);
  });

  // 2. Strict Zod Payload Validation
  it('2. Rejects invalid negotiation payloads with 400 Bad Request', async () => {
    // Create quote for Customer A
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 5 }],
      });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;
    const lineId = createRes.body.lines[0].id;

    // A) Negative discount
    const negRes1 = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: lineId, requestedDiscount: -5 }],
      });
    expect(negRes1.status).toBe(400);

    // B) Discount > 100%
    const negRes2 = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: lineId, requestedDiscount: 150 }],
      });
    expect(negRes2.status).toBe(400);

    // C) Extra unexpected field (strict schema)
    const negRes3 = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: lineId, requestedDiscount: 10 }],
        unauthorizedPriceOverride: 10,
      });
    expect(negRes3.status).toBe(400);
  });

  // 3. Partial Line Negotiation & Partial Unchanged Line Terms Preservation
  it('3. Supports partial line negotiation while preserving unchanged line terms', async () => {
    // Create a 2-line quote for Customer A
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_acme_101',
        items: [
          { productId: 'prod_server_01', quantity: 1, discountPercent: 5 },
          { productId: 'prod_network_02', quantity: 2, discountPercent: 8 },
        ],
      });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;
    const line1Id = createRes.body.lines[0].id;
    const line2Id = createRes.body.lines[1].id;

    // Customer negotiates Line 1 ONLY (asks for 10%)
    const negRes = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        customerNote: 'Discount request for server line only',
        lines: [{ quoteLineId: line1Id, requestedDiscount: 10, customerNote: 'Need 10% on server' }],
      });

    expect(negRes.status).toBe(200);
    const dto = negRes.body;
    expect(dto.negotiationHistory).toHaveLength(1);
    const negLines = dto.negotiationHistory[0].lines;

    expect(negLines).toHaveLength(1);
    expect(negLines[0].quoteLineId).toBe(line1Id);
    expect(negLines[0].requestedDiscountPercent).toBe(10);

    // Verify quote in DB: Line 1 requestedDiscount set, Line 2 untouched
    const dbQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { lines: true },
    });
    const dbLine1 = dbQuote?.lines.find((l) => l.id === line1Id);
    const dbLine2 = dbQuote?.lines.find((l) => l.id === line2Id);

    expect(dbLine1?.discountPercent).toBe(10); // Accepted counter-offer discount applied
    expect(dbLine2?.discountPercent).toBe(8); // Untouched preserved original discount
  });

  // 4. Governance Thresholds & Counter-Offer State Transitions
  it('4. Re-evaluates counter-offers: auto-approves compliant offers and holds policy-violating offers for manager review', async () => {
    // Create quote for Customer A
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 2 }],
      });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;
    const lineId = createRes.body.lines[0].id;

    // Customer requests high discount (35%) exceeding Gold tier limit (15%)
    const highNegRes = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        customerNote: 'Aggressive project budget request',
        lines: [{ quoteLineId: lineId, requestedDiscount: 35 }],
      });

    expect(highNegRes.status).toBe(200);
    expect(highNegRes.body.status).toBe('PENDING_APPROVAL');
    expect(highNegRes.body.negotiationHistory[0].status).toBe('SUBMITTED');
  });

  // 5. Manager Response (Approval Flow) & Stale Approval Re-evaluation
  it('5. Manager approves counter-offer after server re-evaluation and applies commercial state', async () => {
    // Create quote for Customer A
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 5 }],
      });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;
    const lineId = createRes.body.lines[0].id;

    // Submit counter-offer requiring review (20% discount)
    const negRes = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: lineId, requestedDiscount: 20 }],
      });
    expect(negRes.status).toBe(200);
    const negId = negRes.body.negotiationHistory[0].id;

    // Manager approves negotiation
    const respondRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/negotiations/${negId}/respond`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        action: 'APPROVE',
        managerReason: 'Approved as strategic deal exception for Q4',
        customerResponseNote: 'Special manager discount approved!',
      });

    expect(respondRes.status).toBe(200);
    expect(respondRes.body.status).toBe('APPROVED');

    // Verify quote updated line terms
    const updatedLine = respondRes.body.lines.find((l: any) => l.id === lineId);
    expect(updatedLine.discountPercent).toBe(20);

    // Verify negotiation recorded as APPROVED
    const dbNeg = await prisma.quoteNegotiation.findUnique({ where: { id: negId } });
    expect(dbNeg?.status).toBe('APPROVED');
    expect(dbNeg?.managerReason).toBe('Approved as strategic deal exception for Q4');
    expect(dbNeg?.customerResponseNote).toBe('Special manager discount approved!');
  });

  // 6. Preservation of Original Quote State on Rejection
  it('6. Rejection of customer counter-offer preserves original quote offer without failing quote status', async () => {
    // Create quote for Customer A
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 5 }],
      });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;
    const originalNetRevenue = createRes.body.netRevenue;
    const lineId = createRes.body.lines[0].id;

    // Submit counter-offer
    const negRes = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: lineId, requestedDiscount: 25 }],
      });
    expect(negRes.status).toBe(200);
    const negId = negRes.body.negotiationHistory[0].id;

    // Manager rejects negotiation
    const respondRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/negotiations/${negId}/respond`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        action: 'REJECT',
        managerReason: 'Margin too low for hardware',
        customerResponseNote: 'Unfortunately we cannot offer 25%. Original quote remains valid.',
      });

    expect(respondRes.status).toBe(200);
    expect(respondRes.body.status).toBe('APPROVED'); // Quote remains APPROVED with original offer
    expect(respondRes.body.netRevenue).toBe(originalNetRevenue); // Original commercial offer preserved!

    const dbNeg = await prisma.quoteNegotiation.findUnique({ where: { id: negId } });
    expect(dbNeg?.status).toBe('REJECTED');
  });

  // 7. Zero Information Leakage Security Verification
  it('7. Ensures Customer DTO exposes ZERO cost, margin, MRI, risk, or manager internal reasoning', async () => {
    // Create quote & negotiation
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 5 }],
      });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;
    const lineId = createRes.body.lines[0].id;

    const negRes = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: lineId, requestedDiscount: 20 }],
      });
    expect(negRes.status).toBe(200);
    const negId = negRes.body.negotiationHistory[0].id;

    await request(app)
      .post(`/api/v1/quotes/${quoteId}/negotiations/${negId}/respond`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        action: 'APPROVE',
        managerReason: 'SECRET_INTERNAL_MARGIN_NOTE_123',
        customerResponseNote: 'SAFE_CUSTOMER_NOTE_456',
      });

    // Customer retrieves quote
    const custGetRes = await request(app)
      .get(`/api/v1/customer/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(custGetRes.status).toBe(200);
    const dto = custGetRes.body;

    // Verify presence of customer-safe fields
    expect(dto.id).toBe(quoteId);
    expect(dto.totalOfferedGross).toBeDefined();
    expect(dto.totalOfferedDiscount).toBeDefined();
    expect(dto.totalNetRevenue).toBeDefined();
    expect(dto.lines[0].productName).toBeDefined();
    expect(dto.negotiationHistory[0].customerResponseNote).toBe('SAFE_CUSTOMER_NOTE_456');

    // Verify ABSENCE of sensitive internal fields
    expect(dto.estimatedCost).toBeUndefined();
    expect(dto.grossMargin).toBeUndefined();
    expect(dto.marginPercentage).toBeUndefined();
    expect(dto.marginRealization).toBeUndefined();
    expect(dto.riskScore).toBeUndefined();
    expect(dto.riskLevel).toBeUndefined();
    expect(dto.riskReasonsJson).toBeUndefined();
    expect(dto.requiredApproverRole).toBeUndefined();
    expect(dto.lines[0].unitCost).toBeUndefined();
    expect(dto.lines[0].lineCost).toBeUndefined();
    expect(dto.lines[0].lineMargin).toBeUndefined();

    // Verify ABSENCE of secret manager internal reason in negotiation DTO
    expect(dto.negotiationHistory[0].managerReason).toBeUndefined();
    expect(JSON.stringify(dto)).not.toContain('SECRET_INTERNAL_MARGIN_NOTE_123');
  });

  // 8. ADMIN Role Response & Non-SUBMITTED Negotiation Rejection Test
  it('8. Allows ADMIN role to respond and rejects duplicate/non-SUBMITTED response with 400', async () => {
    // Create quote & negotiation
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: 'cust_acme_101',
        items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 5 }],
      });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;
    const lineId = createRes.body.lines[0].id;

    const negRes = await request(app)
      .post(`/api/v1/customer/quotes/${quoteId}/negotiate`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        lines: [{ quoteLineId: lineId, requestedDiscount: 20 }],
      });
    expect(negRes.status).toBe(200);
    const negId = negRes.body.negotiationHistory[0].id;

    // Verify operator requests queue returns the submitted request
    const queueResBefore = await request(app)
      .get('/api/v1/operator/customer-requests')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(queueResBefore.status).toBe(200);
    expect(queueResBefore.body.some((r: any) => r.id === negId)).toBe(true);

    // ADMIN responds to negotiation -> 200 OK
    const adminRespondRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/negotiations/${negId}/respond`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'APPROVE',
        managerReason: 'Admin override approval',
        customerResponseNote: 'Approved by Admin',
      });
    expect(adminRespondRes.status).toBe(200);

    // Attempt to respond AGAIN to the now APPROVED negotiation -> 400 Bad Request
    const duplicateRespondRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/negotiations/${negId}/respond`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        action: 'REJECT',
        managerReason: 'Stale attempt',
      });
    expect(duplicateRespondRes.status).toBe(400);

    // Verify operator requests queue no longer returns the completed request
    const queueResAfter = await request(app)
      .get('/api/v1/operator/customer-requests')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(queueResAfter.status).toBe(200);
    expect(queueResAfter.body.some((r: any) => r.id === negId)).toBe(false);
  });
});
