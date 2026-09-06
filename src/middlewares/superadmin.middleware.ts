import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError } from '../utils/errors';
import { env } from '../config/env';

export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    // Simplest bootstrap check: is this the defined super admin email?
    const { prisma } = require('../utils/prisma');
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user?.email === env.SUPERADMIN_EMAIL) {
      return next();
    }

    // In a full RBAC system, you would also check if the user has a Role where organizationId = null
    // and permission = 'manage:platform'.
    // We strictly enforce this so org admins cannot escalate.
    throw new ForbiddenError('Super Admin access required');
  } catch (error) {
    next(error);
  }
};
