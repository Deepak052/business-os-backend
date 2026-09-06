import { prisma } from '../utils/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { SubscriptionService } from './subscription.service';
import { AuditLogService } from './audit.service';

export class ModuleRegistryService {
  static async registerModule(data: {
    name: string;
    version?: string;
    description?: string;
    isGlobal?: boolean;
    status?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const module = await tx.module.create({
        data: {
          name: data.name,
          version: data.version || '1.0.0',
          description: data.description,
          isGlobal: data.isGlobal ?? false,
          status: data.status || 'active',
        }
      });

      await AuditLogService.log({
        action: 'MODULE_REGISTERED',
        status: 'success',
        targetId: module.id,
        targetType: 'module',
      }, tx);

      return module;
    });
  }

  static async getModules() {
    return prisma.module.findMany();
  }

  // Org Admin activating a module
  static async activateModuleForOrg(organizationId: string, moduleId: string) {
    // 1. Validate module exists & active globally
    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module || module.status !== 'active') {
      throw new BadRequestError('Module is not available for new activation');
    }

    // 2. Validate entitlement
    const hasAccess = await SubscriptionService.hasModuleAccess(organizationId, moduleId);
    if (!hasAccess) {
      throw new BadRequestError('Your organization does not have a subscription plan that includes this module');
    }

    // 3. Activate
    return prisma.$transaction(async (tx) => {
      const orgModule = await tx.organizationModule.upsert({
        where: {
          organizationId_moduleId: {
            organizationId,
            moduleId
          }
        },
        update: { isActive: true },
        create: {
          organizationId,
          moduleId,
          isActive: true,
        }
      });

      await AuditLogService.log({
        organizationId,
        action: 'MODULE_STATUS_CHANGED',
        status: 'success',
        targetId: moduleId,
        targetType: 'module',
        reason: 'Module activated',
      }, tx);

      return orgModule;
    });
  }

  static async deactivateModuleForOrg(organizationId: string, moduleId: string) {
    return prisma.$transaction(async (tx) => {
      const orgModule = await tx.organizationModule.update({
        where: {
          organizationId_moduleId: {
            organizationId,
            moduleId
          }
        },
        data: { isActive: false }
      });

      await AuditLogService.log({
        organizationId,
        action: 'MODULE_STATUS_CHANGED',
        status: 'success',
        targetId: moduleId,
        targetType: 'module',
        reason: 'Module deactivated',
      }, tx);

      return orgModule;
    });
  }

  static async getActiveOrgModules(organizationId: string) {
    return prisma.organizationModule.findMany({
      where: {
        organizationId,
        isActive: true
      },
      include: {
        module: true
      }
    });
  }
}
