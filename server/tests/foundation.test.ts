import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/client.js';
import { z } from 'zod';
import { validatePayload } from '../src/middleware/validatePayload.js';
import { authMiddleware } from '../src/middleware/authMiddleware.js';

// Setup test route for middleware testing
const dummySchema = z.object({
  quantity: z.number().positive('Quantity must be greater than zero'),
  discountPercent: z.number().min(0).max(100, 'Discount cannot exceed 100%'),
});

app.post('/api/v1/test-validation', validatePayload(dummySchema), (req, res) => {
  res.json({ success: true, data: req.body });
});

app.get('/api/v1/test-manager-only', authMiddleware(['SALES_MANAGER']), (req, res) => {
  res.json({ success: true, message: 'Manager access granted' });
});

describe('Phase 1 Foundation Test Suite', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Application starts and health endpoint responds with 200 OK and DB CONNECTED', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
    expect(response.body.database).toBe('CONNECTED');
    expect(response.body.service).toContain('DealFlow360');
  });

  it('2. Database seed contains expected Master Data (Customers, Products, Users, Policies)', async () => {
    const customers = await prisma.customer.findMany({ include: { tier: true } });
    expect(customers.length).toBeGreaterThanOrEqual(3);

    const acme = customers.find((c) => c.name === 'Acme Industries');
    expect(acme).toBeDefined();
    expect(acme?.tier.code).toBe('GOLD');
    expect(acme?.tier.maxOverallDiscount).toBe(15.0);

    const products = await prisma.product.findMany({ include: { category: true } });
    expect(products.length).toBeGreaterThanOrEqual(6);

    const users = await prisma.user.findMany();
    expect(users.some((u) => u.role === 'SALES_REP')).toBe(true);
    expect(users.some((u) => u.role === 'SALES_MANAGER')).toBe(true);
  });

  it('3. Payload validation middleware rejects invalid payloads with HTTP 400', async () => {
    const badResponse = await request(app)
      .post('/api/v1/test-validation')
      .send({ quantity: -5, discountPercent: 150 });

    expect(badResponse.status).toBe(400);
    expect(badResponse.body.error).toBe('Validation Error');
    expect(badResponse.body.details).toHaveLength(2);

    const validResponse = await request(app)
      .post('/api/v1/test-validation')
      .send({ quantity: 2, discountPercent: 10 });

    expect(validResponse.status).toBe(200);
    expect(validResponse.body.success).toBe(true);
  });

  it('4. Role authorization middleware rejects unauthorized SALES_REP access with HTTP 403', async () => {
    const forbiddenResponse = await request(app)
      .get('/api/v1/test-manager-only')
      .set('X-Demo-Role', 'SALES_REP');

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toBe('Forbidden');

    const allowedResponse = await request(app)
      .get('/api/v1/test-manager-only')
      .set('X-Demo-Role', 'SALES_MANAGER');

    expect(allowedResponse.status).toBe(200);
    expect(allowedResponse.body.success).toBe(true);
  });
});
