import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { prisma } from '../utils/prisma';

export class OrganizationSettingsController {
  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { branding, localization } = req.body;
      const orgId = req.organizationId!;
      
      const existingSettings = await prisma.organizationSetting.findUnique({
        where: { organizationId: orgId }
      });
      
      const settings = await prisma.organizationSetting.upsert({
        where: { organizationId: orgId },
        update: { branding, localization },
        create: {
          organizationId: orgId,
          branding,
          localization,
        }
      });
      
      const { AuditLogService } = require('../services/audit.service');
      await AuditLogService.log({
        organizationId: orgId,
        userId: req.user!.id,
        action: 'organization.settings.update',
        status: 'success',
        details: {
          previousState: existingSettings,
          newState: settings
        }
      });
      
      return sendSuccess(res, settings, 'Settings updated');
    } catch (error) { next(error); }
  }

  static async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.organizationSetting.findUnique({
        where: { organizationId: req.organizationId! }
      });
      return sendSuccess(res, settings, 'Settings retrieved');
    } catch (error) { next(error); }
  }
}
