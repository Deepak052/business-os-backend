import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';
import { requireActiveSubscriptionForWrites } from '../middlewares/entitlement.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(requireAuth, requireTenant, requireActiveSubscriptionForWrites);

// Permissions are needed for UI to render roles correctly
router.get('/', RoleController.listRoles);
router.get('/permissions', RoleController.listPermissions);

router.post('/', requirePermission('manage:roles'), RoleController.createRole);
router.patch('/:id', requirePermission('manage:roles'), RoleController.updateRole);
router.delete('/:id', requirePermission('manage:roles'), RoleController.deleteRole);
router.post('/:id/clone', requirePermission('manage:roles'), RoleController.cloneRole);

export default router;
