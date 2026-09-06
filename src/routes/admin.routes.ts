import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/superadmin.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  updateUserStatusSchema,
  updateOrganizationStatusSchema,
  registerModuleSchema,
  toggleModuleStatusSchema,
  updateModuleSchema,
  createPlanSchema,
  updatePlanSchema,
  updatePlanEntitlementsSchema,
  assignSubscriptionSchema,
  createFeatureFlagSchema,
  toggleFeatureFlagSchema,
  provisionOrganizationSchema,
  createPermissionSchema,
  updatePermissionSchema
} from '../validators/admin.validator';

const router = Router();

// Protect ALL admin routes with centralized superadmin policy
router.use(requireAuth, requireSuperAdmin);

// Health & Overview
router.get('/health', AdminController.healthCheck);
router.get('/overview', AdminController.getOverviewMetrics);
router.get('/audit-logs', AdminController.getAuditLogs);

// Users
router.get('/users', AdminController.listUsers);
router.patch('/users/:id/status', validate(updateUserStatusSchema), AdminController.updateUserStatus);
router.post('/users/:id/force-password-reset', AdminController.forcePasswordReset);
// router.post('/users/:id/revoke-sessions', AdminController.revokeSessions); // Optional, we can add later

// Organizations
router.get('/organizations', AdminController.listOrganizations);
router.post('/organizations/provision', validate(provisionOrganizationSchema), AdminController.provisionOrganization);
router.get('/organizations/:id', AdminController.getOrganization);
router.patch('/organizations/:id/status', validate(updateOrganizationStatusSchema), AdminController.updateOrganizationStatus);
router.get('/organizations/:id/simulator', AdminController.getOrganizationSimulator);

// Modules
router.get('/modules', AdminController.listModules);
router.post('/modules', validate(registerModuleSchema), AdminController.registerModule);
router.patch('/modules/:id', validate(updateModuleSchema), AdminController.updateModule);
router.patch('/modules/:id/status', validate(toggleModuleStatusSchema), AdminController.toggleModuleStatus);

// Subscription Plans
router.get('/plans', AdminController.listPlans);
router.post('/plans', validate(createPlanSchema), AdminController.createPlan);
router.get('/plans/:id', AdminController.getPlan);
router.patch('/plans/:id', validate(updatePlanSchema), AdminController.updatePlan);
router.post('/plans/:id/entitlements', validate(updatePlanEntitlementsSchema), AdminController.updatePlanEntitlements);
router.post('/subscriptions/assign', validate(assignSubscriptionSchema), AdminController.assignSubscription);

// Feature Flags
router.get('/feature-flags', AdminController.listFeatureFlags);
router.post('/feature-flags', validate(createFeatureFlagSchema), AdminController.createFeatureFlag);
router.patch('/feature-flags/:id', validate(toggleFeatureFlagSchema), AdminController.toggleFeatureFlag);
router.delete('/feature-flags/:id', AdminController.deleteFeatureFlag);

// Permissions
router.get('/permissions', AdminController.listPermissions);
router.post('/permissions', validate(createPermissionSchema), AdminController.createPermission);
router.patch('/permissions/:id', validate(updatePermissionSchema), AdminController.updatePermission);
router.delete('/permissions/:id', AdminController.deletePermission);

// Audit Logs
router.get('/audit-logs', AdminController.listAuditLogs);

export default router;
