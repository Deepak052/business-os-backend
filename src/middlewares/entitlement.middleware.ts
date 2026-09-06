import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { EntitlementService } from '../services/entitlement.service';
import { SubscriptionExpiredError, ForbiddenError } from '../utils/errors';

/**
 * Middleware to enforce read-only grace behavior for expired/canceled subscriptions.
 * Allows GET requests, but blocks POST/PUT/DELETE for non-admin business data.
 */
export const requireActiveSubscriptionForWrites = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) {
      return next(new ForbiddenError('Organization ID is required'));
    }

    // Allow GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const entitlements = await EntitlementService.getOrganizationEntitlements(req.organizationId);

    // Active, Trialing, Past Due are allowed to write.
    const allowedStatuses = ['active', 'trialing', 'past_due'];
    if (!allowedStatuses.includes(entitlements.status)) {
      throw new SubscriptionExpiredError('SUBSCRIPTION_EXPIRED');
    }

    next();
  } catch (error) {
    next(error);
  }
};
