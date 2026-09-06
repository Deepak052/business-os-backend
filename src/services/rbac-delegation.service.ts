import { prisma } from '../utils/prisma';
import { ForbiddenError } from '../utils/errors';
import { AuthRequest } from '../middlewares/auth.middleware';
import { 
  PermissionNotDelegatableError, 
  PermissionNotHeldError, 
  PermissionInactiveError,
  RoleInactiveError
} from '../utils/errors';

export class RbacDelegationService {
  /**
   * Retrieves all effective permissions for a user within a specific organization.
   * Discards inactive roles and inactive memberships.
   */
  static async getEffectivePermissions(userId: string, organizationId: string): Promise<{ ids: Set<string>, actions: Set<string> }> {
    const userMemberships = await prisma.organizationMembership.findMany({
      where: { 
        userId,
        organizationId,
        status: 'active'
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const userPermissionIds = new Set<string>();
    const userPermissionActions = new Set<string>();
    
    // Aggregate all active assigned role permission IDs
    for (const membership of userMemberships) {
      for (const mr of membership.roles) {
        if (!mr.role.isActive) continue; // Ignore inactive roles

        for (const rp of mr.role.permissions) {
          userPermissionIds.add(rp.permission.id);
          userPermissionActions.add(rp.permission.action);
        }
      }
    }

    return { ids: userPermissionIds, actions: userPermissionActions };
  }

  /**
   * Evaluates if the current user (Org Admin) is allowed to delegate the requested permissions.
   * Throws PermissionNotDelegatableError or PermissionNotHeldError.
   */
  static async validateDelegation(
    req: AuthRequest,
    requestedPermissionIds: string[]
  ): Promise<void> {
    if (!requestedPermissionIds || requestedPermissionIds.length === 0) return;

    // 1. Fetch the requested permissions to ensure they exist and check isDelegatable
    const requestedPermissions = await prisma.permission.findMany({
      where: { id: { in: requestedPermissionIds } }
    });

    if (requestedPermissions.length !== requestedPermissionIds.length) {
      throw new ForbiddenError('One or more requested permissions do not exist.');
    }

    const nonDelegatable = requestedPermissions.find(p => !p.isDelegatable);
    if (nonDelegatable) {
      throw new PermissionNotDelegatableError(`Permission '${nonDelegatable.action}' is a platform permission and cannot be delegated.`);
    }

    // 2. Fetch the user's current effective permissions
    const { ids: userPermissionIds, actions: userPermissionActions } = await this.getEffectivePermissions(req.user!.id, req.organizationId!);

    // If the user has wildcard '*' permission, they can delegate any delegatable permission
    if (userPermissionActions.has('*')) {
      return;
    }

    // 3. Verify the user possesses every permission they are trying to grant
    for (const p of requestedPermissions) {
      if (!userPermissionIds.has(p.id)) {
        throw new PermissionNotHeldError(`You do not have the authority to delegate permission '${p.action}'.`);
      }
    }
  }
}
