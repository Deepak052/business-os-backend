import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '../services/organization.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';
import { EntitlementService } from '../services/entitlement.service';
import { BadRequestError } from '../utils/errors';

export class OrganizationController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = await OrganizationService.createOrganization(req.user!.id, req.body);
      return sendSuccess(res, org, 'Organization created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = await OrganizationService.getOrganization(req.organizationId!);
      return sendSuccess(res, org, 'Organization details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await OrganizationService.updateSettings(req.organizationId!, req.body);
      return sendSuccess(res, settings, 'Settings updated successfully');
    } catch (error) { next(error); }
  }

  static async getSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sub = await prisma.subscription.findFirst({
        where: { organizationId: req.organizationId! },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });
      if (!sub) return sendSuccess(res, null, 'No subscription');

      const entitlements = await EntitlementService.getOrganizationEntitlements(req.organizationId!);

      return sendSuccess(res, {
        plan: sub.plan.name,
        status: entitlements.status,
        features: entitlements.features,
        modules: entitlements.activeModules,
        quotas: entitlements.limits,
        organizationId: req.organizationId!,
        expiresAt: sub.currentPeriodEnd
      }, 'Subscription loaded');
    } catch (error) { next(error); }
  }

  static async upgradePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const planId = req.body.planId;
      if (!planId) throw new BadRequestError('Plan ID is required');
      
      const { SubscriptionService } = require('../services/subscription.service');
      const sub = await SubscriptionService.assignSubscription(req.organizationId!, planId);
      
      return sendSuccess(res, { organizationId: req.organizationId!, subscriptionId: sub.id }, 'Upgraded successfully');
    } catch (error) { next(error); }
  }

  static async expireTrial(req: AuthRequest, res: Response, next: NextFunction) {
    // Dummy implementation
    return sendSuccess(res, { plan: 'free', status: 'trial_expired', features: [], organizationId: req.organizationId! }, 'Expired');
  }

  static async getFeatureFlags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const entitlements = await EntitlementService.getOrganizationEntitlements(req.organizationId!);
      const result = entitlements.features.map(key => ({ featureKey: key }));
      return sendSuccess(res, result, 'Feature flags retrieved');
    } catch (error) { next(error); }
  }

  static async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { AuditLogService } = require('../services/audit.service');
      const filters: any = {
        organizationId: req.organizationId, // Strict tenant isolation
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.requestId) filters.requestId = req.query.requestId as string;
      if (req.query.targetId) filters.targetId = req.query.targetId as string;
      if (req.query.targetType) filters.targetType = req.query.targetType as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const logs = await AuditLogService.getLogs(filters);

      return sendSuccess(res, logs, 'Tenant audit logs retrieved');
    } catch (error) {
      next(error);
    }
  }
}
