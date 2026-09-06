import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';

describe('Tenant Isolation & Security Tests', () => {
  let userAToken: string;
  let userBToken: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // Setup Mock Data
    // User A and Org A
    const userA = await prisma.user.create({
      data: {
        email: 'usera@test.com',
        passwordHash: await bcrypt.hash('password', 10),
        isActive: true,
      }
    });

    const orgA = await prisma.organization.create({
      data: { name: 'Org A', slug: 'org-a' }
    });
    orgAId = orgA.id;

    await prisma.organizationMembership.create({
      data: { organizationId: orgA.id, userId: userA.id }
    });

    // Session A
    const sessionA = await prisma.session.create({
      data: { userId: userA.id, token: 'tokenA', expiresAt: new Date(Date.now() + 100000) }
    });
    const jwtA = require('jsonwebtoken').sign({ id: userA.id, sessionId: sessionA.id }, process.env.JWT_SECRET || 'secret');
    userAToken = jwtA;

    // User B and Org B
    const userB = await prisma.user.create({
      data: {
        email: 'userb@test.com',
        passwordHash: await bcrypt.hash('password', 10),
        isActive: true,
      }
    });

    const orgB = await prisma.organization.create({
      data: { name: 'Org B', slug: 'org-b' }
    });
    orgBId = orgB.id;

    await prisma.organizationMembership.create({
      data: { organizationId: orgB.id, userId: userB.id }
    });

    const sessionB = await prisma.session.create({
      data: { userId: userB.id, token: 'tokenB', expiresAt: new Date(Date.now() + 100000) }
    });
    const jwtB = require('jsonwebtoken').sign({ id: userB.id, sessionId: sessionB.id }, process.env.JWT_SECRET || 'secret');
    userBToken = jwtB;
  });

  afterAll(async () => {
    // Clean up
    await prisma.organizationMembership.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('User A should access Org A successfully', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-organization-id', orgAId);
    
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orgAId);
  });

  it('User A should be denied access to Org B (Tenant Isolation)', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-organization-id', orgBId); // Trying to access B's org
    
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('do not have access');
  });

  it('User A should be denied if x-organization-id is missing', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${userAToken}`);
    
    expect(res.status).toBe(403);
  });

  it('User A should not access Super Admin routes (Privilege Escalation)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/organizations')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Super Admin access required');
  });

  it('User B should not access User A settings even with valid org ID (IDOR)', async () => {
    // User B tries to call Org A settings by manipulating the org ID
    const res = await request(app)
      .get(`/api/v1/organizations/${orgAId}/settings`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-organization-id', orgAId);
    
    expect(res.status).toBe(403);
    // Note: The middleware `requireTenant` uses req.user.id and req.headers['x-organization-id'].
    // User B is NOT in Org A, so `requireTenant` throws 403.
    // Wait, the router usually uses `requireTenant`. Let's test the current org endpoint again but as user B pretending to be A's org.
    const res2 = await request(app)
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-organization-id', orgAId);

    expect(res2.status).toBe(403);
  });
});
