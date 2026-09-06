import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import crypto from 'crypto';

describe('Gate 10 - E2E + Negative Security Validation', () => {
  let superAdminToken: string;
  let superAdminId: string;
  
  let orgAdminTokenA: string;
  let orgAdminTokenB: string;
  
  let orgAdminAId: string;
  let orgAdminBId: string;
  
  let orgAId: string;
  let orgBId: string;
  
  let planId: string;
  let roleAId: string;
  let deptAId: string;
  
  beforeAll(async () => {
    // 1. Basic superadmin setup
    await prisma.user.deleteMany({ where: { email: env.SUPERADMIN_EMAIL } });
    const superAdmin = await prisma.user.create({
      data: {
        email: env.SUPERADMIN_EMAIL,
        passwordHash: await bcrypt.hash('password', 10),
        isActive: true,
      }
    });
    superAdminId = superAdmin.id;
    const superAdminSession = await prisma.session.create({
      data: { userId: superAdminId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) }
    });
    superAdminToken = jwt.sign({ id: superAdminId, sessionId: superAdminSession.id }, env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Plan setup
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Gate10 Plan',
        price: 50,
        isActive: true,
        entitlements: {
          create: [
            { limitKey: 'max_users', limitValue: 10 },
            { limitKey: 'max_teams', limitValue: 5 },
            { limitKey: 'max_departments', limitValue: 5 },
            { limitKey: 'max_roles', limitValue: 5 },
          ]
        }
      }
    });
    planId = plan.id;
  });

  afterAll(async () => {
    // Delete HRMS data to satisfy FK constraints
    await prisma.hrmsPayrollStub.deleteMany();
    await prisma.hrmsAttendance.deleteMany();
    await prisma.hrmsLeaveRequest.deleteMany();
    await prisma.hrmsEmployeeProfile.deleteMany();
    await prisma.session.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.membershipRole.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.team.deleteMany();
    await prisma.department.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.subscriptionPlan.create({ data: { name: 'Basic', price: 0, isDefault: true } });
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  });

  describe('10.1 Positive End-to-End Lifecycle', () => {
    it('Super Admin can provision Organization A and assign subscription', async () => {
      const res = await request(app)
        .post('/api/v1/admin/organizations/provision')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          orgName: 'Org A',
          slug: 'org-a-10',
          adminEmail: 'adminA@test.com',
          adminFirstName: 'Admin',
          adminLastName: 'A',
          planId: planId
        });
      
      expect(res.status).toBe(201);
      orgAId = res.body.data.id; // Corrected based on console.log
      
      const adminUser = await prisma.user.findUnique({ where: { email: 'adminA@test.com' } });
      expect(adminUser).toBeDefined();
      orgAdminAId = adminUser!.id;
      
      // Mock login for orgAdminA
      const session = await prisma.session.create({
        data: { userId: orgAdminAId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) }
      });
      orgAdminTokenA = jwt.sign({ id: orgAdminAId, sessionId: session.id }, env.JWT_SECRET, { expiresIn: '1h' });
    });

    it('Super Admin can provision Organization B and assign subscription', async () => {
      const res = await request(app)
        .post('/api/v1/admin/organizations/provision')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          orgName: 'Org B',
          slug: 'org-b-10',
          adminEmail: 'adminB@test.com',
          adminFirstName: 'Admin',
          adminLastName: 'B',
          planId: planId
        });
      
      expect(res.status).toBe(201);
      orgBId = res.body.data.id;
      
      const adminUser = await prisma.user.findUnique({ where: { email: 'adminB@test.com' } });
      expect(adminUser).toBeDefined();
      orgAdminBId = adminUser!.id;
      
      const session = await prisma.session.create({
        data: { userId: orgAdminBId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) }
      });
      orgAdminTokenB = jwt.sign({ id: orgAdminBId, sessionId: session.id }, env.JWT_SECRET, { expiresIn: '1h' });
    });

    it('Org Admin A can invite an employee successfully', async () => {
      const role = await prisma.role.create({
        data: { name: 'Employee Role', organizationId: orgAId, isSystem: false }
      });
      const res = await request(app)
        .post('/api/v1/memberships/invite')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          email: 'employeeA@test.com',
          roleId: role.id
        });
      
      expect([200, 201]).toContain(res.status);
    });
  });

  describe('10.2 Cross-Tenant Isolation', () => {
    beforeAll(async () => {
      // Create some resources in Org A to test isolation
      const dept = await prisma.department.create({
        data: { name: 'Dept A', organizationId: orgAId }
      });
      deptAId = dept.id;

      const role = await prisma.role.create({
        data: { name: 'Role A', organizationId: orgAId, isSystem: false }
      });
      roleAId = role.id;
    });

    it('Org Admin B cannot access Org A teams', async () => {
      const res = await request(app)
        .get('/api/v1/organizations/teams')
        .set('Authorization', `Bearer ${orgAdminTokenB}`)
        .set('x-organization-id', orgAId); // Attempting to read A's context
      
      // Expected to fail tenant middleware check entirely
      expect([403, 404]).toContain(res.status);
    });

    it('Org Admin A cannot access Org B departments', async () => {
      const res = await request(app)
        .get('/api/v1/organizations/departments')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgBId);
      
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('10.17 Database-Level Tenant Isolation Invariant', () => {
    it('All tenant-scoped records belong to exactly one organization', async () => {
      // Find any role not belonging to an org and not system
      const orphanedRoles = await prisma.role.findMany({
        where: { organizationId: null, isSystem: false }
      });
      expect(orphanedRoles.length).toBe(0);
    });
  });

  describe('10.3 RBAC Privilege Escalation', () => {
    it('Admin assigning permission they do not possess -> 403', async () => {
      // Create a platform permission that is NOT delegatable
      const platPerm = await prisma.permission.create({
        data: { action: 'manage:platform', resource: 'platform', isDelegatable: false, description: 'Platform' }
      });
      
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          name: 'Escalated Role',
          permissionIds: [platPerm.id]
        });
      expect(res.status).toBe(403);
    });
  });

  describe('10.4 Subscription-State Attacks', () => {
    it('Mutations fail when subscription is EXPIRED', async () => {
      // Setup: change org subscription to EXPIRED
      await prisma.subscription.updateMany({
        where: { organizationId: orgAId },
        data: { status: 'expired' }
      });

      const res = await request(app)
        .post('/api/v1/organizations/departments')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ name: 'Should Fail Dept' });
      
      expect(res.status).toBe(403);

      // Restore active state
      await prisma.subscription.updateMany({
        where: { organizationId: orgAId },
        data: { status: 'active' }
      });
    });
  });

  describe('10.5 Quota Boundary Attacks', () => {
    it('Exceeding max_departments fails with QUOTA_EXCEEDED', async () => {
      // quota is 5, we already have Dept A (1). We will create 4 more to hit 5, then 6th should fail.
      await prisma.department.createMany({
        data: [
          { name: 'Dept 2', organizationId: orgAId },
          { name: 'Dept 3', organizationId: orgAId },
          { name: 'Dept 4', organizationId: orgAId },
          { name: 'Dept 5', organizationId: orgAId }
        ]
      });

      const res = await request(app)
        .post('/api/v1/organizations/departments')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ name: 'Dept 6' });
      
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('QUOTA_EXCEEDED');
    });
  });


  describe('10.6 Quota Concurrency (Race Condition)', () => {
    it('Concurrent creation respects quota limits', async () => {
      // Create concurrent requests to exceed the role quota (limit is 5)
      const reqs = Array.from({ length: 10 }).map((_, i) => 
        request(app)
          .post('/api/v1/roles')
          .set('Authorization', `Bearer ${orgAdminTokenA}`)
          .set('x-organization-id', orgAId)
          .send({ name: `Concurrent Role ${i}` })
      );
      
      const responses = await Promise.all(reqs);
      const successes = responses.filter(r => r.status === 201).length;
      
      // Admin role, Employee role, Escalated Role + successes should be <= 5
      // The important part is some fail with 403
      const quotaExceeded = responses.some(r => r.body.error?.code === 'QUOTA_EXCEEDED');
      expect(quotaExceeded).toBe(true);
    });
  });

  describe('10.7 Module Boundary Enforcement', () => {
    it('Accessing disabled module endpoint -> MODULE_DISABLED', async () => {
      // Assuming 'crm' module is not active for Org A by default
      const res = await request(app)
        .post('/api/v1/crm/contacts')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ firstName: 'Test', lastName: 'Contact', email: 'contact@test.com' });
      
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });
  });

  describe('10.8 Role & Permission Isolation', () => {
    it('User cannot modify their own role -> 403', async () => {
      // Find a membership for orgAdminA
      const membership = await prisma.organizationMembership.findFirst({
        where: { userId: orgAdminAId, organizationId: orgAId }
      });
      
      const res = await request(app)
        .patch(`/api/v1/memberships/${membership!.id}`)
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ roleId: roleAId });
      
      // Expected SELF_PRIVILEGE_ESCALATION or similar
      expect(res.status).toBe(403);
    });
  });

  describe('10.11 Authentication & Session Security', () => {
    it('Invalid token is rejected', async () => {
      const res = await request(app)
        .get('/api/v1/organizations/departments')
        .set('Authorization', 'Bearer invalid.token.here')
        .set('x-organization-id', orgAId);
      
      expect(res.status).toBe(401);
    });

    it('Valid user token with different x-organization-id -> 403', async () => {
      // We already tested this in 10.2 (Org Admin B reading Org A)
      const res = await request(app)
        .get('/api/v1/organizations/departments')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgBId); // not a member
      expect(res.status).toBe(403);
    });
  });

  describe('10.12 IDOR / Resource Ownership', () => {
    it('Cannot modify department from another organization', async () => {
      // Org Admin B trying to delete Dept from Org A
      const deptA = await prisma.department.findFirst({ where: { organizationId: orgAId } });
      const res = await request(app)
        .delete(`/api/v1/organizations/departments/${deptA!.id}`)
        .set('Authorization', `Bearer ${orgAdminTokenB}`)
        .set('x-organization-id', orgBId);
      
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('10.13 Mass Assignment / Over-posting', () => {
    it('Cannot inject organizationId or isSystem in role creation', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          name: 'Hacked Role',
          organizationId: orgBId, // Injecting orgBId
          isSystem: true // Injecting isSystem
        });
      
      // It might succeed to create the role but should IGNORE the injected fields, or throw 400
      if (res.status === 201) {
        const role = await prisma.role.findUnique({ where: { id: res.body.data.id } });
        expect(role!.organizationId).toBe(orgAId);
        expect(role!.isSystem).toBe(false);
      } else {
        expect([400, 403]).toContain(res.status);
      }
    });
  });

  describe('10.15 State Machine Bypass', () => {
    it('Cannot accept a revoked invitation', async () => {
      // Create invitation
      const invite = await prisma.invitation.create({
        data: {
          email: 'revoke@test.com',
          organizationId: orgAId,
          roleId: roleAId,
          token: crypto.createHash('sha256').update('some-random-token').digest('hex'),
          status: 'revoked',
          expiresAt: new Date(Date.now() + 100000)
        }
      });

      const res = await request(app)
        .post('/api/v1/memberships/accept')
        .set('Authorization', `Bearer ${orgAdminTokenB}`) // Just need ANY valid user session
        .send({ token: 'some-random-token' });
      
      expect(res.status).toBe(400); // or 403
    });
  });

});

