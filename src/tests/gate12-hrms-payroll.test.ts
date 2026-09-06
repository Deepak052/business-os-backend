import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { AuditLogService } from '../services/audit.service';

describe('Gate 12 - Step 3: HRMS Payroll E2E Security', () => {
  let orgAId: string;
  let orgBId: string;

  let employeeUserToken: string;
  let employeeUserId: string;
  let employeeProfileId: string;
  
  let managerUserToken: string;
  let managerUserId: string;

  let orgBEmployeeUserToken: string;
  let orgBEmployeeUserId: string;
  
  let idorStubId: string;

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
        data: { id: 'hrms_module_pay', name: 'hrms', description: 'HRMS', version: '1.0', isGlobal: false, status: 'active' }
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Gate12 Pay Plan',
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
        orgName: 'Pay Org A',
        slug: 'pay-org-a',
        adminEmail: 'admin@pay-orga.com',
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
        orgName: 'Pay Org B',
        slug: 'pay-org-b',
        adminEmail: 'admin@pay-orgb.com',
        adminFirstName: 'Admin',
        adminLastName: 'OrgB',
        planId: plan.id
      });
    orgBId = resB.body.data.id;

    // 5. Create Roles in Org A
    const viewPerm = await prisma.permission.upsert({
      where: { id: 'hrms-payroll-view' },
      update: {},
      create: { id: 'hrms-payroll-view', action: 'hrms:payroll:view', resource: 'payroll', isDelegatable: true }
    });
    const managePerm = await prisma.permission.upsert({
      where: { id: 'hrms-payroll-manage' },
      update: {},
      create: { id: 'hrms-payroll-manage', action: 'hrms:payroll:manage', resource: 'payroll', isDelegatable: true }
    });

    employeeUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: employeeUserId, email: 'emp@pay-orga.com', firstName: 'Emp', lastName: 'A', passwordHash: 'hash' }
    });
    const orgAEmployeeRole = await prisma.role.create({
      data: { organizationId: orgAId, name: 'Employee', isSystem: false, permissions: { create: [{ permissionId: viewPerm.id }] } }
    });
    await prisma.organizationMembership.create({
      data: { organizationId: orgAId, userId: employeeUserId, status: 'active', roles: { create: [{ roleId: orgAEmployeeRole.id }] } }
    });
    
    const sessionEmp = await prisma.session.create({ data: { userId: employeeUserId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
    employeeUserToken = jwt.sign({ id: employeeUserId, sessionId: sessionEmp.id, organizationId: orgAId, role: 'user' }, env.JWT_SECRET, { expiresIn: '1h' });

    managerUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: managerUserId, email: 'mgr@pay-orga.com', firstName: 'Mgr', lastName: 'A', passwordHash: 'hash' }
    });
    const orgAManagerRole = await prisma.role.create({
      data: { organizationId: orgAId, name: 'Manager', isSystem: false, permissions: { create: [{ permissionId: viewPerm.id }, { permissionId: managePerm.id }] } }
    });
    await prisma.organizationMembership.create({
      data: { organizationId: orgAId, userId: managerUserId, status: 'active', roles: { create: [{ roleId: orgAManagerRole.id }] } }
    });
    
    const sessionMgr = await prisma.session.create({ data: { userId: managerUserId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
    managerUserToken = jwt.sign({ id: managerUserId, sessionId: sessionMgr.id, organizationId: orgAId, role: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });

    // 6. Create Roles in Org B
    orgBEmployeeUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: orgBEmployeeUserId, email: 'emp@pay-orgb.com', firstName: 'Emp', lastName: 'B', passwordHash: 'hash' }
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

    // IDOR target
    const stub = await prisma.hrmsPayrollStub.create({
      data: {
        organizationId: orgAId,
        employeeId: employeeProfileId,
        periodStart: new Date(),
        periodEnd: new Date(),
        grossPay: 5000,
        netPay: 4000,
        deductions: 1000,
        status: 'draft'
      }
    });
    idorStubId = stub.id;
  });

  describe('1. Payroll Lifecycle & RBAC', () => {
    it('should reject stub creation without hrms:payroll:manage', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/payroll')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({
          employeeId: employeeProfileId,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          grossPay: 5000,
          netPay: 4000,
          deductions: 1000
        });

      expect(res.status).toBe(403);
    });

    it('should allow manager to create draft stub', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/payroll')
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({
          employeeId: employeeProfileId,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          grossPay: 5000,
          netPay: 4000,
          deductions: 1000
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('draft');
    });

    it('should allow employee to view own stub', async () => {
      const res = await request(app)
        .get(`/api/v1/hrms/payroll/${idorStubId}`)
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.grossPay).toBe(5000);
    });

    it('should prevent manager from viewing employee stub through viewOwn endpoint', async () => {
      // Because viewOwn only allows viewing your own. The manager does not own it.
      const res = await request(app)
        .get(`/api/v1/hrms/payroll/${idorStubId}`)
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(403); // They are not the owner
    });

    it('should allow manager to pay a stub', async () => {
      const res = await request(app)
        .post(`/api/v1/hrms/payroll/${idorStubId}/pay`)
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
    });

    it('should prevent employee from paying a stub', async () => {
      const res = await request(app)
        .post(`/api/v1/hrms/payroll/${idorStubId}/pay`)
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(403);
    });

    it('should reject paying an already paid stub', async () => {
      const res = await request(app)
        .post(`/api/v1/hrms/payroll/${idorStubId}/pay`)
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });
  });

  describe('1.5. GET Endpoints & RBAC', () => {
    it('should allow employee to get their own payrolls', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/payroll/me')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject viewing all payrolls without hrms:payroll:view', async () => {
      const noViewUserId = crypto.randomUUID();
      await prisma.user.create({
        data: { id: noViewUserId, email: 'noview@pay-orga.com', firstName: 'No', lastName: 'View', passwordHash: 'hash' }
      });
      const noViewRole = await prisma.role.create({
        data: { organizationId: orgAId, name: 'NoView', isSystem: false }
      });
      await prisma.organizationMembership.create({
        data: { organizationId: orgAId, userId: noViewUserId, status: 'active', roles: { create: [{ roleId: noViewRole.id }] } }
      });
      
      const sessionNoView = await prisma.session.create({ data: { userId: noViewUserId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
      const noViewToken = jwt.sign({ id: noViewUserId, sessionId: sessionNoView.id, organizationId: orgAId, role: 'user' }, env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/v1/hrms/payroll')
        .set('Authorization', `Bearer ${noViewToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(403);
    });

    it('should allow manager to view all payrolls', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/payroll')
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('2. Tenant Isolation & IDOR', () => {
    it('should prevent Org B manager from accessing Org A stub', async () => {
      const res = await request(app)
        .post(`/api/v1/hrms/payroll/${idorStubId}/pay`)
        .set('Authorization', `Bearer ${orgBEmployeeUserToken}`) // They have manage permission in Org B
        .set('x-organization-id', orgBId)
        .send();

      expect(res.status).toBe(404); // Scoped to organizationId
    });
  });

  describe('3. Transaction Atomicity', () => {
    it('should rollback stub creation if audit log fails', async () => {
      const originalLog = AuditLogService.log;
      (AuditLogService as any).log = jest.fn().mockImplementation(() => {
        throw new Error('Forced Audit Failure');
      });

      const initialCount = await prisma.hrmsPayrollStub.count({
        where: { employeeId: employeeProfileId }
      });

      const res = await request(app)
        .post('/api/v1/hrms/payroll')
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({
          employeeId: employeeProfileId,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          grossPay: 5000,
          netPay: 4000,
          deductions: 1000
        });

      expect(res.status).toBe(500);

      const finalCount = await prisma.hrmsPayrollStub.count({
        where: { employeeId: employeeProfileId }
      });
      expect(finalCount).toBe(initialCount);

      AuditLogService.log = originalLog;
    });
  });
});
