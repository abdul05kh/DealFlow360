import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { config } from '../src/config/index';

const prisma = new PrismaClient();

describe('P0-1 Real Authentication & Authorization Security Tests', () => {
  let seededUserEmail = 'salesrep@example.com';
  let seededUserPassword = 'Password123!';

  beforeEach(async () => {
    // Clean test signup accounts to ensure idempotent test runs
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'newuser.hashed@example.com',
            'no.hash.test@example.com',
            'hacker.admin@example.com',
            'hacker.ops@example.com',
            'cust.noid@example.com',
            'cust.valid@example.com',
            'deactivated.op@example.com',
          ],
        },
      },
    });

    // Ensure standard seeded test user exists
    const user = await prisma.user.findUnique({ where: { email: seededUserEmail } });
    if (!user) {
      const passwordHash = await bcrypt.hash(seededUserPassword, 10);
      await prisma.user.create({
        data: {
          id: 'rep_1',
          name: 'Alex Sales Rep',
          email: seededUserEmail,
          passwordHash,
          role: 'SALES_REP',
        },
      });
    }
  });

  // 1. Successful login
  it('1. Successful login returns safe user and JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: seededUserEmail, password: seededUserPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(seededUserEmail);
    expect(res.body.user.role).toBe('SALES_REP');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  // 2. Wrong password
  it('2. Wrong password returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: seededUserEmail, password: 'WrongPassword99!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
    expect(res.body).not.toHaveProperty('token');
  });

  // 3. Unknown user
  it('3. Unknown user returns 401 Unauthorized without enumeration risk', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown.user.999@example.com', password: 'SomePassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  // 4. Duplicate signup
  it('4. Duplicate signup is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Alex Duplicate',
        email: seededUserEmail,
        password: 'NewPassword123!',
        role: 'SALES_REP',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  // 5. Password is hashed
  it('5. Password is hashed in the database and never stored in plaintext', async () => {
    const newEmail = 'newuser.hashed@example.com';
    const plainPassword = 'SecretPassword123!';

    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Hashed Check User',
        email: newEmail,
        password: plainPassword,
        role: 'SALES_REP',
      });

    expect(signupRes.status).toBe(201);

    const dbUser = await prisma.user.findUnique({ where: { email: newEmail } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).not.toBe(plainPassword);
    expect(dbUser!.passwordHash.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare(plainPassword, dbUser!.passwordHash)).toBe(true);
  });

  // 6. PasswordHash never appears in response
  it('6. PasswordHash never appears in API responses (signup, login, me)', async () => {
    const email = 'no.hash.test@example.com';
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'No Hash User',
        email,
        password: 'Password123!',
        role: 'SALES_REP',
      });
    expect(JSON.stringify(signupRes.body)).not.toContain('passwordHash');

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });
    expect(JSON.stringify(loginRes.body)).not.toContain('passwordHash');

    const token = loginRes.body.token;
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');
  });

  // 7. Valid JWT authentication
  it('7. Valid JWT authentication grants access to protected endpoints', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: seededUserEmail, password: seededUserPassword });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(seededUserEmail);
  });

  // 8. Invalid JWT rejected
  it('8. Invalid or tampered JWT is rejected with 401 Unauthorized', async () => {
    const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature';

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  // 9. Missing JWT rejected in production mode
  it('9. Missing JWT is rejected with 401 Unauthorized in production mode', async () => {
    const originalEnv = config.nodeEnv;
    config.nodeEnv = 'production';

    try {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('X-Demo-Role', 'SALES_REP'); // Demo header attempted in prod

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/token required in production/i);
    } finally {
      config.nodeEnv = originalEnv;
    }
  });

  // 10. Demo headers accepted only in development/test compatibility mode
  it('10. Demo headers accepted only in dev/test compatibility mode when JWT is absent', async () => {
    config.nodeEnv = 'test';

    const res = await request(app)
      .get('/api/v1/quotes/evaluate')
      .set('X-Demo-Role', 'SALES_REP')
      .set('X-Demo-User-Id', 'rep_1');

    // Route requires POST, but 404/405 or non-401 means auth middleware passed!
    expect(res.status).not.toBe(401);
  });

  // 11. Demo headers cannot override a valid JWT identity
  it('11. Demo headers cannot override a valid JWT identity', async () => {
    config.nodeEnv = 'test';

    // Create a Sales Rep user token
    const repToken = jwt.sign(
      { userId: 'rep_1', role: 'SALES_REP' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Attempt to override role to OPERATIONS_MANAGER via X-Demo-Role header
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${repToken}`)
      .set('X-Demo-Role', 'OPERATIONS_MANAGER')
      .set('X-Demo-User-Id', 'ops_1');

    expect(res.status).toBe(200);
    // JWT identity must remain authoritative
    expect(res.body.user.role).toBe('SALES_REP');
    expect(res.body.user.id).toBe('rep_1');
  });

  // 12. Public signup cannot create ADMIN
  it('12. Public signup cannot create ADMIN or other privileged roles', async () => {
    const resAdmin = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Hacker Admin',
        email: 'hacker.admin@example.com',
        password: 'Password123!',
        role: 'ADMIN',
      });

    expect(resAdmin.status).toBe(403);
    expect(resAdmin.body.message).toMatch(/cannot create accounts with privileged role/i);

    const resOps = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Hacker Ops',
        email: 'hacker.ops@example.com',
        password: 'Password123!',
        role: 'OPERATIONS_MANAGER',
      });

    expect(resOps.status).toBe(403);
  });

  // 13. Customer user can only carry its assigned customer identity
  it('13. Customer user requires valid customerId and carries assigned customer identity', async () => {
    const customer = await prisma.customer.findFirst();
    expect(customer).not.toBeNull();

    // Signup without customerId fails
    const failRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Customer No ID',
        email: 'cust.noid@example.com',
        password: 'Password123!',
        role: 'CUSTOMER',
      });
    expect(failRes.status).toBe(400);

    // Signup with valid customerId succeeds
    const succRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Customer Valid',
        email: 'cust.valid@example.com',
        password: 'Password123!',
        role: 'CUSTOMER',
        customerId: customer!.id,
      });

    expect(succRes.status).toBe(201);
    expect(succRes.body.user.role).toBe('CUSTOMER');
    expect(succRes.body.user.customerId).toBe(customer!.id);
  });

  // 14. Existing RBAC behavior remains intact
  it('14. RBAC authorization checks remain strictly intact', async () => {
    // Sales Rep token trying to perform approval action (which requires SALES_MANAGER)
    const repToken = jwt.sign(
      { userId: 'rep_1', role: 'SALES_REP' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/v1/quotes/dummy_quote_id/approve')
      .set('Authorization', `Bearer ${repToken}`)
      .send({ reason: 'Self approval attempt' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  // 15. Admin Operator Management API Security
  it('15. Admin Operator Management (/api/v1/admin/operators) denies non-ADMIN users with 403 Forbidden', async () => {
    const repToken = jwt.sign(
      { userId: 'rep_1', role: 'SALES_REP' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resRep = await request(app)
      .get('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${repToken}`);

    expect(resRep.status).toBe(403);

    const adminToken = jwt.sign(
      { userId: 'admin_1', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resAdmin = await request(app)
      .get('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resAdmin.status).toBe(200);
    expect(Array.isArray(resAdmin.body)).toBe(true);
  });

  // 16. Soft-Deactivated User Security Rejection
  it('16. Deactivated user (isActive = false) is rejected with 401 Unauthorized', async () => {
    const deactEmail = 'deactivated.op@example.com';
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const deactivatedUser = await prisma.user.create({
      data: {
        name: 'Deactivated Op',
        email: deactEmail,
        passwordHash,
        role: 'SALES_REP',
        isActive: false,
      },
    });

    try {
      // Login attempt with deactivated account fails with 401 Unauthorized
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: deactEmail, password: 'Password123!' });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body.message).toBe('Invalid email or password');

      // Request attempt with valid JWT for deactivated userId
      const token = jwt.sign(
        { userId: deactivatedUser.id, role: 'SALES_REP' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(401);
    } finally {
      await prisma.user.delete({ where: { id: deactivatedUser.id } });
    }
  });

  // 17. Scoped Operator Customer-Request Queue Security
  it('17. Customer-Request Work Queue (/api/v1/operator/customer-requests) denies CUSTOMER and allows OPERATOR', async () => {
    const custToken = jwt.sign(
      { userId: 'cust_user_1', role: 'CUSTOMER', customerId: 'cust_1' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resCust = await request(app)
      .get('/api/v1/operator/customer-requests')
      .set('Authorization', `Bearer ${custToken}`);

    expect(resCust.status).toBe(403);

    const mgrToken = jwt.sign(
      { userId: 'mgr_1', role: 'SALES_MANAGER' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resMgr = await request(app)
      .get('/api/v1/operator/customer-requests')
      .set('Authorization', `Bearer ${mgrToken}`);

    expect(resMgr.status).toBe(200);
    expect(Array.isArray(resMgr.body)).toBe(true);
  });

  // 18. Admin Operator creation rejects ADMIN role and invalid roles
  it('18. Admin Operator creation rejects ADMIN role and invalid/arbitrary roles (400)', async () => {
    const adminToken = jwt.sign(
      { userId: 'admin_1', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resAdminRole = await request(app)
      .post('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Hacker Admin Account',
        email: 'hacker.admin.create@example.com',
        password: 'Password123!',
        role: 'ADMIN',
      });

    expect(resAdminRole.status).toBe(400);

    const resArbitraryRole = await request(app)
      .post('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Arbitrary Role Account',
        email: 'arbitrary.role@example.com',
        password: 'Password123!',
        role: 'SUPER_USER',
      });

    expect(resArbitraryRole.status).toBe(400);
  });

  // 19. Admin Operator creation rejects client-injected firebaseUid or passwordHash (400)
  it('19. Admin Operator creation rejects client-injected firebaseUid or passwordHash (400)', async () => {
    const adminToken = jwt.sign(
      { userId: 'admin_1', role: 'ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resExtraUid = await request(app)
      .post('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Extra Uid Injection',
        email: 'extra.uid@example.com',
        password: 'Password123!',
        role: 'SALES_REP',
        firebaseUid: 'fake_uid_123',
      });

    expect(resExtraUid.status).toBe(400);

    const resExtraHash = await request(app)
      .post('/api/v1/admin/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Extra Hash Injection',
        email: 'extra.hash@example.com',
        password: 'Password123!',
        role: 'SALES_REP',
        passwordHash: '$2a$10$fakehash',
      });

    expect(resExtraHash.status).toBe(400);
  });

  // 20. Comprehensive non-ADMIN 403 denial on all operator admin endpoints
  it('20. CUSTOMER, SALES_REP, SALES_MANAGER, and OPERATIONS_MANAGER receive 403 on admin operator endpoints', async () => {
    const roles = ['CUSTOMER', 'SALES_REP', 'SALES_MANAGER', 'OPERATIONS_MANAGER'];

    for (const role of roles) {
      const token = jwt.sign(
        { userId: 'test_user_id', role },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const getRes = await request(app)
        .get('/api/v1/admin/operators')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(403);

      const postRes = await request(app)
        .post('/api/v1/admin/operators')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Unauthorized Create',
          email: 'unauth@example.com',
          password: 'Password123!',
          role: 'SALES_REP',
        });
      expect(postRes.status).toBe(403);

      const patchRes = await request(app)
        .patch('/api/v1/admin/operators/rep_1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Unauthorized Patch' });
      expect(patchRes.status).toBe(403);

      const delRes = await request(app)
        .delete('/api/v1/admin/operators/rep_1')
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(403);
    }
  });
});
