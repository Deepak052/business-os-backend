import { Request, Response } from 'express';
import { prisma } from '../../../utils/prisma';
import { AuditLogService } from '../../../services/audit.service';
import { z } from 'zod';
import { AuthRequest } from '../../../middlewares/auth.middleware';

const createStubSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  grossPay: z.number().positive(),
  netPay: z.number().positive(),
  deductions: z.number().nonnegative()
});

export class HrmsPayrollController {

  static async list(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    
    // Explicit authorization rule: hrms:payroll:view -> organization-scoped visibility
    // The middleware already asserts this permission.
    
    const records = await prisma.hrmsPayrollStub.findMany({
      where: { organizationId: orgId },
      include: {
        employee: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
        }
      },
      orderBy: { periodStart: 'desc' }
    });

    res.json({ data: records });
  }

  static async listMe(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    
    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { userId, organizationId: orgId }
    });

    if (!employee) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Employee not found' } });
    }

    const records = await prisma.hrmsPayrollStub.findMany({
      where: { 
        organizationId: orgId,
        employeeId: employee.id 
      },
      orderBy: { periodStart: 'desc' }
    });

    res.json({ data: records });
  }
  
  static async createDraft(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    
    const parseRes = createStubSchema.safeParse(req.body);
    if (!parseRes.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } });
    }

    const { employeeId, periodStart, periodEnd, grossPay, netPay, deductions } = parseRes.data;

    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { id: employeeId, organizationId: orgId }
    });

    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found in organization' } });
    }

    const stub = await prisma.$transaction(async (tx) => {
      const created = await tx.hrmsPayrollStub.create({
        data: {
          organizationId: orgId,
          employeeId: employee.id,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          grossPay,
          netPay,
          deductions,
          status: 'draft'
        }
      });

      await AuditLogService.log({
        organizationId: orgId,
        userId,
        action: 'PAYROLL_STUB_CREATED',
        targetType: 'hrms_payroll_stub',
        targetId: created.id,
        status: 'success'
      }, tx);

      return created;
    });

    res.status(201).json({ data: stub });
  }

  static async viewOwn(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    const id = String(req.params.id);

    const employee = await prisma.hrmsEmployeeProfile.findFirst({
      where: { userId, organizationId: orgId }
    });

    if (!employee) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Employee not found' } });
    }

    const stub = await prisma.hrmsPayrollStub.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!stub) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payroll stub not found' } });
    }

    if (stub.employeeId !== employee.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot view payroll stub for another employee' } });
    }

    res.json({ data: stub });
  }

  static async pay(req: AuthRequest, res: Response) {
    const orgId = String(req.headers['x-organization-id']);
    const userId = String(req.user!.id);
    const id = String(req.params.id);

    try {
      const stub = await prisma.$transaction(async (tx) => {
        const existing = await tx.hrmsPayrollStub.findFirst({
          where: { id, organizationId: orgId }
        });

        if (!existing) {
          throw new Error('NOT_FOUND');
        }

        if (existing.status === 'paid') {
          throw new Error('ALREADY_PAID');
        }

        const updated = await tx.hrmsPayrollStub.update({
          where: { id },
          data: { status: 'paid' }
        });

        await AuditLogService.log({
          organizationId: orgId,
          userId,
          action: 'PAYROLL_STUB_PAID',
          targetType: 'hrms_payroll_stub',
          targetId: updated.id,
          status: 'success',
          previousState: existing,
          newState: updated
        }, tx);

        return updated;
      });

      res.json({ data: stub });
    } catch (err: any) {
      if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payroll stub not found' } });
      }
      if (err.message === 'ALREADY_PAID') {
        return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Stub already paid' } });
      }
      throw err;
    }
  }
}
