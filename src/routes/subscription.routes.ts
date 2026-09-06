import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth);

router.get('/plans', SubscriptionController.listPlans);

router.use(requireTenant);
router.get('/current', SubscriptionController.getCurrent);

export default router;
