import { Router } from 'express';
import { HrmsEmployeeController } from '../controllers/employee.controller';
import { requirePermission } from '../../../middlewares/rbac.middleware';

const router = Router();

router.get('/', requirePermission('hrms:employee:view'), HrmsEmployeeController.list);
router.get('/:id', requirePermission('hrms:employee:view'), HrmsEmployeeController.getById);
router.post('/', requirePermission('hrms:employee:manage'), HrmsEmployeeController.create);
router.patch('/:id', requirePermission('hrms:employee:manage'), HrmsEmployeeController.update);
router.patch('/:id/status', requirePermission('hrms:employee:manage'), HrmsEmployeeController.updateStatus);

export default router;
