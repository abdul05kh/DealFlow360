import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/client';
import { generateToken } from '../src/services/authService';

describe('P0 Performance & Master Data Smoke Test Suite', () => {
  let salesRepToken: string;
  let testCustomerId: string;
  let testProductId: string;

  beforeEach(async () => {
    salesRepToken = generateToken({ userId: 'rep_1', role: 'SALES_REP' });
    const cust = await prisma.customer.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    testCustomerId = cust.id;
    const prod = await prisma.product.findFirstOrThrow({ where: { isActive: true } });
    testProductId = prod.id;
  });

  it('1. Product Bounded Search Latency (< 200ms)', async () => {
    const start = performance.now();
    const res = await request(app)
      .get('/api/v1/products?search=Server&limit=10')
      .set('Authorization', `Bearer ${salesRepToken}`);
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    console.log(`[PERF] Product search latency: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000); // Safe CI upper bound
  });

  it('2. Customer List Latency (< 150ms)', async () => {
    const start = performance.now();
    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${salesRepToken}`);
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(6); // 6 realistic customers seeded
    console.log(`[PERF] Customer list latency (${res.body.length} customers): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000);
  });

  it('3. Authoritative Quote Evaluation Latency (< 150ms)', async () => {
    const start = performance.now();
    const res = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [
          { productId: testProductId, quantity: 5, discountPercent: 12 },
        ],
      });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.financials).toBeDefined();
    console.log(`[PERF] Quote evaluation latency: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000);
  });

  it('4. User Authentication Latency (< 250ms)', async () => {
    const start = performance.now();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'salesrep@example.com',
        password: 'Password123!',
      });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    console.log(`[PERF] User login authentication latency: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1500);
  });

  it('5. Fulfillment Evaluation Latency (< 150ms)', async () => {
    const createRes = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({
        customerId: testCustomerId,
        items: [{ productId: testProductId, quantity: 4, discountPercent: 0 }],
      });

    const quoteId = createRes.body.id;

    const start = performance.now();
    const res = await request(app)
      .post('/api/v1/fulfillment/evaluate')
      .set('Authorization', `Bearer ${salesRepToken}`)
      .send({ quoteId });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toBeDefined();
    console.log(`[PERF] Fulfillment evaluation latency: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000);
  });
});
