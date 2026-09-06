import { Router } from 'express';
import { HrmsPayrollController } from '../controllers/payroll.controller';
import { requirePermission } from '../../../middlewares/rbac.middleware';
import { requireAuth } from '../../../middlewares/auth.middleware';

const router = Router();

// Employee routes
router.get('/me', requireAuth, HrmsPayrollController.listMe);
router.get('/:id', requireAuth, HrmsPayrollController.viewOwn);

// Manager routes
router.get('/', requirePermission('hrms:payroll:view'), HrmsPayrollController.list);
router.post('/', requirePermission('hrms:payroll:manage'), HrmsPayrollController.createDraft);
router.post('/:id/pay', requirePermission('hrms:payroll:manage'), HrmsPayrollController.pay);

export default router;
