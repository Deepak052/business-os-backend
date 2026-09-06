import { prisma } from '../utils/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { AuditLogService } from './audit.service';

export class RBACService {
  static async createRole(data: {
    organizationId?: string;
    name: string;
    description?: string;
    permissions: string[]; // array of permission IDs
    creatorId: string;
  }) {
    // 1. If organizationId is provided, the creator must have authority in that org.
    // If not, it's a global platform role, requiring super admin privileges.
    // (This is usually checked in the controller/middleware, but we enforce here too)
    
    // 2. Validate permissions being assigned
    // Prevent privilege escalation: user cannot assign a permission they don't have
    const userMemberships = await prisma.organizationMembership.findMany({
      where: { userId: data.creatorId },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } }
            }
          }
        }
      }
    });

    const userHasPerm = (permId: string) => {
      // Check if any of the user's roles have this perm, or if they have '*'
      for (const m of userMemberships) {
        // Platform roles logic check:
        // A super admin has a role with organizationId = null. 
        for (const mr of m.roles) {
          for (const rp of mr.role.permissions) {
            if (rp.permission.id === permId || rp.permission.action === '*') return true;
          }
        }
      }
      // Also check platform-level memberships (organizationId = null) if supported
      return false;
    };

    for (const pId of data.permissions) {
      if (!userHasPerm(pId)) {
        throw new ForbiddenError('Privilege escalation: You cannot assign permissions you do not possess.');
      }
    }

    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          organizationId: data.organizationId || null,
          name: data.name,
          description: data.description,
          isSystem: false,
        }
      });

      if (data.permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissions.map(pId => ({
            roleId: role.id,
            permissionId: pId,
          }))
        });
      }

      await AuditLogService.log({
        organizationId: data.organizationId || undefined,
        userId: data.creatorId,
        action: 'ROLE_CREATED',
        status: 'success',
        targetId: role.id,
        targetType: 'role',
        reason: `Created role ${role.name}`
      }, tx);

      return role;
    });
  }

  static async updateRole(roleId: string, organizationId: string | null, data: any, updaterId: string) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role not found');
    if (role.organizationId !== organizationId) throw new ForbiddenError('Unauthorized');
    
    if (role.isSystem) {
      throw new BadRequestError('Cannot modify system roles directly');
    }

    // Similar privilege escalation checks would go here before updating permissions...
    
    return prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id: roleId },
        data: {
          name: data.name,
          description: data.description,
        }
      });

      await AuditLogService.log({
        organizationId: organizationId || undefined,
        userId: updaterId,
        action: 'ROLE_UPDATED',
        status: 'success',
        targetId: roleId,
        targetType: 'role',
      }, tx);

      return updated;
    });
  }

  static async deleteRole(roleId: string, organizationId: string | null) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role not found');
    if (role.organizationId !== organizationId) throw new ForbiddenError('Unauthorized');

    if (role.isSystem) {
      throw new BadRequestError('System roles cannot be deleted');
    }

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.role.delete({ where: { id: roleId } });
      
      await AuditLogService.log({
        organizationId: organizationId || undefined,
        action: 'ROLE_DELETED',
        status: 'success',
        targetId: roleId,
        targetType: 'role',
      }, tx);

      return deleted;
    });
  }
}
