import { Request, Response } from 'express';
import { prisma } from '../../../utils/prisma';
import { AuditLogService } from '../../../services/audit.service';
import { z } from 'zod';
import { AuthRequest } from '../../../middlewares/auth.middleware';

const overrideSchema = z.object({
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  status: z.enum(['present', 'absent', 'late', 'half_day']).optional(),
  notes: z.string().optional()
});

export class HrmsAttendanceController {
  
  static async list(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    
    // Explicit authorization rule: hrms:attendance:view -> organization-scoped visibility
    // The middleware already asserts this permission.
    
    const records = await prisma.hrmsAttendance.findMany({
      where: { organizationId: orgId },
      include: {
        employee: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json({ data: records });
  }

  static async listMe(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    
    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { userId, organizationId: orgId }
    });

    if (!employee || employee.status !== 'active') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Employee is not active or does not exist' } });
    }

    const records = await prisma.hrmsAttendance.findMany({
      where: { 
        organizationId: orgId,
        employeeId: employee.id 
      },
      orderBy: { date: 'desc' }
    });

    res.json({ data: records });
  }

  static async clockIn(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    
    // Must be active employee
    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { userId, organizationId: orgId }
    });

    if (!employee || employee.status !== 'active') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Employee is not active or does not exist' } });
    }

    // Check for existing active clock-in for today (or any day without a clock out)
    const activeSession = await prisma.hrmsAttendance.findFirst({
      where: { 
        employeeId: employee.id, 
        organizationId: orgId,
        clockOut: null
      }
    });

    if (activeSession) {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Already clocked in' } });
    }

    const today = new Date();
    today.setUTCHours(0,0,0,0);

    // Prevent duplicate attendance records for the same day
    const existingToday = await prisma.hrmsAttendance.findFirst({
      where: {
        employeeId: employee.id,
        organizationId: orgId,
        date: today
      }
    });

    if (existingToday) {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Already have an attendance record for today' } });
    }

    try {
      const attendance = await prisma.$transaction(async (tx) => {
        const created = await tx.hrmsAttendance.create({
          data: {
            organizationId: orgId,
            employeeId: employee.id,
            date: today,
            clockIn: new Date(),
            status: 'present'
          }
        });

        await AuditLogService.log({
          organizationId: orgId,
          userId,
          action: 'ATTENDANCE_CLOCKED_IN',
          targetType: 'hrms_attendance',
          targetId: created.id,
          status: 'success'
        }, tx);

        return created;
      }, { isolationLevel: 'Serializable' });

      res.status(201).json({ data: attendance });
    } catch (error: any) {
      if (error.code === 'P2034' || error.message.includes('concurrent') || error.code === 'P2002') {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Concurrency conflict or duplicate clock-in' } });
      }
      throw error;
    }
  }

  static async clockOut(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    
    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { userId, organizationId: orgId }
    });

    if (!employee || employee.status !== 'active') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Employee is not active' } });
    }

    try {
      const attendance = await prisma.$transaction(async (tx) => {
        const activeSession = await tx.hrmsAttendance.findFirst({
          where: { 
            employeeId: employee.id, 
            organizationId: orgId,
            clockOut: null
          }
        });

        if (!activeSession) {
          throw new Error('NOT_CLOCKED_IN');
        }

        const updated = await tx.hrmsAttendance.update({
          where: { id: activeSession.id },
          data: { clockOut: new Date() }
        });

        await AuditLogService.log({
          organizationId: orgId,
          userId,
          action: 'ATTENDANCE_CLOCKED_OUT',
          targetType: 'hrms_attendance',
          targetId: updated.id,
          status: 'success'
        }, tx);

        return updated;
      }, { isolationLevel: 'Serializable' });

      res.json({ data: attendance });
    } catch (err: any) {
      if (err.message === 'NOT_CLOCKED_IN') {
        return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Not clocked in' } });
      }
      throw err;
    }
  }

  static async correct(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    const id = String(req.params.id);

    const parseRes = overrideSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    }

    try {
      const attendance = await prisma.$transaction(async (tx) => {
        const existing = await tx.hrmsAttendance.findFirst({
          where: { id, organizationId: orgId }
        });

        if (!existing) {
          throw new Error('NOT_FOUND');
        }

        const updated = await tx.hrmsAttendance.update({
          where: { id },
          data: {
            ...parseRes.data,
            clockIn: parseRes.data.clockIn ? new Date(parseRes.data.clockIn) : undefined,
            clockOut: parseRes.data.clockOut ? new Date(parseRes.data.clockOut) : undefined
          }
        });

        await AuditLogService.log({
          organizationId: orgId,
          userId,
          action: 'ATTENDANCE_CORRECTED',
          targetType: 'hrms_attendance',
          targetId: updated.id,
          status: 'success',
          previousState: existing,
          newState: updated
        }, tx);

        return updated;
      });

      res.json({ data: attendance });
    } catch (err: any) {
      if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attendance record not found' } });
      }
      throw err;
    }
  }
}
