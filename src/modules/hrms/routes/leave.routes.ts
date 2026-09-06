import { Router } from 'express';
import { HrmsLeaveController } from '../controllers/leave.controller';
import { requirePermission } from '../../../middlewares/rbac.middleware';

const router = Router();

router.get('/', requirePermission('hrms:leave:view'), HrmsLeaveController.list);
router.post('/', requirePermission('hrms:leave:view'), HrmsLeaveController.requestLeave);
router.post('/:id/approve', requirePermission('hrms:leave:manage'), HrmsLeaveController.approve);
router.post('/:id/reject', requirePermission('hrms:leave:manage'), HrmsLeaveController.reject);

export default router;
