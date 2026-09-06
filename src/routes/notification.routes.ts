import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requireTenant, NotificationController.getUnread);
router.patch('/:id/read', requireTenant, NotificationController.markAsRead);

export default router;
