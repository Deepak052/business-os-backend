import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { prisma } from '../utils/prisma';
import { ModuleRegistryService } from '../services/module.service';
import { SubscriptionService } from '../services/subscription.service';
import { AuditLogService } from '../services/audit.service';
import { env } from '../config/env';
import crypto from 'crypto';

/**
 * Super Admin Controller
 * 
 * Strict platform-level boundary.
 * All mutations generate immutable audit logs.
 */
export class AdminController {
  
  // ---------------------------------------------------------------------------
  // AUDIT LOGS (GLOBAL)
  // ---------------------------------------------------------------------------
  static async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filters: any = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      if (req.query.organizationId) filters.organizationId = req.query.organizationId as string;
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.action) filters.action = req.query.action as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.requestId) filters.requestId = req.query.requestId as string;
      if (req.query.targetId) filters.targetId = req.query.targetId as string;
      if (req.query.targetType) filters.targetType = req.query.targetType as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const logs = await AuditLogService.getLogs(filters);

      return sendSuccess(res, logs, 'Audit logs retrieved');
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // USERS (GLOBAL)
  // ---------------------------------------------------------------------------
  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            lastLoginAt: true,
            memberships: {
              include: { organization: true, roles: { include: { role: true } } }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count()
      ]);

      return sendSuccess(res, { data: users, meta: { total, page, limit } }, 'Users retrieved globally');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // OVERVIEW METRICS
  // ---------------------------------------------------------------------------
  static async getOverviewMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [
        totalOrgs, activeOrgs, suspendedOrgs,
        totalUsers, activeUsers, lockedUsers,
        activeSubscriptions,
        registeredModules, disabledModules,
        activeFlags,
        recentLogs
      ] = await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { status: 'active' } }),
        prisma.organization.count({ where: { status: 'suspended' } }),
        
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
        
        prisma.subscription.count({ where: { status: 'active' } }),
        
        prisma.module.count(),
        prisma.module.count({ where: { status: 'disabled' } }),
        
        prisma.featureFlag.count({ where: { isEnabled: true } }),
        
        prisma.auditLog.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true } }, organization: { select: { name: true } } }
        })
      ]);

      return sendSuccess(res, {
        organizations: { total: totalOrgs, active: activeOrgs, suspended: suspendedOrgs },
        users: { total: totalUsers, active: activeUsers, locked: lockedUsers },
        subscriptions: { active: activeSubscriptions },
        modules: { registered: registeredModules, disabled: disabledModules },
        featureFlags: { active: activeFlags },
        recentLogs
      }, 'Overview metrics retrieved');
    } catch (error) { next(error); }
  }

  static async updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { isActive } = req.body;
      
      const user = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: { id: true, email: true, isActive: true }
      });

      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_user_status',
        status: 'success',
        reason: `Changed status to ${isActive} for user ${user.email}`,
        ipAddress: req.ip,
      });

      return sendSuccess(res, user, 'User status updated');
    } catch (error) { next(error); }
  }

  static async forcePasswordReset(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new Error("User not found");

      const token = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: id,
          token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:force_password_reset',
        status: 'success',
        reason: `Forced reset for user ${user.email}`,
        ipAddress: req.ip,
      });

      // In reality, this would send an email. For now, we return the token (or just success).
      return sendSuccess(res, { resetToken: token }, 'Password reset initiated');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // ORGANIZATIONS
  // ---------------------------------------------------------------------------
  static async listOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orgs = await prisma.organization.findMany({
        include: { 
          subscriptions: { include: { plan: true } },
          _count: { select: { memberships: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return sendSuccess(res, orgs, 'Organizations retrieved');
    } catch (error) { next(error); }
  }

  static async updateOrganizationStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const org = await prisma.organization.update({
        where: { id },
        data: { status }
      });

      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_organization_status',
        status: 'success',
        reason: `Changed status to ${status} for org ${org.name}`,
        organizationId: id,
        ipAddress: req.ip,
      });

      return sendSuccess(res, org, 'Organization status updated');
    } catch (error) { next(error); }
  }

  static async provisionOrganization(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orgName, slug, domain, planId, adminEmail, adminFirstName, adminLastName } = req.body;

      // Ensure plan exists
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
        include: { entitlements: true }
      });
      if (!plan) throw new Error("Plan not found");

      // Check if user exists
      let user = await prisma.user.findUnique({ where: { email: adminEmail } });

      // Run entire provisioning in an atomic transaction
      const org = await prisma.$transaction(async (tx) => {
        // 1. Create or ensure user
        if (!user) {
          const crypto = require('crypto');
          const tempPassword = crypto.randomBytes(16).toString('hex');
          const bcrypt = require('bcryptjs');
          const hash = await bcrypt.hash(tempPassword, 10);
          user = await tx.user.create({
            data: {
              email: adminEmail,
              firstName: adminFirstName,
              lastName: adminLastName,
              passwordHash: hash,
              isVerified: true
            }
          });
        }

        // 2. Create Organization
        const organization = await tx.organization.create({
          data: {
            name: orgName,
            slug,
            domain,
            settings: {
              create: { branding: {}, localization: {} }
            }
          }
        });

        // 3. Create Subscription
        const now = new Date();
        const nextPeriod = new Date(now);
        if (plan.interval === 'year') nextPeriod.setFullYear(now.getFullYear() + 1);
        else nextPeriod.setMonth(now.getMonth() + 1);

        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: plan.id,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriod,
            status: 'active'
          }
        });

        // 4. Activate Plan Modules for Org
        const activeModuleIds = plan.entitlements.map(e => e.moduleId).filter(Boolean) as string[];
        if (activeModuleIds.length > 0) {
          await tx.organizationModule.createMany({
            data: activeModuleIds.map(moduleId => ({
              organizationId: organization.id,
              moduleId,
              isActive: true
            })),
            skipDuplicates: true
          });
        }

        // 5. Create Default Roles & Permissions
        const adminRole = await tx.role.create({
          data: {
            organizationId: organization.id,
            name: 'Admin',
            description: 'Full organization administrator',
            isSystem: true,
            permissions: {
              create: [
                {
                  permission: {
                    create: { action: '*', resource: 'all', isDelegatable: true, description: 'All Permissions' }
                  }
                }
              ]
            }
          }
        });

        await tx.role.create({
          data: {
            organizationId: organization.id,
            name: 'Member',
            description: 'Standard employee',
            isSystem: true
          }
        });

        // Give Admin role full access to org resources (wildcard or specific). 
        // For now, we will assume Admin role gives all access within tenant.

        // 6. Create Membership & Assign Admin Role
        const membership = await tx.organizationMembership.create({
          data: {
            organizationId: organization.id,
            userId: user!.id,
            roles: {
              create: { roleId: adminRole.id }
            }
          }
        });

        return organization;
      });

      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:provision_organization',
        status: 'success',
        reason: `Provisioned org ${org.name} with admin ${adminEmail}`,
        organizationId: org.id,
        ipAddress: req.ip,
      });

      return sendSuccess(res, org, 'Organization provisioned successfully', 201);
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // MODULES
  // ---------------------------------------------------------------------------
  static async listModules(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const modules = await ModuleRegistryService.getModules();
      return sendSuccess(res, modules, 'Modules retrieved');
    } catch (error) { next(error); }
  }

  static async registerModule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const mod = await ModuleRegistryService.registerModule(req.body);
      
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:register_module',
        status: 'success',
        reason: `Registered module ${mod.name}`,
        ipAddress: req.ip,
      });

      return sendSuccess(res, mod, 'Module registered', 201);
    } catch (error) { next(error); }
  }

  static async toggleModuleStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const mod = await prisma.module.update({
        where: { id },
        data: { status }
      });

      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_module_status',
        status: 'success',
        reason: `Changed module ${mod.name} status to ${status}`,
        ipAddress: req.ip,
      });

      return sendSuccess(res, mod, 'Module status updated');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION PLANS
  // ---------------------------------------------------------------------------
  static async listPlans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plans = await prisma.subscriptionPlan.findMany({
        orderBy: { price: 'asc' },
        include: { entitlements: true }
      });
      return sendSuccess(res, plans, 'Plans retrieved');
    } catch (error) { next(error); }
  }

  static async createPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, description, price, currency, interval, trialDays, isActive, entitlements } = req.body;
      
      const plan = await prisma.subscriptionPlan.create({ 
        data: {
          name, description, price, currency, interval, trialDays, isActive,
          entitlements: {
            create: entitlements || []
          }
        },
        include: { entitlements: true }
      });
      
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:create_plan',
        status: 'success',
        reason: `Created plan ${plan.name} with ${entitlements?.length || 0} entitlements`,
        ipAddress: req.ip,
      });

      return sendSuccess(res, plan, 'Plan created', 201);
    } catch (error) { next(error); }
  }

  static async assignSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orgId, planId } = req.body;
      const sub = await SubscriptionService.assignSubscription(orgId, planId);
      
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:assign_subscription',
        status: 'success',
        reason: `Assigned plan ${planId} to org ${orgId}`,
        organizationId: orgId,
        ipAddress: req.ip,
      });

      return sendSuccess(res, sub, 'Subscription assigned');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // FEATURE FLAGS (GLOBAL)
  // ---------------------------------------------------------------------------
  static async listFeatureFlags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const flags = await prisma.featureFlag.findMany({
        orderBy: { key: 'asc' }
      });
      return sendSuccess(res, flags, 'Feature flags retrieved');
    } catch (error) { next(error); }
  }

  static async toggleFeatureFlag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { isEnabled } = req.body;
      
      const flag = await prisma.featureFlag.update({
        where: { id },
        data: { isEnabled }
      });

      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:toggle_feature_flag',
        status: 'success',
        reason: `Toggled flag ${flag.key} to ${isEnabled}`,
        ipAddress: req.ip,
      });

      return sendSuccess(res, flag, 'Feature flag updated');
    } catch (error) { next(error); }
  }

  static async createFeatureFlag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const flag = await prisma.featureFlag.create({ data: req.body });
      
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:create_feature_flag',
        status: 'success',
        reason: `Created flag ${flag.key}`,
        ipAddress: req.ip,
      });

      return sendSuccess(res, flag, 'Feature flag created', 201);
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGS (GLOBAL)
  // ---------------------------------------------------------------------------
  static async listAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take: limit,
          include: {
            user: { select: { email: true } },
            organization: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.auditLog.count()
      ]);

      return sendSuccess(res, { data: logs, meta: { total, page, limit } }, 'Audit logs retrieved');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // HEALTH & SYSTEM
  // ---------------------------------------------------------------------------
  static async healthCheck(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbStatus = await prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down');
      return sendSuccess(res, {
        db: dbStatus,
        uptime: process.uptime(),
        env: process.env.NODE_ENV,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
      }, 'System health');
    } catch (error) { next(error); }
  }

  // ---------------------------------------------------------------------------
  // NEW APIS FOR FREEZE GATE
  // ---------------------------------------------------------------------------

  // PLANS
  static async getPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: req.params.id as string },
        include: { entitlements: true }
      });
      if (!plan) throw new Error("Plan not found");
      return sendSuccess(res, plan, 'Plan retrieved');
    } catch (error) { next(error); }
  }

  static async updatePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plan = await prisma.subscriptionPlan.update({
        where: { id: req.params.id as string },
        data: req.body
      });
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_plan',
        status: 'success',
        reason: `Updated plan ${plan.name}`,
        ipAddress: req.ip,
      });
      return sendSuccess(res, plan, 'Plan updated');
    } catch (error) { next(error); }
  }

  static async updatePlanEntitlements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { entitlements } = req.body; // array of entitlements
      
      const plan = await prisma.$transaction(async (tx) => {
        // Delete old
        await tx.planEntitlement.deleteMany({ where: { planId: id } });
        // Insert new
        if (entitlements && entitlements.length > 0) {
          await tx.planEntitlement.createMany({
            data: entitlements.map((e: any) => ({ ...e, planId: id }))
          });
        }
        return tx.subscriptionPlan.findUnique({
          where: { id },
          include: { entitlements: true }
        });
      });

      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_plan_entitlements',
        status: 'success',
        reason: `Updated entitlements for plan ${id}`,
        ipAddress: req.ip,
      });

      return sendSuccess(res, plan, 'Plan entitlements updated');
    } catch (error) { next(error); }
  }

  // MODULES
  static async updateModule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const mod = await prisma.module.update({
        where: { id: req.params.id as string },
        data: req.body
      });
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_module',
        status: 'success',
        reason: `Updated module ${mod.name}`,
        ipAddress: req.ip,
      });
      return sendSuccess(res, mod, 'Module updated');
    } catch (error) { next(error); }
  }

  // FEATURE FLAGS
  static async updateFeatureFlag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const flag = await prisma.featureFlag.update({
        where: { id: req.params.id as string },
        data: req.body
      });
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_feature_flag',
        status: 'success',
        reason: `Updated flag ${flag.key}`,
        ipAddress: req.ip,
      });
      return sendSuccess(res, flag, 'Feature flag updated');
    } catch (error) { next(error); }
  }

  static async deleteFeatureFlag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const flag = await prisma.featureFlag.delete({ where: { id } });
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:delete_feature_flag',
        status: 'success',
        reason: `Deleted flag ${flag.key}`,
        ipAddress: req.ip,
      });
      return sendSuccess(res, null, 'Feature flag deleted');
    } catch (error) { next(error); }
  }

  // PERMISSIONS
  static async listPermissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const permissions = await prisma.permission.findMany();
      return sendSuccess(res, permissions, 'Permissions retrieved');
    } catch (error) { next(error); }
  }

  static async createPermission(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const perm = await prisma.permission.create({ data: req.body });
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:create_permission',
        status: 'success',
        reason: `Created permission ${perm.action} on ${perm.resource}`,
        ipAddress: req.ip,
      });
      return sendSuccess(res, perm, 'Permission created', 201);
    } catch (error) { next(error); }
  }

  static async updatePermission(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const perm = await prisma.permission.update({
        where: { id: req.params.id as string },
        data: req.body
      });
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:update_permission',
        status: 'success',
        reason: `Updated permission ${perm.action} on ${perm.resource}`,
        ipAddress: req.ip,
      });
      return sendSuccess(res, perm, 'Permission updated');
    } catch (error) { next(error); }
  }

  static async deletePermission(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const perm = await prisma.permission.delete({ where: { id } });
      await AuditLogService.log({
        userId: req.user!.id,
        action: 'superadmin:delete_permission',
        status: 'success',
        reason: `Deleted permission ${perm.action} on ${perm.resource}`,
        ipAddress: req.ip,
      });
      return sendSuccess(res, null, 'Permission deleted');
    } catch (error) { next(error); }
  }

  // ORG SIMULATOR
  static async getOrganizationSimulator(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      // Also get EntitlementService resolution
      const EntitlementService = require('../services/entitlement.service').EntitlementService;
      const effectiveEntitlements = await EntitlementService.getOrganizationEntitlements(id);
      
      const org = await prisma.organization.findUnique({
        where: { id },
        include: {
          subscriptions: {
            where: { status: { in: ['active', 'trialing', 'past_due'] } },
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          featureFlags: true,
          modules: true,
          _count: {
            select: { memberships: true, teams: true, departments: true }
          }
        }
      });
      
      return sendSuccess(res, {
        organization: org,
        effectiveState: effectiveEntitlements
      }, 'Simulator data retrieved');
    } catch (error) { next(error); }
  }

  static async getOrganization(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.params.id as string },
        include: { 
          subscriptions: { include: { plan: true } },
          _count: { select: { memberships: true } }
        }
      });
      return sendSuccess(res, org, 'Organization retrieved');
    } catch (error) { next(error); }
  }
}
