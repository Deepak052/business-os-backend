import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { prisma } from '../utils/prisma';

export class ModuleController {
  static async listActive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const activeModules = await prisma.organizationModule.findMany({
        where: { organizationId: req.organizationId!, isActive: true },
        include: { module: true }
      });
      return sendSuccess(res, activeModules, 'Active modules retrieved');
    } catch (error) { next(error); }
  }

  static async listAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const globalModules = await prisma.module.findMany({
        where: { status: 'active' }
      });
      return sendSuccess(res, globalModules, 'All available modules retrieved');
    } catch (error) { next(error); }
  }

  static async enable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { moduleId } = req.body;
      const orgId = req.organizationId!;
      // Verify module exists and is active
      const mod = await prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod || mod.status === 'disabled') {
        throw new Error('Module is disabled globally or does not exist');
      }

      const orgMod = await prisma.organizationModule.upsert({
        where: { organizationId_moduleId: { organizationId: orgId, moduleId } },
        update: { isActive: true },
        create: { organizationId: orgId, moduleId, isActive: true },
      });
      return sendSuccess(res, orgMod, 'Module enabled');
    } catch (error) { next(error); }
  }

  static async disable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const orgId = req.organizationId!;
      const orgMod = await prisma.organizationModule.update({
        where: { organizationId_moduleId: { organizationId: orgId, moduleId: id } },
        data: { isActive: false },
      });
      return sendSuccess(res, orgMod, 'Module disabled');
    } catch (error) { next(error); }
  }
}
