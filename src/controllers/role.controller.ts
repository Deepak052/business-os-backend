import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { prisma } from '../utils/prisma';
import { 
  ConflictError, 
  NotFoundError, 
  ForbiddenError,
  SystemRoleProtectedError,
  PlatformRoleForbiddenError,
  RoleInUseError
} from '../utils/errors';
import { RbacDelegationService } from '../services/rbac-delegation.service';
import { AuditLogService } from '../services/audit.service';

export class RoleController {
  static async listRoles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const roles = await prisma.role.findMany({
        where: {
          OR: [
            { organizationId: req.organizationId! },
            { organizationId: null } // Platform default roles
          ]
        },
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      });
      return sendSuccess(res, roles, 'Roles retrieved');
    } catch (error) { next(error); }
  }

  static async listPermissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // For organizations, we should probably only return delegatable active permissions
      // But we will return all for now and let validateDelegation block it.
      const permissions = await prisma.permission.findMany();
      return sendSuccess(res, permissions, 'Permissions retrieved');
    } catch (error) { next(error); }
  }
  static async createRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, permissionIds } = req.body;
      const orgId = req.organizationId!;

      // 1. Validate delegation
      if (permissionIds?.length > 0) {
        await RbacDelegationService.validateDelegation(req, permissionIds);
      }

      // 2. Check Quota
      const role = await prisma.$transaction(async (tx) => {
        const { EntitlementService } = require('../services/entitlement.service');
        await EntitlementService.checkQuota(orgId, 'max_roles', 1, tx);

        const newRole = await tx.role.create({
          data: {
            organizationId: orgId,
            name,
            description,
            isSystem: false,
            isActive: true,
            permissions: {
              create: (permissionIds || []).map((id: string) => ({ permissionId: id }))
            }
          },
          include: { permissions: { include: { permission: true } } }
        });

        await AuditLogService.log({
          organizationId: orgId,
          userId: req.user!.id,
          action: 'role.create',
          status: 'success',
          targetId: newRole.id,
          targetType: 'role',
          newState: newRole
        }, tx);

        return newRole;
      });

      return sendSuccess(res, role, 'Role created', 201);
    } catch (error) { next(error); }
  }

  static async updateRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name, description, permissionIds, isActive } = req.body;
      const orgId = req.organizationId!;

      const existingRole = await prisma.role.findUnique({
        where: { id },
        include: { permissions: true }
      });

      if (!existingRole) {
        throw new NotFoundError('Role not found');
      }

      if (existingRole.organizationId === null) {
        throw new PlatformRoleForbiddenError('Platform roles cannot be modified by tenant admins.');
      }

      if (existingRole.organizationId !== orgId) {
        throw new ForbiddenError('Unauthorized access to role');
      }

      if (existingRole.isSystem) {
        throw new SystemRoleProtectedError('System roles cannot be modified.');
      }

      if (permissionIds?.length > 0) {
        await RbacDelegationService.validateDelegation(req, permissionIds);
      }

      const role = await prisma.$transaction(async (tx) => {
        // Delete old permissions and set new ones
        if (permissionIds !== undefined) {
          await tx.rolePermission.deleteMany({ where: { roleId: id } });
        }

        const updated = await tx.role.update({
          where: { id },
          data: {
            name: name !== undefined ? name : undefined,
            description: description !== undefined ? description : undefined,
            isActive: isActive !== undefined ? isActive : undefined,
            ...(permissionIds !== undefined && {
              permissions: {
                create: permissionIds.map((pid: string) => ({ permissionId: pid }))
              }
            })
          },
          include: { permissions: { include: { permission: true } } }
        });

        await AuditLogService.log({
          organizationId: orgId,
          userId: req.user!.id,
          action: 'role.update',
          status: 'success',
          targetId: updated.id,
          targetType: 'role',
          previousState: existingRole,
          newState: updated
        }, tx);

        return updated;
      });

      return sendSuccess(res, role, 'Role updated');
    } catch (error) { next(error); }
  }

  static async cloneRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { name } = req.body; // New name
      const orgId = req.organizationId!;

      const existingRole = await prisma.role.findUnique({
        where: { id },
        include: { permissions: true }
      });

      if (!existingRole) {
        throw new NotFoundError('Role not found');
      }

      if (existingRole.organizationId !== orgId && existingRole.organizationId !== null) {
        throw new ForbiddenError('Unauthorized access to role');
      }

      // Revalidate every permission that belongs to the cloned role
      const permissionIds = existingRole.permissions.map((p: any) => p.permissionId);
      
      if (permissionIds.length > 0) {
        await RbacDelegationService.validateDelegation(req, permissionIds);
      }

      const role = await prisma.$transaction(async (tx) => {
        const { EntitlementService } = require('../services/entitlement.service');
        await EntitlementService.checkQuota(orgId, 'max_roles', 1, tx);

        const newRole = await tx.role.create({
          data: {
            organizationId: orgId,
            name: name || `${existingRole.name} (Clone)`,
            description: existingRole.description,
            isSystem: false,
            isActive: true,
            permissions: {
              create: permissionIds.map((pid: string) => ({ permissionId: pid }))
            }
          },
          include: { permissions: { include: { permission: true } } }
        });

        await AuditLogService.log({
          organizationId: orgId,
          userId: req.user!.id,
          action: 'role.clone',
          status: 'success',
          targetId: newRole.id,
          targetType: 'role',
          newState: newRole,
          reason: `Cloned from ${id}`
        }, tx);

        return newRole;
      });

      return sendSuccess(res, role, 'Role cloned', 201);
    } catch (error) { next(error); }
  }

  static async deleteRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const orgId = req.organizationId!;

      const existingRole = await prisma.role.findUnique({
        where: { id },
      });

      if (!existingRole) {
        throw new NotFoundError('Role not found');
      }

      if (existingRole.organizationId === null) {
        throw new PlatformRoleForbiddenError('Platform roles cannot be deleted by tenant admins.');
      }

      if (existingRole.organizationId !== orgId) {
        throw new ForbiddenError('Unauthorized access to role');
      }

      if (existingRole.isSystem) {
        throw new SystemRoleProtectedError('System roles cannot be deleted.');
      }

      const activeMembers = await prisma.membershipRole.count({
        where: { roleId: id }
      });

      if (activeMembers > 0) {
        throw new RoleInUseError('Cannot delete a role that is currently assigned to users.');
      }

      await prisma.$transaction(async (tx) => {
        await tx.role.delete({ where: { id } });

        await AuditLogService.log({
          organizationId: orgId,
          userId: req.user!.id,
          action: 'role.delete',
          status: 'success',
          targetId: id,
          targetType: 'role',
          previousState: existingRole
        }, tx);
      });

      return sendSuccess(res, null, 'Role deleted');
    } catch (error) { next(error); }
  }
}
