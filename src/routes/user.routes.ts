import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';
import { requireActiveSubscriptionForWrites } from '../middlewares/entitlement.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { listUsersSchema, getUserSchema } from '../validators/user.validator';

const router = Router();

router.use(requireAuth, requireTenant, requireActiveSubscriptionForWrites);

router.get('/', requirePermission('manage:users'), validate(listUsersSchema), UserController.list);
router.get('/:id', requirePermission('manage:users'), validate(getUserSchema), UserController.get);

export default router;
