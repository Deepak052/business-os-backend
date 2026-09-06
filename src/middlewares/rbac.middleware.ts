import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError } from '../utils/errors';
import { RbacDelegationService } from '../services/rbac-delegation.service';

export const requirePermission = (requiredPermission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { user, organizationId } = req;
      
      if (!user || !organizationId) {
        throw new ForbiddenError('Missing auth or tenant context');
      }

      // Check if user has permission in this organization
      const permissions = await RbacDelegationService.getEffectivePermissions(user.id, organizationId);

      // Super admin check could go here if roles are global
      // If user has the specific permission OR the wildcard '*'
      const hasPermission = permissions.actions.has(requiredPermission) || permissions.actions.has('*');

      if (!hasPermission) {
        throw new ForbiddenError(`You lack the required permission: ${requiredPermission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
