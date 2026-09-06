import request from 'supertest';
import { app } from '../app';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import crypto from 'crypto';

describe('Gate 12 - Step 1: HRMS Employee E2E Security', () => {
  let superAdminToken: string;
  let superAdminId: string;
  
  let orgAdminTokenA: string;
  let orgAdminTokenB: string;
  
  let orgAdminAId: string;
  let orgAdminBId: string;
  let employeeUserAId: string;
  
  let orgAId: string;
  let orgBId: string;
  
  let planId: string;

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
    let hrmsModule = await prisma.module.findFirst({ where: { name: 'hrms' } });
    if (!hrmsModule) {
      hrmsModule = await prisma.module.create({
        data: { id: 'hrms_module_new', name: 'hrms', description: 'HRMS', version: '1.0', isGlobal: false, status: 'active' }
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Gate12 Plan',
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
    planId = plan.id;

    // 3. Provision Org A and B
    const resA = await request(app)
      .post('/api/v1/admin/organizations/provision')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ orgName: 'Org A', slug: 'org-a-12', adminEmail: 'adminA12@test.com', adminFirstName: 'Admin', adminLastName: 'A', planId });
    orgAId = resA.body.data.id;
    const adminUserA = await prisma.user.findUnique({ where: { email: 'adminA12@test.com' } });
    orgAdminAId = adminUserA!.id;
    const sessionA = await prisma.session.create({ data: { userId: orgAdminAId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
    orgAdminTokenA = jwt.sign({ id: orgAdminAId, sessionId: sessionA.id, organizationId: orgAId }, env.JWT_SECRET, { expiresIn: '1h' });

    const resB = await request(app)
      .post('/api/v1/admin/organizations/provision')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ orgName: 'Org B', slug: 'org-b-12', adminEmail: 'adminB12@test.com', adminFirstName: 'Admin', adminLastName: 'B', planId });
    orgBId = resB.body.data.id;
    const adminUserB = await prisma.user.findUnique({ where: { email: 'adminB12@test.com' } });
    orgAdminBId = adminUserB!.id;
    const sessionB = await prisma.session.create({ data: { userId: orgAdminBId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 100000) } });
    orgAdminTokenB = jwt.sign({ id: orgAdminBId, sessionId: sessionB.id, organizationId: orgBId }, env.JWT_SECRET, { expiresIn: '1h' });
    
    const roleA = await prisma.role.create({
      data: { name: 'Employee Role', organizationId: orgAId, isSystem: false }
    });

    // Create Employee User A inside Org A
    const empUserA = await prisma.user.create({
      data: {
        email: 'employee12@test.com',
        firstName: 'Emp',
        lastName: 'A',
        passwordHash: await bcrypt.hash('Password@123', 10),
        isActive: true
      }
    });
    employeeUserAId = empUserA.id;
    
    await prisma.organizationMembership.create({
      data: {
        userId: employeeUserAId,
        organizationId: orgAId,
        status: 'active'
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.hrmsPayrollStub.deleteMany();
    await prisma.hrmsAttendance.deleteMany();
    await prisma.hrmsLeaveRequest.deleteMany();
    await prisma.hrmsEmployeeProfile.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.membershipRole.deleteMany();
    await prisma.organizationMembership.deleteMany();
    await prisma.session.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    await prisma.subscriptionPlan.deleteMany();
    await prisma.subscriptionPlan.create({ data: { name: 'Basic', price: 0, isDefault: true } });
  });

  describe('Employee CRUD & Lifecycle', () => {
    let employeeProfileId: string;

    it('should prevent creating employee profile without hrms:employee:manage permission', async () => {
      // Assuming a normal member doesn't have it
      // Let's create a member token
      const sessionEmp = await prisma.session.create({ data: { userId: employeeUserAId, token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 10000) } });
      const empToken = jwt.sign({ id: employeeUserAId, sessionId: sessionEmp.id, organizationId: orgAId }, env.JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .post('/api/v1/hrms/employees')
        .set('Authorization', `Bearer ${empToken}`)
        .set('x-organization-id', orgAId)
        .send({
          userId: employeeUserAId,
          jobTitle: 'Software Engineer',
          employmentType: 'full_time',
          startDate: new Date().toISOString()
        });
      expect(res.status).toBe(403);
    });

    it('should create an employee profile successfully with active membership', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/employees')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          userId: employeeUserAId,
          jobTitle: 'Software Engineer',
          employmentType: 'full_time',
          startDate: new Date().toISOString()
        });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('active');
      employeeProfileId = res.body.data.id;
      
      // Check audit log
      const audit = await prisma.auditLog.findFirst({ where: { targetId: employeeProfileId, action: 'hrms:employee:created' } });
      expect(audit).toBeDefined();
    });

    it('should prevent duplicate employee profiles for the same user in same org', async () => {
      const res = await request(app)
        .post('/api/v1/hrms/employees')
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          userId: employeeUserAId,
          jobTitle: 'Data Scientist',
          employmentType: 'full_time',
          startDate: new Date().toISOString()
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROFILE_EXISTS');
    });

    it('should not allow mass-assignment of status during update', async () => {
      const res = await request(app)
        .patch(`/api/v1/hrms/employees/${employeeProfileId}`)
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({
          jobTitle: 'Senior Engineer',
          status: 'terminated' // Should be ignored by zod schema or fail
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.jobTitle).toBe('Senior Engineer');
      expect(res.body.data.status).toBe('active'); // Status remains unchanged
    });

    it('should transition status ACTIVE -> ON_LEAVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/hrms/employees/${employeeProfileId}/status`)
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ status: 'on_leave' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('on_leave');
    });

    it('should transition status ON_LEAVE -> ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/hrms/employees/${employeeProfileId}/status`)
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ status: 'active' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
    });

    it('should transition status ACTIVE -> TERMINATED', async () => {
      const res = await request(app)
        .patch(`/api/v1/hrms/employees/${employeeProfileId}/status`)
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ status: 'terminated' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('terminated');
    });

    it('should reject invalid transition TERMINATED -> ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/hrms/employees/${employeeProfileId}/status`)
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId)
        .send({ status: 'active' });
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('Tenant Isolation & Identity Boundary', () => {
    it('should allow Org B to add the same global user (multi-org identity)', async () => {
        const roleB = await prisma.role.create({
          data: { name: 'Employee Role B', organizationId: orgBId, isSystem: false }
        });
        
        // Add same user to Org B (multi-org identity)
        await prisma.organizationMembership.create({
          data: { userId: employeeUserAId, organizationId: orgBId, status: 'active' }
        });
      
      // Create HRMS profile in Org B
      const res = await request(app)
        .post('/api/v1/hrms/employees')
        .set('Authorization', `Bearer ${orgAdminTokenB}`)
        .set('x-organization-id', orgBId)
        .send({
          userId: employeeUserAId,
          jobTitle: 'Consultant',
          employmentType: 'contractor',
          startDate: new Date().toISOString()
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.organizationId).toBe(orgBId);
    });

    it('should prevent Org A from accessing Org B employee profile', async () => {
      // Fetch Org B employee profile ID
      const empB = await prisma.hrmsEmployeeProfile.findFirst({ where: { organizationId: orgBId, userId: employeeUserAId } });

      const res = await request(app)
        .get(`/api/v1/hrms/employees/${empB!.id}`)
        .set('Authorization', `Bearer ${orgAdminTokenA}`)
        .set('x-organization-id', orgAId);
      
      expect(res.status).toBe(404);
    });

    it('disabling Core membership does not destroy HRMS history', async () => {
      // Disable membership in Org B
      await prisma.organizationMembership.update({
        where: { organizationId_userId: { organizationId: orgBId, userId: employeeUserAId } },
        data: { status: 'disabled' }
      });

      // Try creating new employee profile with inactive membership should fail
      const resNew = await request(app)
        .post('/api/v1/hrms/employees')
        .set('Authorization', `Bearer ${orgAdminTokenB}`)
        .set('x-organization-id', orgBId)
        .send({
          userId: employeeUserAId,
          jobTitle: 'Consultant 2',
          employmentType: 'contractor',
          startDate: new Date().toISOString()
        });
      
      expect(resNew.status).toBe(400);
      expect(resNew.body.error.code).toBe('INVALID_MEMBERSHIP');

      // But history is intact
      const empB = await prisma.hrmsEmployeeProfile.findFirst({ where: { organizationId: orgBId, userId: employeeUserAId } });
      expect(empB).not.toBeNull();
    });
  });
});

