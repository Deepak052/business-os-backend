import { prisma } from '../utils/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { AuditLogService } from './audit.service';

export class SubscriptionService {
  static async getActiveSubscription(organizationId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId,
        status: { in: ['active', 'trial', 'past_due'] }, // Effective statuses
      },
      include: {
        plan: {
          include: { entitlements: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return subscription;
  }

  static async hasModuleAccess(organizationId: string, moduleId: string) {
    // 1. Check if module is globally free
    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) return false;
    if (module.isGlobal && (module.status === 'active' || module.status === 'deprecated')) return true;

    // 2. Check subscription entitlements
    const subscription = await this.getActiveSubscription(organizationId);
    if (!subscription) return false;

    // Verify it's not expired based on dates
    if (subscription.currentPeriodEnd < new Date()) {
      return false; // Expired, though cron should update status to expired
    }

    const hasEntitlement = subscription.plan.entitlements.some(e => e.moduleId === moduleId);
    return hasEntitlement;
  }

  static async hasFeatureAccess(organizationId: string, featureKey: string) {
    const subscription = await this.getActiveSubscription(organizationId);
    if (!subscription) return false;

    if (subscription.currentPeriodEnd < new Date()) {
      return false; 
    }

    const hasEntitlement = subscription.plan.entitlements.some(e => e.featureKey === featureKey);
    return hasEntitlement;
  }

  static async getQuotaLimit(organizationId: string, limitKey: string): Promise<number | null> {
    const subscription = await this.getActiveSubscription(organizationId);
    if (!subscription) return null;

    const entitlement = subscription.plan.entitlements.find(e => e.limitKey === limitKey);
    return entitlement ? entitlement.limitValue : null;
  }

  // Admin Actions
  static async assignSubscription(organizationId: string, planId: string) {
    return prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundError('Plan not found');

      // End current active if any
      await tx.subscription.updateMany({
        where: { organizationId, status: { in: ['active', 'trial', 'past_due'] } },
        data: { status: 'canceled' }
      });

      const now = new Date();
      const endDate = new Date();
      endDate.setMonth(now.getMonth() + (plan.interval === 'year' ? 12 : 1));

      const sub = await tx.subscription.create({
        data: {
          organizationId,
          planId,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: endDate,
        }
      });

      await AuditLogService.log({
        organizationId,
        action: 'SUBSCRIPTION_ASSIGNED',
        status: 'success',
        targetId: planId,
        targetType: 'subscription_plan',
      }, tx);

      return sub;
    });
  }
}
