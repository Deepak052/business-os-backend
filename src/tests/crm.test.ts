import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';

describe('CRM Module Access Tests', () => {
  let userAToken: string;
  let orgAId: string;

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: {
        email: 'crmtest@test.com',
        passwordHash: await bcrypt.hash('password', 10),
        isActive: true,
      }
    });

    const orgA = await prisma.organization.create({
      data: { name: 'CRM Org', slug: 'crm-org' }
    });
    orgAId = orgA.id;

    await prisma.organizationMembership.create({
      data: { organizationId: orgA.id, userId: userA.id }
    });

    const sessionA = await prisma.session.create({
      data: { userId: userA.id, token: 'crmToken', expiresAt: new Date(Date.now() + 100000) }
    });
    
    userAToken = require('jsonwebtoken').sign({ id: userA.id, sessionId: sessionA.id }, process.env.JWT_SECRET || 'secret');
  });

  afterAll(async () => {
    await prisma.organizationMembership.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('Should deny access to CRM if module is not activated or entitled', async () => {
    // Org A does not have CRM module activated or subscribed
    const res = await request(app)
      .get('/api/v1/crm/companies')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-organization-id', orgAId);

    expect(res.status).toBe(403);
    // Middleware requireModuleAccess throws 403
  });
});
