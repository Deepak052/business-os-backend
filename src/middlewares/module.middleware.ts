import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { EntitlementService } from '../services/entitlement.service';
import { ModuleDisabledError, ForbiddenError } from '../utils/errors';

export const requireModuleAccess = (moduleId: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Tenant context required for module check');
      }

      const entitlements = await EntitlementService.getOrganizationEntitlements(req.organizationId);
      
      if (!entitlements.activeModules.includes(moduleId)) {
        throw new ModuleDisabledError('MODULE_DISABLED');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

import { prisma } from '../utils/prisma';

export const requireModuleKey = (moduleName: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Tenant context required for module check');
      }

      const mod = await prisma.module.findUnique({ where: { id: moduleName } });
      if (!mod) {
        throw new ModuleDisabledError('MODULE_NOT_FOUND');
      }

      const entitlements = await EntitlementService.getOrganizationEntitlements(req.organizationId);
      
      if (!entitlements.activeModules.includes(mod.id)) {
        throw new ModuleDisabledError('MODULE_DISABLED');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireFeatureAccess = (featureKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Tenant context required for feature check');
      }

      const entitlements = await EntitlementService.getOrganizationEntitlements(req.organizationId);
      
      if (!entitlements.features.includes(featureKey)) {
        throw new ForbiddenError('FEATURE_DISABLED');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
