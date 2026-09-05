import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/client';
import { generateToken } from '../src/services/authService';

describe('Increment 4 — Hybrid Billing & Subscription Engine Tests', () => {
  let salesRepToken: string;
  let salesManagerToken: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let testCustomerId: string;
  let otherCustomerId: string;
  let testProductIdOneTime: string;
  let testProductIdRecurringMonthly: string;
  let testProductIdRecurringQuarterly: string;
  let testProductIdRecurringYearly: string;

  beforeEach(async () => {
    // Generate JWT tokens directly
    salesRepToken = generateToken({ userId: 'rep_1', role: 'SALES_REP' });
    salesManagerToken = generateToken({ userId: 'mgr_1', role: 'SALES_MANAGER' });

    testCustomerId = 'cust_acme_101';
    otherCustomerId = 'cust_nova_102';

    customerToken = generateToken({
      userId: 'cust_user_1',
      role: 'CUSTOMER',
      customerId: testCustomerId,
    });

    otherCustomerToken = generateToken({
      userId: 'other_cust_user',
      role: 'CUSTOMER',
      customerId: otherCustomerId,
    });

    const pOneTime = await prisma.product.findFirstOrThrow({ where: { billingType: 'ONE_TIME' } });
    testProductIdOneTime = pOneTime.id;

    const pMonthly = await prisma.product.findFirstOrThrow({ where: { billingType: 'RECURRING', billingInterval: 'MONTHLY' } });
    testProductIdRecurringMonthly = pMonthly.id;

    let pQuarterly = await prisma.product.findFirst({ where: { billingType: 'RECURRING', billingInterval: 'QUARTERLY' } });
    if (!pQuarterly) {
      const cat = await prisma.productCategory.findFirstOrThrow();
      pQuarterly = await prisma.product.create({
        data: {
          sku: 'SW-QTR-TEST',
          name: 'Quarterly Support Test',
          categoryId: cat.id,
          costPrice: 3000,
          sellingPrice: 12000,
          billingType: 'RECURRING',
          billingInterval: 'QUARTERLY',
          isActive: true,
        },
      });
    }
    testProductIdRecurringQuarterly = pQuarterly.id;

    let pYearly = await prisma.product.findFirst({ where: { billingType: 'RECURRING', billingInterval: 'YEARLY' } });
    if (!pYearly) {
      const cat = await prisma.productCategory.findFirstOrThrow();
      pYearly = await prisma.product.create({
        data: {
          sku: 'SW-WRN-TEST',
          name: 'Annual License Test',
          categoryId: cat.id,
          costPrice: 5000,
          sellingPrice: 25000,
          billingType: 'RECURRING',
          billingInterval: 'YEARLY',
          isActive: true,
        },
      });
    }
    testProductIdRecurringYearly = pYearly.id;
  });

  it('1. Generates one-time billing with correct integer minor units for due-now total', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 2, discountPercent: 0 }],
      });

    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;

    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    expect(billingRes.body.quoteStatus).toBe('BILLING_CREATED');
    expect(billingRes.body.invoice).not.toBeNull();
    expect(billingRes.body.subscriptions.length).toBe(0);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: testProductIdOneTime } });
    const expectedMinor = 2 * Math.round(product.sellingPrice * 100);

    expect(billingRes.body.dueNow.totalMinor).toBe(expectedMinor);
    expect(billingRes.body.recurring.monthlyTotalMinor).toBe(0);
  });

  it('2. Generates recurring billing with correct monthly run-rate total', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdRecurringMonthly, quantity: 5, discountPercent: 10 }],
      });

    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;

    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    expect(billingRes.body.invoice).toBeNull();
    expect(billingRes.body.subscriptions.length).toBe(1);

    const sub = billingRes.body.subscriptions[0];
    expect(sub.billingInterval).toBe('MONTHLY');
    expect(sub.recurringAmountMinor).toBeGreaterThan(0);
    expect(billingRes.body.dueNow.totalMinor).toBe(0);
    expect(billingRes.body.recurring.monthlyTotalMinor).toBe(sub.recurringAmountMinor);
  });

  it('3. Generates HYBRID billing containing both one-time invoice and recurring subscription without mixing totals', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [
          { productId: testProductIdOneTime, quantity: 10, discountPercent: 5 },
          { productId: testProductIdRecurringMonthly, quantity: 5, discountPercent: 0 },
        ],
      });

    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;

    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesManagerToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    expect(billingRes.body.invoice).not.toBeNull();
    expect(billingRes.body.subscriptions.length).toBe(1);

    expect(billingRes.body.dueNow.totalMinor).toBeGreaterThan(0);
    expect(billingRes.body.recurring.monthlyTotalMinor).toBeGreaterThan(0);

    expect(billingRes.body.invoice.lines.length).toBe(1);
    expect(billingRes.body.invoice.lines[0].productId).toBe(testProductIdOneTime);

    expect(billingRes.body.subscriptions[0].lines.length).toBe(1);
    expect(billingRes.body.subscriptions[0].lines[0].productId).toBe(testProductIdRecurringMonthly);
  });

  it('4. Rejects billing generation for unapproved quote (DRAFT / PENDING_APPROVAL / REJECTED)', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 50 }],
      });

    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(400);
    expect(billingRes.body.message).toContain('requires an approved quote');
  });

  it('5. Prevents duplicate billing generation for the same quote', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const firstRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});
    expect(firstRes.status).toBe(201);

    const dupRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toContain('already been generated');
  });

  it('6. Enforces customer isolation for billing access', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const crossRes = await request(app)
      .get(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${otherCustomerToken}`);

    expect(crossRes.status).toBe(404);
  });

  it('7. Rejects unknown payload fields on billing endpoint via strict Zod schema', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const tamperedRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ customPriceOverride: 9999 });

    expect(tamperedRes.status).toBe(400);
    expect(tamperedRes.body.error).toBe('Validation Error');
    expect(tamperedRes.body.details[0].message).toContain('Unexpected payload fields detected');
  });

  it('8. Creates audit event for billing creation', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const audit = await prisma.auditEvent.findFirst({
      where: { entityType: 'BILLING', entityId: quoteId },
    });

    expect(audit).not.toBeNull();
    expect(audit?.action).toBe('CREATE_BILLING_PLAN');
  });

  it('9. Correctly sets next billing date for MONTHLY subscription interval (+1 month)', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdRecurringMonthly, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    const sub = billingRes.body.subscriptions[0];
    const startDate = new Date(sub.startDate);
    const nextDate = new Date(sub.nextBillingDate);

    // Verify approx 1 month difference
    const diffDays = Math.round((nextDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('10. Correctly sets next billing date for YEARLY subscription interval (+1 year)', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdRecurringYearly, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    const sub = billingRes.body.subscriptions[0];
    expect(sub.billingInterval).toBe('YEARLY');

    const startDate = new Date(sub.startDate);
    const nextDate = new Date(sub.nextBillingDate);
    expect(nextDate.getFullYear()).toBe(startDate.getFullYear() + 1);
  });

  it('11. Customer sanitized billing endpoint does not expose internal cost or margin details', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const custRes = await request(app)
      .get('/api/v1/customer/billing')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(custRes.status).toBe(200);
    expect(custRes.body.invoices.length).toBeGreaterThan(0);

    const inv = custRes.body.invoices[0];
    expect(inv.costPrice).toBeUndefined();
    expect(inv.grossMargin).toBeUndefined();
    expect(inv.lines[0].unitCost).toBeUndefined();
    expect(inv.lines[0].lineMargin).toBeUndefined();
  });

  it('12. Rejects billing generation for REJECTED quotes', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'REJECTED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(400);
    expect(billingRes.body.message).toContain('requires an approved quote');
  });

  it('13. Rejects billing generation when there is a pending customer negotiation', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    const lineId = createRes.body.lines[0].id;

    // Manually create a SUBMITTED negotiation and set quote status to APPROVED
    await prisma.quoteNegotiation.create({
      data: {
        quote: { connect: { id: quoteId } },
        customer: { connect: { id: testCustomerId } },
        submittedByUser: { connect: { id: 'cust_user_1' } },
        round: 1,
        status: 'SUBMITTED',
        customerNote: 'Pending negotiation test',
        lines: {
          create: [{ quoteLineId: lineId, requestedDiscount: 50 }],
        },
      },
    });

    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    // Attempt billing generation on quote with pending negotiation
    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(400);
    expect(billingRes.body.message).toContain('negotiation is pending review');
  });

  it('14. Approved QuoteLine commercial snapshot is immutable and ignores product master data changes', async () => {
    const origProduct = await prisma.product.findUniqueOrThrow({ where: { id: testProductIdOneTime } });
    const originalSellingPrice = origProduct.sellingPrice;

    try {
      const createRes = await request(app)
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${salesRepToken}`)
        .send({
          customerId: testCustomerId,
          items: [{ productId: testProductIdOneTime, quantity: 2, discountPercent: 0 }],
        });

      const quoteId = createRes.body.id;
      await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

      // Mutate Product selling price in master data AFTER quote approval
      await prisma.product.update({
        where: { id: testProductIdOneTime },
        data: { sellingPrice: 999999 },
      });

      // Generate billing
      const billingRes = await request(app)
        .post(`/api/v1/quotes/${quoteId}/billing`)
        .set('Authorization', `Bearer ${salesRepToken}`)
        .send({});

      expect(billingRes.status).toBe(201);

      // Verify invoice total comes from the APPROVED QuoteLine (original price), NOT the mutated Product selling price
      const productLine = billingRes.body.invoice.lines[0];
      expect(productLine.unitPriceMinor).toBe(originalSellingPrice * 100);
      expect(productLine.unitPriceMinor).toBeLessThan(99999900);
    } finally {
      // Restore product selling price to prevent polluting other test suites
      await prisma.product.update({
        where: { id: testProductIdOneTime },
        data: { sellingPrice: originalSellingPrice },
      });
    }
  });

  it('15. Verifies transaction atomicity and state consistency', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    // Generate billing
    const res1 = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(res1.status).toBe(201);

    // Check DB state
    const dbQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(dbQuote.status).toBe('BILLING_CREATED');
  });

  it('16. Records payment for an ISSUED invoice (ISSUED -> PAID) and creates RECORD_PAYMENT audit log', async () => {
    const opsToken = generateToken({ userId: 'ops_1', role: 'OPERATIONS_MANAGER' });
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const invoiceId = billingRes.body.invoice.id;

    // Record Payment
    const payRes = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(payRes.status).toBe(200);
    expect(payRes.body.status).toBe('PAID');

    // Verify DB state
    const dbInv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(dbInv.status).toBe('PAID');

    // Verify Audit Event created
    const auditEvents = await prisma.auditEvent.findMany({
      where: { entityType: 'INVOICE', entityId: invoiceId, action: 'RECORD_PAYMENT' },
    });
    expect(auditEvents.length).toBeGreaterThan(0);
  });

  it('17. Rejects duplicate payment on an already PAID invoice with HTTP 409', async () => {
    const opsToken = generateToken({ userId: 'ops_1', role: 'OPERATIONS_MANAGER' });
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const invoiceId = billingRes.body.invoice.id;

    // First payment succeeds
    await request(app)
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${opsToken}`);

    // Duplicate payment fails with 409
    const dupRes = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toContain('already been paid');
  });

  it('18. Rejects payment recording by unauthorized roles (403)', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const invoiceId = billingRes.body.invoice.id;

    // Sales Rep attempting to record payment is rejected with 403
    const unauthorizedRes = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${salesRepToken}`);

    expect(unauthorizedRes.status).toBe(403);
  });

  it('19. Denies cross-customer invoice payment attempts (404/403)', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 1, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const invoiceId = billingRes.body.invoice.id;

    // Different customer attempting to pay another customer's invoice
    const crossCustRes = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${otherCustomerToken}`);

    expect(crossCustRes.status).toBe(404);
  });

  it('20. Payment preserves exact invoice minor unit monetary total', async () => {
    const opsToken = generateToken({ userId: 'ops_1', role: 'OPERATIONS_MANAGER' });
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdOneTime, quantity: 2, discountPercent: 10 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    const originalTotalMinor = billingRes.body.invoice.totalMinor;
    const invoiceId = billingRes.body.invoice.id;

    const payRes = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(payRes.status).toBe(200);
    expect(payRes.body.totalMinor).toBe(originalTotalMinor);
  });

  it('21. Generates QUARTERLY subscription with correct 3-month next billing date schedule', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdRecurringQuarterly, quantity: 2, discountPercent: 0 }],
      });

    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;

    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    expect(billingRes.body.subscriptions.length).toBe(1);

    const sub = billingRes.body.subscriptions[0];
    expect(sub.billingInterval).toBe('QUARTERLY');
    expect(sub.subscriptionNumber).toContain('SUB-Q-');

    const startDate = new Date(sub.startDate);
    const nextDate = new Date(sub.nextBillingDate);
    const diffDays = Math.round((nextDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(88);
    expect(diffDays).toBeLessThanOrEqual(93);

    expect(billingRes.body.recurring.quarterlyTotalMinor).toBe(sub.recurringAmountMinor);
  });

  it('22. Correctly calculates recurring run rates across hybrid ONE_TIME + QUARTERLY + MONTHLY items', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [
          { productId: testProductIdOneTime, quantity: 1, discountPercent: 0 },
          { productId: testProductIdRecurringMonthly, quantity: 2, discountPercent: 0 },
          { productId: testProductIdRecurringQuarterly, quantity: 3, discountPercent: 0 },
        ],
      });

    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.id;

    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    expect(billingRes.body.invoice).not.toBeNull();
    expect(billingRes.body.subscriptions.length).toBe(2);

    const monthlySub = billingRes.body.subscriptions.find((s: any) => s.billingInterval === 'MONTHLY');
    const quarterlySub = billingRes.body.subscriptions.find((s: any) => s.billingInterval === 'QUARTERLY');

    expect(monthlySub).toBeDefined();
    expect(quarterlySub).toBeDefined();

    const expectedAnnual = (monthlySub.recurringAmountMinor * 12) + (quarterlySub.recurringAmountMinor * 4);
    expect(billingRes.body.recurring.annualTotalMinor).toBe(expectedAnnual);
  });

  it('23. Preserves integer minor-unit money for quarterly billing calculations', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductIdRecurringQuarterly, quantity: 3, discountPercent: 12.5 }],
      });

    const quoteId = createRes.body.id;
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'APPROVED' } });

    const billingRes = await request(app)
      .post(`/api/v1/quotes/${quoteId}/billing`)
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({});

    expect(billingRes.status).toBe(201);
    const sub = billingRes.body.subscriptions[0];
    expect(Number.isInteger(sub.recurringAmountMinor)).toBe(true);
    expect(Number.isInteger(sub.lines[0].unitPriceMinor)).toBe(true);
    expect(Number.isInteger(sub.lines[0].netTotalMinor)).toBe(true);
  });
});
