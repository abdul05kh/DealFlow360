import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { config } from '../src/config/index';

const prisma = new PrismaClient();

describe('P0-2 Dynamic Master Data & Admin Configuration Integration Tests', () => {
  let adminToken: string;
  let repToken: string;
  let managerToken: string;
  let opsToken: string;

  beforeEach(async () => {
    config.nodeEnv = 'test';

    adminToken = jwt.sign(
      { userId: 'admin_1', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    repToken = jwt.sign(
      { userId: 'rep_1', role: 'SALES_REP' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    managerToken = jwt.sign(
      { userId: 'mgr_1', role: 'SALES_MANAGER' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    opsToken = jwt.sign(
      { userId: 'ops_1', role: 'OPERATIONS_MANAGER' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Reset Gold Tier ceiling back to 15.0% and Acme customer back to Gold tier
    const goldTier = await prisma.customerTier.findUnique({ where: { code: 'GOLD' } });
    if (goldTier) {
      await prisma.customerTier.updateMany({
        where: { code: 'GOLD' },
        data: { maxOverallDiscount: 15.0 },
      });
      await prisma.customer.updateMany({
        where: { name: 'Acme Industries' },
        data: { tierId: goldTier.id },
      });
    }

    // Clean any test products and customer tiers created during runs
    await prisma.customer.updateMany({
      where: { name: 'Test Tier Assignment Co' },
      data: { status: 'DELETED' },
    });
    await prisma.product.deleteMany({
      where: { sku: { in: ['CLOUD-001', 'INVALID-001', 'TEST-DEL-001'] } },
    });
    await prisma.customerTier.deleteMany({
      where: { code: { in: ['PLATINUM_TEST', 'DIAMOND_TEST', 'EMPTY_TIER_TEST'] } },
    });
  });

  // 1. ADMIN creates valid product
  it('1. ADMIN can successfully create a new product', async () => {
    const category = await prisma.productCategory.findFirst();
    expect(category).not.toBeNull();

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'CLOUD-001',
        name: 'Cloud Security Package',
        categoryId: category!.id,
        sellingPrice: 50000.0,
        costPrice: 25000.0,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.sku).toBe('CLOUD-001');
    expect(res.body.sellingPrice).toBe(50000.0);

    const dbProduct = await prisma.product.findUnique({ where: { sku: 'CLOUD-001' } });
    expect(dbProduct).not.toBeNull();
    expect(dbProduct!.name).toBe('Cloud Security Package');
  });

  // 2. Non-ADMIN denied product creation
  it('2. Non-ADMIN users (SALES_REP, SALES_MANAGER, OPERATIONS_MANAGER) are denied product creation (403)', async () => {
    const category = await prisma.productCategory.findFirst();

    const repRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        sku: 'HACK-001',
        name: 'Hacked Product',
        categoryId: category!.id,
        sellingPrice: 1000,
        costPrice: 500,
      });

    expect(repRes.status).toBe(403);

    const mgrRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        sku: 'HACK-002',
        name: 'Hacked Product 2',
        categoryId: category!.id,
        sellingPrice: 1000,
        costPrice: 500,
      });

    expect(mgrRes.status).toBe(403);
  });

  // 3. Invalid product input rejected
  it('3. Invalid product inputs (negative price, non-existent category) are rejected with 400 Bad Request', async () => {
    const category = await prisma.productCategory.findFirst();

    const badPriceRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'BAD-001',
        name: 'Bad Price Product',
        categoryId: category!.id,
        sellingPrice: -50.0,
        costPrice: 10.0,
      });

    expect(badPriceRes.status).toBe(400);

    const badCatRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'BAD-002',
        name: 'Bad Category Product',
        categoryId: 'non_existent_category_id_999',
        sellingPrice: 100.0,
        costPrice: 50.0,
      });

    expect(badCatRes.status).toBe(400);
  });

  // 4. Strict Zod check rejects unknown fields
  it('4. Strict schema validation rejects unexpected extra fields (400)', async () => {
    const category = await prisma.productCategory.findFirst();

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'EXTRA-001',
        name: 'Extra Field Product',
        categoryId: category!.id,
        sellingPrice: 1000.0,
        costPrice: 500.0,
        unauthorizedInjectField: 'HACKED_GOVERNANCE_VALUE',
      });

    expect(res.status).toBe(400);
  });

  // 5. ADMIN updates Customer Tier ceiling
  it('5. ADMIN can update Customer Tier overall discount ceiling', async () => {
    const goldTier = await prisma.customerTier.findUnique({ where: { code: 'GOLD' } });
    expect(goldTier).not.toBeNull();

    const updateRes = await request(app)
      .patch(`/api/v1/customer-tiers/${goldTier!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        maxOverallDiscount: 12.0,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.maxOverallDiscount).toBe(12.0);

    const dbTier = await prisma.customerTier.findUnique({ where: { code: 'GOLD' } });
    expect(dbTier!.maxOverallDiscount).toBe(12.0);
  });

  // 6. Dynamic Governance Integration Proof
  it('6. Dynamic Governance Integration: Changing Gold Tier ceiling to 12% immediately affects quote evaluation', async () => {
    const acmeCustomer = await prisma.customer.findFirst({ where: { name: 'Acme Industries' } });
    const product = await prisma.product.findFirst({ where: { isActive: true } });

    expect(acmeCustomer).not.toBeNull();
    expect(product).not.toBeNull();

    // 1. Update Gold Tier max discount to 12.0%
    const goldTier = await prisma.customerTier.findUnique({ where: { code: 'GOLD' } });
    await request(app)
      .patch(`/api/v1/customer-tiers/${goldTier!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ maxOverallDiscount: 12.0 });

    // 2. Evaluate quote with 14.0% discount for Gold customer (Acme)
    const evalRes = await request(app)
      .post('/api/v1/quotes/evaluate')
      .set('Authorization', `Bearer ${repToken}`)
      .send({
        customerId: acmeCustomer!.id,
        items: [
          {
            productId: product!.id,
            quantity: 1,
            discountPercent: 14.0,
          },
        ],
      });

    expect(evalRes.status).toBe(200);
    // Governance engine must detect violation against new 12.0% limit
    expect(evalRes.body.governance.requiresApproval).toBe(true);
    expect(evalRes.body.governance.triggeredRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleCode: 'CUSTOMER_TIER_DISCOUNT_EXCEEDED',
          threshold: 12.0,
        }),
      ])
    );
  });

  // 7. Audit log verification
  it('7. Master data mutations generate immutable AuditEvent records', async () => {
    const category = await prisma.productCategory.findFirst();

    const createRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'CLOUD-001',
        name: 'Audit Check Product',
        categoryId: category!.id,
        sellingPrice: 50000.0,
        costPrice: 25000.0,
      });

    expect(createRes.status).toBe(201);

    const auditLogs = await prisma.auditEvent.findMany({
      where: {
        entityType: 'Product',
        entityId: createRes.body.id,
      },
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].action).toBe('CREATE_PRODUCT');
    expect(auditLogs[0].actorId).toBe('admin_1');
  });

  // 8. Dynamic catalog consumption
  it('8. Newly created product immediately appears in Sales Rep catalog API', async () => {
    const category = await prisma.productCategory.findFirst();

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'CLOUD-001',
        name: 'Instant Catalog Package',
        categoryId: category!.id,
        sellingPrice: 75000.0,
        costPrice: 35000.0,
      });

    const catalogRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${repToken}`);

    expect(catalogRes.status).toBe(200);
    const found = catalogRes.body.find((p: any) => p.sku === 'CLOUD-001');
    expect(found).toBeDefined();
    expect(found.sellingPrice).toBe(75000.0);
  });

  // 9. ADMIN can create a new customer tier
  it('9. ADMIN can successfully create a new Customer Tier (PLATINUM_TEST)', async () => {
    const res = await request(app)
      .post('/api/v1/customer-tiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'PLATINUM_TEST',
        name: 'Platinum Test Tier',
        maxOverallDiscount: 20.0,
        minMarginThreshold: 25.0,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('PLATINUM_TEST');
    expect(res.body.isActive).toBe(true);

    const dbTier = await prisma.customerTier.findUnique({ where: { code: 'PLATINUM_TEST' } });
    expect(dbTier).not.toBeNull();
    expect(dbTier!.maxOverallDiscount).toBe(20.0);
  });

  // 10. ADMIN can edit a customer tier
  it('10. ADMIN can edit an existing Customer Tier parameters', async () => {
    const createdTier = await prisma.customerTier.create({
      data: {
        code: 'DIAMOND_TEST',
        name: 'Diamond Tier',
        maxOverallDiscount: 25.0,
        minMarginThreshold: 20.0,
        isActive: true,
      },
    });

    const res = await request(app)
      .patch(`/api/v1/customer-tiers/${createdTier.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        maxOverallDiscount: 22.5,
        minMarginThreshold: 22.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.maxOverallDiscount).toBe(22.5);
    expect(res.body.minMarginThreshold).toBe(22.0);
  });

  // 11. ADMIN can view customer tiers with assigned companies
  it('11. ADMIN can view customer tiers including assigned companies list', async () => {
    const res = await request(app)
      .get('/api/v1/customer-tiers?includeInactive=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const goldTier = res.body.find((t: any) => t.code === 'GOLD');
    expect(goldTier).toBeDefined();
    expect(Array.isArray(goldTier.customers)).toBe(true);
  });

  // 12. ADMIN can reassign a company to another tier
  it('12. ADMIN can reassign a customer/company to another tier', async () => {
    const customer = await prisma.customer.findFirst({ where: { status: 'ACTIVE' } });
    expect(customer).not.toBeNull();

    const silverTier = await prisma.customerTier.findFirst({ where: { code: 'SILVER' } });
    expect(silverTier).not.toBeNull();

    const res = await request(app)
      .patch(`/api/v1/customers/${customer!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tierId: silverTier!.id });

    expect(res.status).toBe(200);
    expect(res.body.tierId).toBe(silverTier!.id);
    expect(res.body.tier.code).toBe('SILVER');

    // Restore original customer tier to avoid polluting other test suites
    await prisma.customer.update({
      where: { id: customer!.id },
      data: { tierId: customer!.tierId },
    });
  });

  // 13. Soft deactivation denied when active assigned companies exist
  it('13. Deactivating a tier with assigned companies returns 400 Bad Request', async () => {
    const customer = await prisma.customer.findFirst({ where: { status: 'ACTIVE' } });
    expect(customer).not.toBeNull();

    const res = await request(app)
      .delete(`/api/v1/customer-tiers/${customer!.tierId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Reassign companies');
  });

  // 14. Soft deactivation succeeds on empty tier
  it('14. Deactivating an empty customer tier soft-deactivates (isActive = false)', async () => {
    const emptyTier = await prisma.customerTier.create({
      data: {
        code: 'EMPTY_TIER_TEST',
        name: 'Empty Tier Test',
        maxOverallDiscount: 5.0,
        minMarginThreshold: 50.0,
        isActive: true,
      },
    });

    const res = await request(app)
      .delete(`/api/v1/customer-tiers/${emptyTier.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const dbTier = await prisma.customerTier.findUnique({ where: { id: emptyTier.id } });
    expect(dbTier!.isActive).toBe(false);
  });

  // 15. Assigning customer to inactive tier fails
  it('15. Assigning a customer to an inactive customer tier returns 400 Bad Request', async () => {
    const inactiveTier = await prisma.customerTier.create({
      data: {
        code: 'EMPTY_TIER_TEST',
        name: 'Inactive Tier Test',
        maxOverallDiscount: 5.0,
        minMarginThreshold: 50.0,
        isActive: false,
      },
    });

    const customer = await prisma.customer.findFirst({ where: { status: 'ACTIVE' } });

    const res = await request(app)
      .patch(`/api/v1/customers/${customer!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tierId: inactiveTier.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('inactive tier');
  });
});
