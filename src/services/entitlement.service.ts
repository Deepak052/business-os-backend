import { prisma } from '../utils/prisma';
import { QuotaExceededError, SubscriptionExpiredError } from '../utils/errors';

export interface EntitlementResolution {
  activeModules: string[];
  features: string[];
  limits: Record<string, number>;
  status: 'active' | 'past_due' | 'canceled' | 'expired' | 'no_subscription';
}

export class EntitlementService {
  /**
   * Resolves the effective entitlements for an organization based on:
   * 1. The active subscription plan
   * 2. Global module status (if disabled globally, nobody gets it)
   * 3. Organization-specific feature flag overrides
   */
  static async getOrganizationEntitlements(organizationId: string): Promise<EntitlementResolution> {
    const defaultResolution: EntitlementResolution = {
      activeModules: [],
      features: [],
      limits: {},
      status: 'no_subscription'
    };

    // 1. Fetch Subscription
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      include: {
        plan: {
          include: {
            entitlements: {
              include: { module: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return defaultResolution;
    }

    // Determine status (check dates)
    let status = subscription.status as EntitlementResolution['status'];
    const now = new Date();
    if (status === 'active' && subscription.currentPeriodEnd < now) {
      // Temporarily consider expired if past due end date and not renewed
      status = 'expired';
    }

    // If not active, we might return zero entitlements, but for now we'll allow access to data 
    // with restricted write permissions (enforced at API level based on status).
    // Let's resolve what the plan *would* give them, and let the caller decide what to do with 'expired'.
    
    const limits: Record<string, number> = {};
    const features = new Set<string>();
    const planModules = new Set<string>();

    // Parse Plan Entitlements
    for (const ent of subscription.plan.entitlements) {
      if (ent.limitKey && ent.limitValue !== null) {
        limits[ent.limitKey] = ent.limitValue;
      }
      if (ent.featureKey) {
        features.add(ent.featureKey);
      }
      if (ent.moduleId && ent.module) {
        // Global state overrides:
        // 'active' or 'deprecated' are allowed for existing plans.
        // 'disabled' or 'archived' means it is forcibly removed.
        if (ent.module.status === 'active' || ent.module.status === 'deprecated') {
          planModules.add(ent.module.id);
        }
      }
    }

    // 2. Fetch Global Feature Flags
    const globalFlags = await prisma.featureFlag.findMany();
    for (const flag of globalFlags) {
      if (flag.isEnabled) features.add(flag.key);
    }

    // 3. Fetch Organization Overrides
    const orgFlags = await prisma.organizationFeatureFlag.findMany({
      where: { organizationId }
    });
    for (const flag of orgFlags) {
      if (flag.isEnabled) {
        features.add(flag.featureKey);
      } else {
        features.delete(flag.featureKey);
      }
    }

    // 4. Check Organization Modules (if org disabled a module they are entitled to)
    const orgModules = await prisma.organizationModule.findMany({
      where: { organizationId }
    });
    
    const activeModules: string[] = [];
    for (const moduleId of planModules) {
      const orgMod = orgModules.find(m => m.moduleId === moduleId);
      if (!orgMod || orgMod.isActive) {
        activeModules.push(moduleId);
      }
    }

      return {
      activeModules,
      features: Array.from(features),
      limits,
      status
    };
  }

  /**
   * Authoritatively checks if an org has quota for a resource.
   * Throws errors if limits are exceeded.
   */
  static async checkQuota(
    organizationId: string, 
    limitKey: string, 
    requestedQuantity: number = 1,
    tx?: any
  ): Promise<void> {
    const db = tx || prisma;

    // Pessimistic lock on the Organization row to serialize quota creations (if inside a transaction)
    if (tx) {
      await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
    }

    const entitlements = await this.getOrganizationEntitlements(organizationId);
    
    // ALLOW WRITE for active, trialing, and past_due grace periods.
    const allowedStatuses = ['active', 'trialing', 'past_due'];
    if (!allowedStatuses.includes(entitlements.status)) {
      throw new SubscriptionExpiredError('SUBSCRIPTION_EXPIRED');
    }

    const limit = entitlements.limits[limitKey];
    
    // Missing quota key -> 0 / not entitled
    if (limit === undefined || limit === 0) {
      throw new QuotaExceededError('QUOTA_EXCEEDED');
    }

    // -1 or null -> Unlimited
    if (limit === -1 || limit === null) {
      return;
    }

    // Resolve authoritative current usage
    let currentUsage = 0;
    switch (limitKey) {
      case 'max_users':
        const memberships = await db.organizationMembership.count({ where: { organizationId, status: 'active' } });
        const pendingInvites = await db.invitation.count({ where: { organizationId, status: 'pending' } });
        currentUsage = memberships + pendingInvites;
        break;
      case 'max_teams':
        currentUsage = await db.team.count({ where: { organizationId } });
        break;
      case 'max_departments':
        currentUsage = await db.department.count({ where: { organizationId } });
        break;
      case 'max_roles':
        currentUsage = await db.role.count({ where: { organizationId, isSystem: false } });
        break;
      case 'max_crm_contacts':
        currentUsage = await db.crmContact.count({ where: { organizationId } });
        break;
      case 'max_crm_companies':
        currentUsage = await db.crmCompany.count({ where: { organizationId } });
        break;
      case 'max_crm_leads':
        currentUsage = await db.crmLead.count({ where: { organizationId } });
        break;
      case 'max_crm_deals':
        currentUsage = await db.crmDeal.count({ where: { organizationId } });
        break;
      case 'max_storage':
        const storageResult = await db.file.aggregate({
          where: { organizationId },
          _sum: { size: true }
        });
        currentUsage = storageResult._sum.size || 0;
        break;
      default:
        // Unknown quota key -> assume no usage
        break;
    }

    if (currentUsage + requestedQuantity > limit) {
      throw new QuotaExceededError('QUOTA_EXCEEDED');
    }
  }
}
