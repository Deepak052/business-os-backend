import { Router } from 'express';
import { HrmsAttendanceController, HrmsPayrollController, HrmsPerformanceController } from '../controllers/extensions.controller';
import { requirePermission } from '../../../middlewares/rbac.middleware';

const router = Router();

// Attendance
router.get('/attendance', requirePermission('hrms:attendance:view'), HrmsAttendanceController.list);
router.post('/attendance', requirePermission('hrms:attendance:manage'), HrmsAttendanceController.logTime);

// Payroll
router.get('/payroll', requirePermission('hrms:payroll:view'), HrmsPayrollController.list);
router.post('/payroll/generate', requirePermission('hrms:payroll:manage'), HrmsPayrollController.generate);

// Performance
router.get('/performance', requirePermission('hrms:performance:view'), HrmsPerformanceController.list);
router.post('/performance', requirePermission('hrms:performance:manage'), HrmsPerformanceController.createReview);

export default router;
