import { Router } from 'express';
import authRoutes from './auth.routes';
import orgRoutes from './organization.routes';
import membershipRoutes from './membership.routes';
import adminRoutes from './admin.routes';
import crmRoutes from '../modules/crm/routes/crm.routes';
import hrmsRoutes from '../modules/hrms/routes/hrms.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import subscriptionRoutes from './subscription.routes';
import moduleRoutes from './module.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/organizations', orgRoutes);
router.use('/memberships', membershipRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/modules', moduleRoutes);
router.use('/crm', crmRoutes);
router.use('/hrms', hrmsRoutes);
router.use('/notifications', notificationRoutes);

export default router;
