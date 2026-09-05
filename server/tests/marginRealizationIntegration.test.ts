import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { config } from '../src/config/index';

const prisma = new PrismaClient();

describe('P0-3 Dynamic Margin Realization (MRI) Integration & Security Tests', () => {
  let repToken: string;
  let adminToken: string;

  beforeEach(async () => {
    config.nodeEnv = 'test';

    repToken = jwt.sign(
      { userId: 'rep_1', role: 'SALES_REP' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { userId: 'admin_1', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Reset Gold Tier minMarginThreshold to 30.0%
    await prisma.customerTier.updateMany({
      where: { code: 'GOLD' },
      data: { minMarginThreshold: 30.0, maxOverallDiscount: 15.0 },
    });
  });

  // 1. Quantity Sensitivity Integration Test
  it('1. Server recalculates volume factor, required target, and MRI when quantity changes', async () => {
    const customer = await prisma.customer.findUnique({ where: { id: 'cust_acme_101' } });
    const product = await prisma.product.findUnique({ where: { id: 'prod_server_01' } });
    expect(customer).not.toBeNull();
    expect(product).not.toBeNull();

    // Scenario A: Qty = 1, Discount = 0%
    const resQty1 = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 1, discountPercent: 0 }],
      });

    expect(resQty1.status).toBe(200);
    expect(resQty1.body.marginRealization).toBeDefined();
    const mriQty1 = resQty1.body.marginRealization;
    expect(mriQty1.volumeFactorPercent).toBe(0.0);
    expect(mriQty1.requiredTargetMarginPercent).toBe(30.0);

    // Scenario B: Qty = 10, Discount = 0%
    const resQty10 = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 10, discountPercent: 0 }],
      });

    expect(resQty10.status).toBe(200);
    const mriQty10 = resQty10.body.marginRealization;
    expect(mriQty10.volumeFactorPercent).toBeGreaterThan(0.0); // ~9.97%
    expect(mriQty10.requiredTargetMarginPercent).toBeLessThan(30.0); // ~27.01%
    expect(mriQty10.marginRealizationPercent).toBeGreaterThan(mriQty1.marginRealizationPercent);
  });

  // 2. Discount Sensitivity Integration Test
  it('2. Server recalculates realized margin and MRI when discount percentage changes', async () => {
    const customer = await prisma.customer.findUnique({ where: { id: 'cust_acme_101' } });
    const product = await prisma.product.findUnique({ where: { id: 'prod_server_01' } });

    // Scenario A: Discount = 0%
    const resDisc0 = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 1, discountPercent: 0 }],
      });

    // Scenario B: Discount = 10%
    const resDisc10 = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 1, discountPercent: 10 }],
      });

    expect(resDisc0.status).toBe(200);
    expect(resDisc10.status).toBe(200);

    const mri0 = resDisc0.body.marginRealization;
    const mri10 = resDisc10.body.marginRealization;

    expect(mri10.netRevenue).toBeLessThan(mri0.netRevenue);
    expect(mri10.realizedMarginPercent).toBeLessThan(mri0.realizedMarginPercent);
    expect(mri10.marginRealizationPercent).toBeLessThan(mri0.marginRealizationPercent);
  });

  // 3. Persisted Customer Tier Configuration Sensitivity Test
  it('3. Updating persisted CustomerTier minMarginThreshold dynamically alters MRI results', async () => {
    const customer = await prisma.customer.findUnique({ where: { id: 'cust_acme_101' } });
    const product = await prisma.product.findUnique({ where: { id: 'prod_server_01' } });

    // Evaluate before target change (Target = 30%)
    const res1 = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 1, discountPercent: 0 }],
      });

    expect(res1.body.marginRealization.baseTargetMarginPercent).toBe(30.0);

    // Update Gold Tier minMarginThreshold to 40.0% in DB
    await prisma.customerTier.updateMany({
      where: { code: 'GOLD' },
      data: { minMarginThreshold: 40.0 },
    });

    // Re-evaluate same quote
    const res2 = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 1, discountPercent: 0 }],
      });

    expect(res2.body.marginRealization.baseTargetMarginPercent).toBe(40.0);
    expect(res2.body.marginRealization.requiredTargetMarginPercent).toBe(40.0);
    expect(res2.body.marginRealization.marginRealizationPercent).toBeLessThan(
      res1.body.marginRealization.marginRealizationPercent
    );
  });

  // 4. Security & Anti-Tampering Test
  it('4. Server rejects client-supplied cost/price/MRI overrides via strict Zod schema validation (400)', async () => {
    const customer = await prisma.customer.findUnique({ where: { id: 'cust_acme_101' } });
    const product = await prisma.product.findUnique({ where: { id: 'prod_server_01' } });

    // Payload with unknown tampered fields must be rejected with 400 Bad Request by strict Zod schema validation
    const tamperedRes = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [
          {
            productId: product!.id,
            quantity: 1,
            discountPercent: 0,
            costPrice: 1.0, // Fake cheap cost
            sellingPrice: 999999.0, // Fake huge price
            marginRealizationPercent: 999.9, // Fake huge MRI
          },
        ],
      });

    expect(tamperedRes.status).toBe(400);
    expect(tamperedRes.body.error).toBe('Validation Error');

    // Valid payload must use authoritative cost price from DB
    const validRes = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 1, discountPercent: 0 }],
      });

    expect(validRes.status).toBe(200);
    const mri = validRes.body.marginRealization;
    expect(mri.estimatedCost).toBe(product!.costPrice);
    expect(mri.marginRealizationPercent).not.toBe(999.9);
  });

  // 5. Existing Governance & Decision Regression Test
  it('5. MRI presence does NOT alter discount governance, risk score, or approval decision outcome', async () => {
    const customer = await prisma.customer.findUnique({ where: { id: 'cust_acme_101' } });
    const product = await prisma.product.findUnique({ where: { id: 'prod_server_01' } });

    // Set Gold Tier discount ceiling to 12.0%
    await prisma.customerTier.updateMany({
      where: { code: 'GOLD' },
      data: { maxOverallDiscount: 12.0 },
    });

    const res = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: customer!.id,
        items: [{ productId: product!.id, quantity: 1, discountPercent: 14.0 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.marginRealization).toBeDefined();
    // Governance decisions must remain 100% untouched
    expect(res.body.governance.requiresApproval).toBe(true);
    expect(res.body.decision.quoteStatus).toBe('PENDING_APPROVAL');
  });
});
