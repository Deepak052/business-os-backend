import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { AuditLogService } from '../services/audit.service';

describe('Gate 12 - Step 3: HRMS Attendance E2E Security', () => {
  let orgAId: string;
  let orgBId: string;

  let employeeUserToken: string;
  let employeeUserId: string;
  let employeeProfileId: string;
  
  let managerUserToken: string;
  let managerUserId: string;

  let orgBEmployeeUserToken: string;
  let orgBEmployeeUserId: string;
  let orgBIdorAttendanceId: string;

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
        data: { id: 'hrms_module_att', name: 'hrms', description: 'HRMS', version: '1.0', isGlobal: false, status: 'active' }
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Gate12 Att Plan',
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
        orgName: 'Att Org A',
        slug: 'att-org-a',
        adminEmail: 'admin@att-orga.com',
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
        orgName: 'Att Org B',
        slug: 'att-org-b',
        adminEmail: 'admin@att-orgb.com',
        adminFirstName: 'Admin',
        adminLastName: 'OrgB',
        planId: plan.id
      });
    orgBId = resB.body.data.id;

    // 5. Create Roles in Org A
    const viewPerm = await prisma.permission.upsert({
      where: { id: 'hrms-attendance-view' },
      update: {},
      create: { id: 'hrms-attendance-view', action: 'hrms:attendance:view', resource: 'attendance', isDelegatable: true }
    });
    const managePerm = await prisma.permission.upsert({
      where: { id: 'hrms-attendance-manage' },
      update: {},
      create: { id: 'hrms-attendance-manage', action: 'hrms:attendance:manage', resource: 'attendance', isDelegatable: true }
    });

    employeeUserId = crypto.randomUUID();
    await prisma.user.create({
      data: { id: employeeUserId, email: 'emp@att-orga.com', firstName: 'Emp', lastName: 'A', passwordHash: 'hash' }
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
      data: { id: managerUserId, email: 'mgr@att-orga.com', firstName: 'Mgr', lastName: 'A', passwordHash: 'hash' }
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
      data: { id: orgBEmployeeUserId, email: 'emp@att-orgb.com', firstName: 'Emp', lastName: 'B', passwordHash: 'hash' }
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
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const idorAtt = await prisma.hrmsAttendance.create({
      data: {
        organizationId: orgAId,
        employeeId: employeeProfileId,
        date: yesterday,
        clockIn: yesterday,
        clockOut: yesterday,
        status: 'present'
      }
    });
    orgBIdorAttendanceId = idorAtt.id;
  });

  describe('1. Attendance Clock-in & Clock-out Constraints', () => {
    it('should reject clock-out if not clocked in', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/attendance/clock-out')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE');
    });

    it('should allow active employee to clock in', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/attendance/clock-in')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.employeeId).toBe(employeeProfileId);
    });

    it('should prevent duplicate clock-in (while already clocked in)', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/attendance/clock-in')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(400); // Invalid state
    });

    it('should allow employee to clock out', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/attendance/clock-out')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.clockOut).not.toBeNull();
    });

    it('should prevent second clock-in for the same day', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/attendance/clock-in')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('1.5. GET Endpoints & RBAC', () => {
    it('should allow employee to get their own attendance', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/attendance/me')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject viewing all attendance without hrms:attendance:view', async () => {
      // Create user without view permission
      const noViewUserId = crypto.randomUUID();
      await prisma.user.create({
        data: { id: noViewUserId, email: 'noview@att-orga.com', firstName: 'No', lastName: 'View', passwordHash: 'hash' }
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
        .get('/api/v1/hrms/attendance')
        .set('Authorization', `Bearer ${noViewToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(403);
    });

    it('should allow manager to view all attendance', async () => {
      const res = await request(app)
        .get('/api/v1/hrms/attendance')
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send();

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('2. Manager Override & RBAC', () => {
    it('should reject manager override by employee', async () => {
      const res = await request(app)
        .put(`/api/v1/hrms/attendance/${orgBIdorAttendanceId}`)
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({ status: 'absent' });

      expect(res.status).toBe(403);
    });

    it('should allow manager to correct attendance', async () => {
      const res = await request(app)
        .put(`/api/v1/hrms/attendance/${orgBIdorAttendanceId}`)
        .set('Authorization', `Bearer ${managerUserToken}`)
        .set('x-organization-id', orgAId)
        .send({ status: 'half_day', notes: 'Corrected by manager' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('half_day');
      expect(res.body.data.notes).toBe('Corrected by manager');
    });
  });

  describe('3. Tenant Isolation & IDOR', () => {
    it('should prevent Org B user from correcting Org A attendance', async () => {
      const res = await request(app)
        .put(`/api/v1/hrms/attendance/${orgBIdorAttendanceId}`)
        .set('Authorization', `Bearer ${orgBEmployeeUserToken}`)
        .set('x-organization-id', orgBId)
        .send({ status: 'late' });

      expect(res.status).toBe(404);
    });
  });

  describe('4. Transaction Atomicity & Concurrency', () => {
    it('should rollback clock-in if audit log fails', async () => {
      const initialCount = await prisma.hrmsAttendance.count({
        where: { employeeId: employeeProfileId }
      });

      // Clear today's attendance so we can try clocking in
      await prisma.hrmsAttendance.deleteMany({
        where: { employeeId: employeeProfileId, date: { gt: new Date(new Date().setUTCHours(0,0,0,0) - 1000) } }
      });

      const originalLog = AuditLogService.log;
      (AuditLogService as any).log = jest.fn().mockImplementation(() => {
        throw new Error('Forced Audit Failure');
      });

      const res = await request(app)
        .post('/api/v1/hrms/attendance/clock-in')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .set('x-organization-id', orgAId)
        .send({});

      expect(res.status).toBe(500);

      // Verify no record was kept
      const currentCount = await prisma.hrmsAttendance.count({
        where: { employeeId: employeeProfileId }
      });
      expect(currentCount).toBe(initialCount - 1);

      AuditLogService.log = originalLog;
    });

    it('should prevent concurrent clock-ins', async () => {
      // Clear today's attendance so we can try clocking in
      await prisma.hrmsAttendance.deleteMany({
        where: { employeeId: employeeProfileId, date: { gt: new Date(new Date().setUTCHours(0,0,0,0) - 1000) } }
      });

      // Fire 5 requests concurrently
      const requests = Array.from({ length: 5 }).map(() =>
        request(app)
          .post('/api/v1/hrms/attendance/clock-in')
          .set('Authorization', `Bearer ${employeeUserToken}`)
          .set('x-organization-id', orgAId)
          .send({})
      );

      const responses = await Promise.all(requests);

      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409 || r.status === 400);

      // Only ONE request should succeed
      expect(successes.length).toBe(1);
      // The rest should fail with either 400 (already clocked in check) or 409 (serializable transaction failure)
      expect(conflicts.length).toBe(4);
    });
  });
});
