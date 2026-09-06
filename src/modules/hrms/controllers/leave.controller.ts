import { Request, Response } from 'express';
import { prisma } from '../../../utils/prisma';
import { AuditLogService } from '../../../services/audit.service';
import { z } from 'zod';
import { AuthRequest } from '../../../middlewares/auth.middleware';

const createLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(['sick', 'vacation', 'personal']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().optional()
});

export class HrmsLeaveController {
  
  static async list(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    
    const leaves = await prisma.hrmsLeaveRequest.findMany({
      where: { organizationId: orgId },
      include: {
        employee: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
        }
      }
    });

    res.json({ data: leaves });
  }

  static async requestLeave(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    
    const parseRes = createLeaveSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    }
    
    const { employeeId, leaveType, startDate, endDate, reason } = parseRes.data;

    // Verify employee profile exists in this org
    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { id: employeeId, organizationId: orgId }
    });

    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee profile not found' } });
    }

    if (employee.status !== 'active') {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Employee is not active' } });
    }

    // Tenant / Identity check: user can only request leave for themselves
    if (employee.userId !== String(req.user!.id)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot request leave for another employee' } });
    }

    const leave = await prisma.$transaction(async (tx) => {
      const created = await tx.hrmsLeaveRequest.create({
        data: {
          organizationId: orgId,
          employeeId,
          leaveType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          reason,
          status: 'pending'
        }
      });

      await AuditLogService.log({
        organizationId: orgId,
        userId: String(req.user!.id),
        action: 'LEAVE_REQUEST_CREATED',
        targetType: 'hrms_leave',
        targetId: created.id,
        status: 'success'
      }, tx);

      return created;
    });

    res.status(201).json({ data: leave });
  }

  static async approve(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const id = String(req.params.id);

    const leave = await prisma.hrmsLeaveRequest.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!leave) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave request not found' } });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Leave request is already processed' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.hrmsLeaveRequest.update({
        where: { id },
        data: { status: 'approved' }
      });

      await AuditLogService.log({
        organizationId: orgId,
        userId: String(req.user!.id),
        action: 'LEAVE_REQUEST_APPROVED',
        targetType: 'hrms_leave',
        targetId: leave.id,
        status: 'success'
      }, tx);

      return result;
    });

    res.json({ data: updated });
  }

  static async reject(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const id = String(req.params.id);

    const leave = await prisma.hrmsLeaveRequest.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!leave) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave request not found' } });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Leave request is already processed' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.hrmsLeaveRequest.update({
        where: { id },
        data: { status: 'rejected' }
      });

      await AuditLogService.log({
        organizationId: orgId,
        userId: String(req.user!.id),
        action: 'LEAVE_REQUEST_REJECTED',
        targetType: 'hrms_leave',
        targetId: leave.id,
        status: 'success'
      }, tx);

      return result;
    });

    res.json({ data: updated });
  }
}
