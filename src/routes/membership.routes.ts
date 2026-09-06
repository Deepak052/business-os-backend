import { Router } from 'express';
import { MembershipController } from '../controllers/membership.controller';
import { validate } from '../middlewares/validate.middleware';
import { inviteUserSchema, acceptInviteSchema } from '../validators/membership.validator';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';
import { requireActiveSubscriptionForWrites } from '../middlewares/entitlement.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

// Accept invitation (requires Auth, but not Tenant since user is joining a tenant)
router.post('/accept', requireAuth, validate(acceptInviteSchema), MembershipController.accept);

// Tenant-scoped routes
router.use(requireAuth, requireTenant, requireActiveSubscriptionForWrites);

router.get('/', requirePermission('view:members'), MembershipController.list);
router.get('/invitations', requirePermission('view:members'), MembershipController.listInvitations);
router.post('/invite', requirePermission('manage:members'), validate(inviteUserSchema), MembershipController.invite);
router.patch('/:id', requirePermission('manage:members'), MembershipController.update);
router.patch('/:id/status', requirePermission('manage:members'), MembershipController.updateStatus);
router.post('/:id/resend', requirePermission('manage:members'), MembershipController.resendInvitation);
router.delete('/:id/revoke', requirePermission('manage:members'), MembershipController.revokeInvitation);
router.delete('/:id', requirePermission('manage:members'), MembershipController.remove);

export default router;
