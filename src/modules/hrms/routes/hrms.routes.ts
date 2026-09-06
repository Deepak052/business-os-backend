import { Router } from 'express';
import { requireAuth } from '../../../middlewares/auth.middleware';
import { requireTenant } from '../../../middlewares/tenant.middleware';
import { requireModuleKey } from '../../../middlewares/module.middleware';
import { requirePermission } from '../../../middlewares/rbac.middleware';

import employeeRoutes from './employee.routes';
import leaveRoutes from './leave.routes';
import extensionRoutes from './extensions.routes';
import attendanceRoutes from './attendance.routes';
import payrollRoutes from './payroll.routes';

const router = Router();

// Apply Platform Core security chain to ALL HRMS routes
router.use(requireAuth);
router.use(requireTenant);
router.use(requireModuleKey('hrms'));

// Sub-routers
router.use('/employees', employeeRoutes);
router.use('/leaves', leaveRoutes);
router.use('/extensions', extensionRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/payroll', payrollRoutes);

// Health check endpoint for testing the middleware chain
router.get('/health', requirePermission('hrms:employee:view'), (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      message: 'HRMS Module is active and accessible'
    }
  });
});

export default router;
