import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { prisma } from '../utils/prisma';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export const requireTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('User must be authenticated to access tenant context');
    }

    const organizationId = req.headers['x-organization-id'] as string;
    
    if (!organizationId) {
      throw new ForbiddenError('Organization ID is required');
    }

    // Verify user belongs to this organization and org is active
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.user.id
        }
      },
      include: {
        organization: { select: { status: true } }
      }
    });

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('You do not have access to this organization');
    }

    if (membership.organization.status === 'suspended') {
      throw new ForbiddenError('This organization is currently suspended');
    }

    if (membership.organization.status === 'archived') {
      throw new ForbiddenError('This organization has been archived');
    }

    // Set organization context for subsequent middlewares/controllers
    req.organizationId = organizationId;
    
    const { getRequestContext } = require('../utils/request-context');
    const ctx = getRequestContext();
    if (ctx) ctx.organizationId = organizationId;

    next();
  } catch (error) {
    next(error);
  }
};
