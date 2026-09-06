import { Request, Response } from 'express';
import { prisma } from '../../../utils/prisma';
import { AuditLogService } from '../../../services/audit.service';
import { z } from 'zod';
import { AuthRequest } from '../../../middlewares/auth.middleware';

const createProfileSchema = z.object({
  userId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  jobTitle: z.string().min(1),
  employmentType: z.enum(['full_time', 'part_time', 'contractor']),
  startDate: z.string().datetime()
});

const updateProfileSchema = z.object({
  departmentId: z.string().uuid().optional(),
  jobTitle: z.string().min(1).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contractor']).optional(),
});

const statusChangeSchema = z.object({
  status: z.enum(['active', 'on_leave', 'terminated'])
});

export class HrmsEmployeeController {
  
  static async list(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    
    const employees = await prisma.hrmsEmployeeProfile.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } }
      }
    });

    res.json({ data: employees });
  }

  static async getById(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const id = String(req.params.id);
    
    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { id, organizationId: orgId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } }
      }
    });

    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee profile not found' } });
    }

    res.json({ data: employee });
  }

  static async create(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    
    const parseRes = createProfileSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    }
    
    const { userId, departmentId, jobTitle, employmentType, startDate } = parseRes.data;

    // Verify user is in org
    const membership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } }
    });

    if (!membership || membership.status !== 'active') {
      return res.status(400).json({ error: { code: 'INVALID_MEMBERSHIP', message: 'User must have an active membership in this organization' } });
    }

    // Verify no existing profile
    const existing = await prisma.hrmsEmployeeProfile.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } }
    });

    if (existing) {
      return res.status(400).json({ error: { code: 'PROFILE_EXISTS', message: 'Employee profile already exists for this user' } });
    }

    // Atomicity
    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.hrmsEmployeeProfile.create({
        data: {
          organizationId: orgId,
          userId,
          departmentId,
          jobTitle,
          employmentType,
          startDate: new Date(startDate),
          status: 'active'
        }
      });

      await AuditLogService.log({
        organizationId: orgId,
        userId: String(req.user!.id),
        action: 'hrms:employee:created',
        targetType: 'hrms_employee',
        targetId: emp.id,
        status: 'success'
      }, tx);

      return emp;
    });

    res.status(201).json({ data: employee });
  }

  static async update(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const id = String(req.params.id);

    const parseRes = updateProfileSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    }

    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee profile not found' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.hrmsEmployeeProfile.update({
        where: { id },
        data: parseRes.data
      });

      await AuditLogService.log({
        organizationId: orgId,
        userId: String(req.user!.id),
        action: 'hrms:employee:updated',
        targetType: 'hrms_employee',
        targetId: emp.id,
        status: 'success'
      }, tx);

      return emp;
    });

    res.json({ data: updated });
  }

  static async updateStatus(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const id = String(req.params.id);

    const parseRes = statusChangeSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
    }

    const newStatus = parseRes.data.status;

    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee profile not found' } });
    }

    // Enforce legal transitions
    const current = employee.status;
    let allowed = false;

    if (current === 'active' && (newStatus === 'on_leave' || newStatus === 'terminated')) allowed = true;
    if (current === 'on_leave' && (newStatus === 'active' || newStatus === 'terminated')) allowed = true;
    // Cannot transition OUT of terminated
    
    if (!allowed) {
      return res.status(400).json({ error: { code: 'INVALID_TRANSITION', message: `Cannot transition status from ${current} to ${newStatus}` } });
    }

    const actionKey = newStatus === 'terminated' ? 'hrms:employee:terminated' : 'hrms:employee:status_changed';

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.hrmsEmployeeProfile.update({
        where: { id },
        data: { status: newStatus }
      });

      await AuditLogService.log({
        organizationId: orgId,
        userId: String(req.user!.id),
        action: actionKey,
        targetType: 'hrms_employee',
        targetId: emp.id,
        status: 'success'
      }, tx);

      return emp;
    });

    res.json({ data: updated });
  }
}
