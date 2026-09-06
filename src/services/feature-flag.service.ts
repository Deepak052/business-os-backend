import { prisma } from '../utils/prisma';
import { SubscriptionService } from './subscription.service';

export class FeatureFlagService {
  static async isFeatureEnabled(organizationId: string, featureKey: string): Promise<boolean> {
    // 1. Check Global Feature Flag (if we had a global table, mocked here)
    const globalFlag = await prisma.featureFlag.findUnique({ where: { key: featureKey } }).catch(() => null);
    
    // 2. Check Org specific override
    const orgFlag = await prisma.organizationFeatureFlag.findUnique({
      where: {
        organizationId_featureKey: {
          organizationId,
          featureKey
        }
      }
    });

    if (orgFlag) {
      // Org override takes precedence
      if (!orgFlag.isEnabled) return false;
    } else {
      // If no org override, check global
      if (globalFlag && !globalFlag.isEnabled) return false;
    }

    // 3. Check Subscription Entitlement
    const hasEntitlement = await SubscriptionService.hasFeatureAccess(organizationId, featureKey);
    return hasEntitlement;
  }

  static async setOrgFeatureFlag(organizationId: string, featureKey: string, isEnabled: boolean) {
    const { AuditLogService } = require('./audit.service');
    return prisma.$transaction(async (tx) => {
      const flag = await tx.organizationFeatureFlag.upsert({
        where: {
          organizationId_featureKey: {
            organizationId,
            featureKey
          }
        },
        update: { isEnabled },
        create: {
          organizationId,
          featureKey,
          isEnabled
        }
      });

      await AuditLogService.log({
        organizationId,
        action: 'FEATURE_FLAG_STATUS_CHANGED',
        status: 'success',
        targetId: featureKey,
        targetType: 'feature_flag',
        reason: `Feature flag ${featureKey} set to ${isEnabled}`,
      }, tx);

      return flag;
    });
  }
}
