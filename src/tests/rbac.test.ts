import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';

describe('RBAC Security Hardening Tests (Gate 6)', () => {
  let adminToken: string;
  let adminId: string;
  let orgId: string;
  let orgBId: string;

  let platformRole: any;
  let systemRole: any;
  let delegatablePermission: any;
  let nonDelegatablePermission: any;
  let unheldDelegatablePermission: any;

  beforeAll(async () => {
    // 1. Setup Permissions
    delegatablePermission = await prisma.permission.create({
      data: { action: 'manage:users', resource: 'users', isDelegatable: true }
    });
    unheldDelegatablePermission = await prisma.permission.create({
      data: { action: 'manage:billing', resource: 'billing', isDelegatable: true }
    });
    nonDelegatablePermission = await prisma.permission.create({
      data: { action: 'manage:platform', resource: 'platform', isDelegatable: false }
    });

    // 2. Setup Organizations & Subscription
    const org = await prisma.organization.create({ data: { name: 'Org A', slug: 'org-a' } });
    orgId = org.id;

    // Create a plan and subscription for org A
    const plan = await prisma.subscriptionPlan.create({
      data: { 
        name: 'Test Plan', 
        price: 0, 
        isActive: true,
        entitlements: {
          create: [
            { limitKey: 'max_users', limitValue: 100 },
            { limitKey: 'max_roles', limitValue: 10 }
          ]
        }
      }
    });
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    const orgB = await prisma.organization.create({ data: { name: 'Org B', slug: 'org-b' } });
    orgBId = orgB.id;

    // 3. Setup Roles
    platformRole = await prisma.role.create({
      data: {
        name: 'Platform Admin',
        organizationId: null, // Platform Role
        isSystem: true,
        permissions: { create: [{ permissionId: nonDelegatablePermission.id }] }
      }
    });

    systemRole = await prisma.role.create({
      data: {
        name: 'System Default Org Role',
        organizationId: orgId,
        isSystem: true,
        permissions: { create: [{ permissionId: delegatablePermission.id }] }
      }
    });

    const manageRolesPermission = await prisma.permission.create({
      data: { action: 'manage:roles', resource: 'roles', isDelegatable: true }
    });

    const manageMembershipsPermission = await prisma.permission.create({
      data: { action: 'manage:members', resource: 'memberships', isDelegatable: true }
    });

    const adminRole = await prisma.role.create({
      data: {
        name: 'Custom Admin',
        organizationId: orgId,
        isSystem: false,
        permissions: { 
          create: [
            { permissionId: delegatablePermission.id },
            { permissionId: manageRolesPermission.id },
            { permissionId: manageMembershipsPermission.id }
          ] 
        }
      }
    });

    // 4. Setup User & Membership
    const adminUser = await prisma.user.create({
      data: { email: 'admin@test.com', passwordHash: await bcrypt.hash('password', 10), isActive: true }
    });
    adminId = adminUser.id;

    const membership = await prisma.organizationMembership.create({
      data: { organizationId: orgId, userId: adminId }
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: adminRole.id }
    });

    // 5. Auth Token
    const session = await prisma.session.create({
      data: { userId: adminId, token: 'adminToken123', expiresAt: new Date(Date.now() + 100000) }
    });
    adminToken = require('jsonwebtoken').sign({ id: adminId, sessionId: session.id }, process.env.JWT_SECRET || 'secret');
  });

  afterAll(async () => {
    // Clean up
    await prisma.hrmsLeaveRequest.deleteMany();
    await prisma.hrmsAttendance.deleteMany();
    await prisma.hrmsPayrollStub.deleteMany();
    await prisma.hrmsEmployeeProfile.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.subscriptionPlan.create({ data: { name: 'Basic', price: 0, isDefault: true } });
    await prisma.membershipRole.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.permission.deleteMany();
  });

  describe('Role Creation & Editing', () => {
    it('should reject creating a role with non-delegatable permissions', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({
          name: 'Hacker Role',
          permissionIds: [nonDelegatablePermission.id]
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_NOT_DELEGATABLE');
    });

    it('should reject creating a role with delegatable permissions the admin does not possess', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({
          name: 'Sneaky Role',
          permissionIds: [unheldDelegatablePermission.id]
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_NOT_HELD');
    });

    it('should allow creating a role with permissions the admin does possess', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({
          name: 'Sub-Admin Role',
          permissionIds: [delegatablePermission.id]
        });

      if (res.status !== 201) console.error('CREATE ROLE FAILED:', res.body);
      expect(res.status).toBe(201);
    });

    it('should reject modification of system roles', async () => {
      const res = await request(app)
        .patch(`/api/v1/roles/${systemRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({ name: 'Hacked System Role' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SYSTEM_ROLE_PROTECTED');
    });

    it('should reject modification of platform roles from tenant namespace', async () => {
      const res = await request(app)
        .patch(`/api/v1/roles/${platformRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({ name: 'Hacked Platform Role' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PLATFORM_ROLE_FORBIDDEN');
    });
  });

  describe('Employee Role Assignment', () => {
    let dummyMembershipId: string;
    
    beforeAll(async () => {
      const dummyUser = await prisma.user.create({
        data: { email: 'dummy@test.com', passwordHash: 'hash', isActive: true }
      });
      const membership = await prisma.organizationMembership.create({
        data: { organizationId: orgId, userId: dummyUser.id }
      });
      dummyMembershipId = membership.id;
    });

    it('should reject assigning a platform role', async () => {
      const res = await request(app)
        .patch(`/api/v1/memberships/${dummyMembershipId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({ roleId: platformRole.id });

      if (res.status !== 403 || res.body.error.code !== 'PLATFORM_ROLE_FORBIDDEN') console.error('ASSIGN PLATFORM ROLE FAILED:', res.body);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PLATFORM_ROLE_FORBIDDEN');
    });

    it('should prevent self-escalation', async () => {
      // Find admin membership
      const adminMembership = await prisma.organizationMembership.findFirst({ where: { userId: adminId } });

      const res = await request(app)
        .patch(`/api/v1/memberships/${adminMembership!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({ roleId: systemRole.id }); // Even if systemRole is delegatable, cannot self-assign

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SELF_PRIVILEGE_ESCALATION');
    });

    it('should reject assigning a cross-tenant role', async () => {
      const crossTenantRole = await prisma.role.create({
        data: { name: 'Org B Role', organizationId: orgBId, isSystem: false }
      });

      const res = await request(app)
        .patch(`/api/v1/memberships/${dummyMembershipId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-organization-id', orgId)
        .send({ roleId: crossTenantRole.id });

      expect(res.status).toBe(404); // Returns 404 because role isn't found in current org namespace
    });
  });
});

