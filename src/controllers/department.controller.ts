import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';
import { ConflictError, NotFoundError } from '../utils/errors';
import { AuditLogService } from '../services/audit.service';

export class DepartmentController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const departments = await prisma.department.findMany({
        where: { organizationId: req.organizationId! },
        orderBy: { name: 'asc' }
      });
      return sendSuccess(res, departments, 'Departments retrieved');
    } catch (error) { next(error); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const orgId = req.organizationId!;
      
      const department = await prisma.$transaction(async (tx) => {
        const { EntitlementService } = require('../services/entitlement.service');
        await EntitlementService.checkQuota(orgId, 'max_departments', 1, tx);
        
        return tx.department.create({
          data: {
            organizationId: orgId,
            name,
            description
          }
        });
      });
      
      await AuditLogService.log({
        organizationId: orgId,
        userId: req.user!.id,
        action: 'department.create',
        status: 'success',
        targetId: department.id,
        targetType: 'department',
        newState: department
      });
      
      return sendSuccess(res, department, 'Department created', 201);
    } catch (error) { next(error); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, description } = req.body;
      const orgId = req.organizationId!;
      const existing = await prisma.department.findUnique({ where: { id } });
      if (!existing || existing.organizationId !== orgId) throw new NotFoundError('Department not found');

      const department = await prisma.department.update({
        where: { id },
        data: { name, description }
      });
      
      await AuditLogService.log({
        organizationId: orgId,
        userId: req.user!.id,
        action: 'department.update',
        status: 'success',
        targetId: id,
        targetType: 'department',
        previousState: existing,
        newState: department
      });
      
      return sendSuccess(res, department, 'Department updated');
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const orgId = req.organizationId!;
      
      const existing = await prisma.department.findUnique({ where: { id } });
      if (!existing || existing.organizationId !== orgId) throw new NotFoundError('Department not found');

      const activeMembers = await prisma.organizationMembership.count({
        where: { departmentId: id, organizationId: orgId }
      });

      if (activeMembers > 0) {
        throw new ConflictError('Cannot delete a department with assigned members. Please reassign them first.');
      }

      await prisma.department.delete({
        where: { id }
      });
      
      await AuditLogService.log({
        organizationId: orgId,
        userId: req.user!.id,
        action: 'department.delete',
        status: 'success',
        targetId: id,
        targetType: 'department',
        previousState: existing
      });
      
      return sendSuccess(res, null, 'Department deleted');
    } catch (error) { next(error); }
  }
}
