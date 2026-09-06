import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { AuditLogService } from '../services/audit.service';

describe('Gate 12 - Step 2: HRMS Leave Management E2E Security', () => {
  let orgAId: string;
  let orgBId: string;
  
  let employeeUserToken: string;
  let employeeUserId: string;
  let employeeProfileId: string;

  let managerUserToken: string;
  let managerUserId: string;

  let orgBEmployeeUserToken: string;
  let orgBEmployeeUserId: string;

  beforeAll(async () => {
    // 1. Clean DB
    await prisma.hrmsPayrollStub.deleteMany();
    await prisma.hrmsAttendance.deleteMany();
    await prisma.hrmsLeaveRequest.deleteMany();
    await prisma.hrmsEmployeeProfile.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.membershipRole.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.organization.deleteMany();

    // 2. Setup Modules & Plans
    let hrmsModule = await prisma.module.findFirst({ where: { name: 'hrms' } });
    if (!hrmsModule) {
      hrmsModule = await prisma.module.create({
        data: { id: 'hrms_module_leave', name: 'hrms', description: 'HRMS', version: '1.0', isGlobal: false, status: 'active' }
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Gate12 Leave Plan',
        price: 50,
        isActive: true,
        entitlements: {
          create: [
            { limitKey: 'max_users', limitValue: 10 },
            { moduleId: hrmsModule.id }
          ]
        }
      }
    });

    // 3. Provision Org A
    const superAdminUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: superAdminUserId, email: env.SUPERADMIN_EMAIL, firstName: 'Super', lastName: 'Admin', passwordHash: 'hash', isActive: true }
    });
    const superAdminSession = await prisma.session.create({
      data: { userId: superAdminUserId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) }
    });
    const superAdminToken = jwt.sign({ id: superAdminUserId, sessionId: superAdminSession.id }, env.JWT_SECRET, { expiresIn: '1h' });
    
    const resA = await request(app)
      .post('/api/v1/admin/organizations/provision')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        orgName: 'Leave Org A',
        slug: 'leave-org-a',
        adminEmail: 'admin@leave-orga.com',
        adminFirstName: 'Admin',
        adminLastName: 'OrgA',
        planId: plan.id
      });
    orgAId = resA.body.data.id;

    // 4. Provision Org B
    const resB = await request(app)
      .post('/api/v1/admin/organizations/provision')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        orgName: 'Leave Org B',
        slug: 'leave-org-b',
        adminEmail: 'admin@leave-orgb.com',
        adminFirstName: 'Admin',
        adminLastName: 'OrgB',
        planId: plan.id
      });
    orgBId = resB.body.data.id;

    // 5. Create Roles in Org A
    const viewPerm = await prisma.permission.upsert({
      where: { id: 'hrms-leave-view' },
      update: {},
      create: { id: 'hrms-leave-view', action: 'hrms:leave:view', resource: 'leave', isDelegatable: true }
    });
    const managePerm = await prisma.permission.upsert({
      where: { id: 'hrms-leave-manage' },
      update: {},
      create: { id: 'hrms-leave-manage', action: 'hrms:leave:manage', resource: 'leave', isDelegatable: true }
    });

    const employeeRole = await prisma.role.create({
      data: {
        organizationId: orgAId,
        name: 'Employee',
        isSystem: false,
        permissions: { create: [{ permissionId: viewPerm.id }] }
      }
    });

    const managerRole = await prisma.role.create({
      data: {
        organizationId: orgAId,
        name: 'Manager',
        isSystem: false,
        permissions: { create: [{ permissionId: viewPerm.id }, { permissionId: managePerm.id }] }
      }
    });

    // 6. Create Users & Memberships
    // Employee User
    employeeUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: employeeUserId, email: 'emp@orga.com', firstName: 'Emp', lastName: 'A', passwordHash: 'hash' }
    });
    
    await prisma.organizationMembership.create({
      data: { organizationId: orgAId, userId: employeeUserId, status: 'active', roles: { create: [{ roleId: employeeRole.id }] } }
    });
    
    const sessionEmp = await prisma.session.create({ data: { userId: employeeUserId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
    employeeUserToken = jwt.sign({ id: employeeUserId, sessionId: sessionEmp.id, organizationId: orgAId, role: 'user' }, env.JWT_SECRET, { expiresIn: '1h' });

    // Manager User
    managerUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: managerUserId, email: 'mgr@orga.com', firstName: 'Mgr', lastName: 'A', passwordHash: 'hash' }
    });
    await prisma.organizationMembership.create({
      data: { organizationId: orgAId, userId: managerUserId, status: 'active', roles: { create: [{ roleId: managerRole.id }] } }
    });
    
    const sessionMgr = await prisma.session.create({ data: { userId: managerUserId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
    managerUserToken = jwt.sign({ id: managerUserId, sessionId: sessionMgr.id, organizationId: orgAId, role: 'user' }, env.JWT_SECRET, { expiresIn: '1h' });

    // Org B Employee User
    orgBEmployeeUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: orgBEmployeeUserId, email: 'emp@orgb.com', firstName: 'Emp', lastName: 'B', passwordHash: 'hash' }
    });
    const orgBRole = await prisma.role.create({
      data: { organizationId: orgBId, name: 'Employee', isSystem: false, permissions: { create: [{ permissionId: viewPerm.id }, { permissionId: managePerm.id }] } }
    });
    await prisma.organizationMembership.create({
      data: { organizationId: orgBId, userId: orgBEmployeeUserId, status: 'active', roles: { create: [{ roleId: orgBRole.id }] } }
    });
    
    const sessionOrgBEmp = await prisma.session.create({ data: { userId: orgBEmployeeUserId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
    orgBEmployeeUserToken = jwt.sign({ id: orgBEmployeeUserId, sessionId: sessionOrgBEmp.id, organizationId: orgBId, role: 'user' }, env.JWT_SECRET, { expiresIn: '1h' });

    // 7. Create Employee Profiles
    const profileA = await prisma.hrmsEmployeeProfile.create({
      data: {
        organizationId: orgAId,
        userId: employeeUserId,
        jobTitle: 'Developer',
        employmentType: 'full_time',
        startDate: new Date(),
        status: 'active'
      }
    });
    employeeProfileId = profileA.id;

    await prisma.hrmsEmployeeProfile.create({
      data: {
        organizationId: orgBId,
        userId: orgBEmployeeUserId,
        jobTitle: 'Developer',
        employmentType: 'full_time',
        startDate: new Date(),
        status: 'active'
      }
    });
  });

  describe('1. Leave Creation & Constraints', () => {
    it('should reject leave creation if not active employee', async () => {
      // Create an inactive employee profile
      const inactiveProfile = await prisma.hrmsEmployeeProfile.create({
        data: {
          organizationId: orgAId,
          userId: managerUserId,
          jobTitle: 'Manager',
          employmentType: 'full_time',
          startDate: new Date(),
          status: 'terminated'
        }
      });

      const res = await request(app)
        .post('/api/v1/hrms/leaves')
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({
          employeeId: inactiveProfile.id,
          leaveType: 'sick',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('should reject leave creation for another employee', async () => {
      // We can just use the managerUserId directly, they already have an active profile from beforeAll (wait, no, they have an inactive profile, let's just make it active for this test, or create a new user entirely!)
      // Since managerUserId already has an inactive profile, let's just update it to active so we can try to create a leave for them.
      await prisma.hrmsEmployeeProfile.update({
        where: { organizationId_userId: { organizationId: orgAId, userId: managerUserId } },
        data: { status: 'active' }
      });

      const res = await request(app)
        .post('/api/v1/hrms/leaves')
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({
          employeeId: employeeProfileId,
          leaveType: 'sick',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow active employee to create leave for themselves', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/leaves')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({
          employeeId: employeeProfileId,
          leaveType: 'vacation',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
      
      const logs = await prisma.auditLog.findMany({ where: { targetId: res.body.data.id } });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('LEAVE_REQUEST_CREATED');
    });
  });

  describe('2. State Machine & RBAC', () => {
    let pendingLeaveId: string;

    beforeEach(async () => {
      const leave = await prisma.hrmsLeaveRequest.create({
        data: {
          organizationId: orgAId,
          employeeId: employeeProfileId,
          leaveType: 'sick',
          startDate: new Date(),
          endDate: new Date(),
          status: 'pending'
        }
      });
      pendingLeaveId = leave.id;
    });

    it('should reject approval without hrms:leave:manage permission', async () => {
      const res = await request(app)
        .post(`/api/v1/hrms/leaves/${pendingLeaveId}/approve`)
        .set('Authorization', `Bearer ${employeeUserToken}`) // No manage permission
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should allow manager to approve pending leave', async () => {
      const res = await request(app)
        .post(`/api/v1/hrms/leaves/${pendingLeaveId}/approve`)
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');

      const logs = await prisma.auditLog.findMany({ where: { targetId: pendingLeaveId, action: 'LEAVE_REQUEST_APPROVED' } });
      expect(logs.length).toBe(1);
    });

    it('should reject state transitions from APPROVED -> REJECTED', async () => {
      // Setup approved leave
      await prisma.hrmsLeaveRequest.update({ where: { id: pendingLeaveId }, data: { status: 'approved' } });

      const res = await request(app)
        .post(`/api/v1/hrms/leaves/${pendingLeaveId}/reject`)
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('should reject state transitions from REJECTED -> APPROVED', async () => {
      // Setup rejected leave
      await prisma.hrmsLeaveRequest.update({ where: { id: pendingLeaveId }, data: { status: 'rejected' } });

      const res = await request(app)
        .post(`/api/v1/hrms/leaves/${pendingLeaveId}/approve`)
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });
  });

  describe('3. Tenant Isolation & IDOR', () => {
    let orgALeaveId: string;

    beforeAll(async () => {
      const leave = await prisma.hrmsLeaveRequest.create({
        data: {
          organizationId: orgAId,
          employeeId: employeeProfileId,
          leaveType: 'personal',
          startDate: new Date(),
          endDate: new Date(),
          status: 'pending'
        }
      });
      orgALeaveId = leave.id;
    });

    it('should prevent Org B user from accessing Org A leave request', async () => {
      const res = await request(app)
        .post(`/api/v1/hrms/leaves/${orgALeaveId}/approve`)
        .set('Authorization', `Bearer ${orgBEmployeeUserToken}`)
        .set('x-organization-id', orgBId)
        .send({});

      expect(res.status).toBe(404); // Should be 404 because orgId is scoped
    });
  });

  describe('4. Transaction Atomicity', () => {
    it('should rollback leave creation if audit log fails', async () => {
      const initialLeavesCount = await prisma.hrmsLeaveRequest.count({
        where: { employeeId: employeeProfileId, leaveType: 'personal' }
      });

      const originalLog = AuditLogService.log;
      
      // Mock log to throw error
      (AuditLogService as any).log = jest.fn().mockImplementation(() => {
        throw new Error('Forced Audit Failure');
      });

      const res = await request(app)
        .post('/api/v1/hrms/leaves')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({
          employeeId: employeeProfileId,
          leaveType: 'personal',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        });

      // API should fail (500)
      expect(res.status).toBe(500);
      
      // Verify no leave was created! (Rollback)
      const leavesCount = await prisma.hrmsLeaveRequest.count({
        where: { employeeId: employeeProfileId, leaveType: 'personal' }
      });
      expect(leavesCount).toBe(initialLeavesCount);

      // Restore
      AuditLogService.log = originalLog;
    });
  });
});
