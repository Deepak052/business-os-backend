import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { TeamController } from '../controllers/team.controller';
import { DepartmentController } from '../controllers/department.controller';
import { validate } from '../middlewares/validate.middleware';
import { createOrganizationSchema, updateSettingsSchema, createTeamSchema, createDepartmentSchema } from '../validators/organization.validator';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';
import { requireActiveSubscriptionForWrites } from '../middlewares/entitlement.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

// Create organization doesn't require tenant middleware, just auth
router.post('/', requireAuth, validate(createOrganizationSchema), OrganizationController.create);

// Routes requiring active tenant context
router.use(requireAuth, requireTenant, requireActiveSubscriptionForWrites);

router.get('/current', OrganizationController.get);
router.patch('/settings', requirePermission('manage:organization_settings'), validate(updateSettingsSchema), OrganizationController.updateSettings);

// Entitlements & Features
router.get('/subscription', OrganizationController.getSubscription);
router.patch('/subscription/plan', requirePermission('manage:organization_settings'), OrganizationController.upgradePlan);
router.patch('/subscription/expire-trial', requirePermission('manage:organization_settings'), OrganizationController.expireTrial);
router.get('/feature-flags', OrganizationController.getFeatureFlags);

// Audit Logs
router.get('/audit-logs', requirePermission('manage:organization_settings'), OrganizationController.getAuditLogs);

// Teams
router.get('/teams', TeamController.list);
router.post('/teams', requirePermission('manage:teams'), validate(createTeamSchema), TeamController.create);
router.patch('/teams/:id', requirePermission('manage:teams'), validate(createTeamSchema), TeamController.update);
router.delete('/teams/:id', requirePermission('manage:teams'), TeamController.delete);

// Departments
router.get('/departments', DepartmentController.list);
router.post('/departments', requirePermission('manage:departments'), validate(createDepartmentSchema), DepartmentController.create);
router.patch('/departments/:id', requirePermission('manage:departments'), validate(createDepartmentSchema), DepartmentController.update);
router.delete('/departments/:id', requirePermission('manage:departments'), DepartmentController.delete);

export default router;
