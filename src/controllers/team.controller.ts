import { Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';
import { ConflictError, NotFoundError } from '../utils/errors';
import { AuditLogService } from '../services/audit.service';

export class TeamController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const teams = await prisma.team.findMany({
        where: { organizationId: req.organizationId! },
        orderBy: { name: 'asc' }
      });
      return sendSuccess(res, teams, 'Teams retrieved');
    } catch (error) { next(error); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const orgId = req.organizationId!;
      
      const team = await prisma.$transaction(async (tx) => {
        const { EntitlementService } = require('../services/entitlement.service');
        await EntitlementService.checkQuota(orgId, 'max_teams', 1, tx);
        
        return tx.team.create({
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
        action: 'team.create',
        status: 'success',
        targetId: team.id,
        targetType: 'team',
        newState: team
      });
      
      return sendSuccess(res, team, 'Team created', 201);
    } catch (error) { next(error); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, description } = req.body;
      const orgId = req.organizationId!;
      const existing = await prisma.team.findUnique({ where: { id } });
      if (!existing || existing.organizationId !== orgId) throw new NotFoundError('Team not found');

      const team = await prisma.team.update({
        where: { id },
        data: { name, description }
      });
      
      await AuditLogService.log({
        organizationId: orgId,
        userId: req.user!.id,
        action: 'team.update',
        status: 'success',
        targetId: id,
        targetType: 'team',
        previousState: existing,
        newState: team
      });
      
      return sendSuccess(res, team, 'Team updated');
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const orgId = req.organizationId!;
      
      const existing = await prisma.team.findUnique({ where: { id } });
      if (!existing || existing.organizationId !== orgId) throw new NotFoundError('Team not found');

      const activeMembers = await prisma.organizationMembership.count({
        where: { teamId: id, organizationId: orgId }
      });

      if (activeMembers > 0) {
        throw new ConflictError('Cannot delete a team with assigned members. Please reassign them first.');
      }

      await prisma.team.delete({
        where: { id }
      });
      
      await AuditLogService.log({
        organizationId: orgId,
        userId: req.user!.id,
        action: 'team.delete',
        status: 'success',
        targetId: id,
        targetType: 'team',
        previousState: existing
      });
      
      return sendSuccess(res, null, 'Team deleted');
    } catch (error) { next(error); }
  }
}
