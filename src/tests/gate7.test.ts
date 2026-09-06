import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

describe('Gate 7 - Subscription & Quota Enforcement E2E Validation', () => {
  let superAdminToken: string;
  let superAdminId: string;
  let orgAdminToken: string;
  let orgAdminId: string;
  let orgId: string;
  let planId: string;
  let subscriptionId: string;
  let crmModuleId: string;
  let roleId: string;
  let testFeatureKey = 'test_feature_flag';

  beforeAll(async () => {
    // 0. Clean DB
    await prisma.hrmsPayrollStub.deleteMany();
    await prisma.hrmsAttendance.deleteMany();
    await prisma.hrmsLeaveRequest.deleteMany();
    await prisma.hrmsEmployeeProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.planEntitlement.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.subscriptionPlan.create({ data: { name: 'Basic', price: 0, isDefault: true } });
    await prisma.organizationModule.deleteMany();
    await prisma.module.deleteMany();
    await prisma.organizationFeatureFlag.deleteMany();
    await prisma.featureFlag.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.membershipRole.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.department.deleteMany();
    await prisma.team.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    // 1. Setup Super Admin
    const superAdmin = await prisma.user.create({
      data: {
        email: env.SUPERADMIN_EMAIL,
        passwordHash: await bcrypt.hash('password', 10),
        isActive: true,
      }
    });
    superAdminId = superAdmin.id;
    const superAdminSession = await prisma.session.create({
      data: { userId: superAdminId, token: 'sa_token_123', expiresAt: new Date(Date.now() + 100000) }
    });
    superAdminToken = jwt.sign({ id: superAdminId, sessionId: superAdminSession.id }, env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Setup Modules and Feature Flags
    const crmModule = await prisma.module.create({
      data: { name: 'CRM', version: '1.0', isGlobal: false, status: 'active' }
    });
    crmModuleId = crmModule.id;

    await prisma.featureFlag.create({
      data: { key: testFeatureKey, name: 'Test Flag', isEnabled: false, description: 'Test flag' }
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.planEntitlement.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.subscriptionPlan.create({ data: { name: 'Basic', price: 0, isDefault: true } });
    await prisma.organizationModule.deleteMany();
    await prisma.module.deleteMany();
    await prisma.organizationFeatureFlag.deleteMany();
    await prisma.featureFlag.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.hrmsPayrollStub.deleteMany();
    await prisma.hrmsAttendance.deleteMany();
    await prisma.hrmsLeaveRequest.deleteMany();
    await prisma.hrmsEmployeeProfile.deleteMany();
    
    await prisma.organizationMembership.deleteMany({});
    await prisma.membershipRole.deleteMany();
    await prisma.department.deleteMany();
    await prisma.team.deleteMany();
    await prisma.role.deleteMany({});
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  });

  describe('7.1 & 7.2 Subscription Lifecycle Verification', () => {
    it('Super Admin creates a dynamic subscription plan', async () => {
      const plan = await prisma.subscriptionPlan.create({
        data: {
          name: 'Gate7 Starter',
          price: 50,
          isActive: true,
          entitlements: {
            create: [
              { limitKey: 'max_users', limitValue: 5 },
              { limitKey: 'max_teams', limitValue: 2 },
              { limitKey: 'max_departments', limitValue: 2 },
              { limitKey: 'max_roles', limitValue: 2 },
              { moduleId: crmModuleId }
            ]
          }
        },
        include: { entitlements: true }
      });
      planId = plan.id;
      expect(plan).toBeDefined();
      expect(plan.entitlements.length).toBe(5);
    });

    it('Super Admin creates an organization and assigns the plan (Subscription History)', async () => {
      // Create org
      const org = await prisma.organization.create({
        data: { name: 'Gate7 Corp', slug: 'gate7-corp' }
      });
      orgId = org.id;

      // Create Admin
      const admin = await prisma.user.create({
        data: { email: 'admin_gate7@test.com', passwordHash: await bcrypt.hash('password', 10), isActive: true }
      });
      orgAdminId = admin.id;
      const orgAdminSession = await prisma.session.create({
        data: { userId: orgAdminId, token: 'org_admin_token_123', expiresAt: new Date(Date.now() + 100000) }
      });
      orgAdminToken = jwt.sign({ id: orgAdminId, sessionId: orgAdminSession.id }, env.JWT_SECRET, { expiresIn: '1h' });

      await prisma.organizationMembership.create({
        data: { organizationId: orgId, userId: admin.id, status: 'active' }
      });

      // Create Admin Role with manage:members, manage:departments, manage:roles, manage:teams
      const manageMembers = await prisma.permission.create({
        data: { action: 'manage:members', resource: 'memberships', isDelegatable: true }
      });
      const manageDepts = await prisma.permission.create({
        data: { action: 'manage:departments', resource: 'departments', isDelegatable: true }
      });
      const manageRoles = await prisma.permission.create({
        data: { action: 'manage:roles', resource: 'roles', isDelegatable: true }
      });
      const manageTeams = await prisma.permission.create({
        data: { action: 'manage:teams', resource: 'teams', isDelegatable: true }
      });
      
      const adminRole = await prisma.role.create({
        data: {
          name: 'Org Admin',
          organizationId: orgId,
          isSystem: false,
          permissions: { 
            create: [
              { permissionId: manageMembers.id },
              { permissionId: manageDepts.id },
              { permissionId: manageRoles.id },
              { permissionId: manageTeams.id }
            ] 
          }
        }
      });
      
      const adminMembership = await prisma.organizationMembership.findFirst({
        where: { userId: admin.id, organizationId: orgId }
      });
      await prisma.membershipRole.create({
        data: { membershipId: adminMembership!.id, roleId: adminRole.id }
      });

      // Assign subscription
      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sub = await prisma.subscription.create({
        data: {
          organizationId: orgId,
          planId: planId,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: endDate
        }
      });
      subscriptionId = sub.id;

      // Create a dummy system role for the invitations
      const role = await prisma.role.create({
        data: { name: 'Employee', isSystem: true, organizationId: orgId }
      });
      roleId = role.id;

      expect(sub).toBeDefined();
      expect(sub.status).toBe('active');
    });
  });

  describe('7.3, 7.4 & 7.17 User Quota E2E & Concurrency', () => {
    it('Pending invitations should consume quota and concurrent requests should be safely serialized', async () => {
      // Current usage: 1 (the org admin)
      // Limit: 5
      // Remaining: 4
      
      const requests = [];
      // We will send 6 concurrent invitations
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/v1/memberships/invite')
            .set('Authorization', `Bearer ${orgAdminToken}`)
            .set('x-organization-id', orgId)
            .send({
              email: `invite${i}@gate7.com`,
              roleId: roleId
            })
        );
      }

      const responses = await Promise.all(requests);
      
      let successCount = 0;
      let errorCount = 0;

      for (const res of responses) {
        if (res.status === 201) successCount++;
        else if (res.status === 403 && res.body.error.code === 'QUOTA_EXCEEDED') errorCount++;
      }

      // Exactly 4 should succeed, 2 should fail with QUOTA_EXCEEDED
      expect(successCount).toBe(4);
      expect(errorCount).toBe(2);

      // Verify the DB has exactly 4 pending invites
      const invites = await prisma.invitation.count({ where: { organizationId: orgId } });
      expect(invites).toBe(4);
    });
  });

  describe('7.5 & 7.7 Quota Enforcement Limits & Boundaries', () => {
    it('Should create departments up to limit and block when exceeded', async () => {
      const res1 = await request(app).post('/api/v1/organizations/departments').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId).send({ name: 'Engineering', description: 'desc' });
      expect(res1.status).toBe(201);
      const res2 = await request(app).post('/api/v1/organizations/departments').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId).send({ name: 'Sales', description: 'desc' });
      expect(res2.status).toBe(201);
      
      const res3 = await request(app).post('/api/v1/organizations/departments').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId).send({ name: 'Marketing', description: 'desc' });
      expect(res3.status).toBe(403);
      expect(res3.body.error.code).toBe('QUOTA_EXCEEDED');
    });

    it('Should handle unlimited quota (-1)', async () => {
      const unlPlan = await prisma.subscriptionPlan.create({
        data: {
          name: 'Unlimited Plan', price: 100, isActive: true,
          entitlements: {
            create: [
              { limitKey: 'max_roles', limitValue: -1 }
            ]
          }
        }
      });
      await request(app).post('/api/v1/admin/subscriptions/assign').set('Authorization', `Bearer ${superAdminToken}`).send({ orgId: orgId, planId: unlPlan.id });

      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/api/v1/roles').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId).send({ name: `Role ${i}`, permissions: [] });
        expect(res.status).toBe(201);
      }
    });

    it('Should handle missing quota as 0', async () => {
      const res = await request(app).post('/api/v1/organizations/teams').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId).send({ name: 'Team A' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
    });
  });

  describe('7.8 & 7.9 Module & Feature Flag Precedence', () => {
    it('Feature flag: Global -> Plan -> Org Override', async () => {
      const { EntitlementService } = require('../services/entitlement.service');
      let ents = await EntitlementService.getOrganizationEntitlements(orgId);
      expect(ents.features.includes(testFeatureKey)).toBe(false);

      await prisma.organizationFeatureFlag.create({
        data: { organizationId: orgId, featureKey: testFeatureKey, isEnabled: true }
      });

      ents = await EntitlementService.getOrganizationEntitlements(orgId);
      expect(ents.features.includes(testFeatureKey)).toBe(true);
    });

    it('Module: Plan Entitlement vs Global Disable', async () => {
      const { EntitlementService } = require('../services/entitlement.service');
      await request(app).post('/api/v1/admin/subscriptions/assign').set('Authorization', `Bearer ${superAdminToken}`).send({ orgId: orgId, planId: planId });

      let ents = await EntitlementService.getOrganizationEntitlements(orgId);
      expect(ents.activeModules.includes(crmModuleId)).toBe(true);

      await prisma.module.update({ where: { id: crmModuleId }, data: { status: 'disabled' } });

      ents = await EntitlementService.getOrganizationEntitlements(orgId);
      expect(ents.activeModules.includes(crmModuleId)).toBe(false);

      await prisma.module.update({ where: { id: crmModuleId }, data: { status: 'active' } });
    });
  });

  describe('7.12 & 7.15 Subscription State Read/Write & Org Suspension', () => {
    it('Should allow reads but block writes on EXPIRED subscription', async () => {
      await prisma.subscription.updateMany({
        where: { organizationId: orgId, status: 'active' },
        data: { status: 'expired' }
      });

      const getRes = await request(app).get('/api/v1/organizations/departments').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId);
      expect(getRes.status).toBe(200);

      const postRes = await request(app).post('/api/v1/organizations/departments').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId).send({ name: 'Test', description: 'test' });
      expect(postRes.status).toBe(403);
      expect(postRes.body.error.code).toBe('SUBSCRIPTION_EXPIRED');
    });

    it('Should block tenant access entirely for suspended org', async () => {
      await prisma.organization.update({ where: { id: orgId }, data: { status: 'suspended' } });

      const getRes = await request(app).get('/api/v1/organizations/departments').set('Authorization', `Bearer ${orgAdminToken}`).set('x-organization-id', orgId);
      expect(getRes.status).toBe(403);
      expect(getRes.body.error.message).toMatch(/suspended/i);
    });
  });
});

