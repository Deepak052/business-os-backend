import { Router } from 'express';
import { HrmsAttendanceController } from '../controllers/attendance.controller';
import { requirePermission } from '../../../middlewares/rbac.middleware';
import { requireAuth } from '../../../middlewares/auth.middleware';

const router = Router();

// Self-service routes (only require authenticated active employee + self-ownership)
// The self-ownership and active status is checked in the controller
router.get('/me', requireAuth, HrmsAttendanceController.listMe);
router.post('/clock-in', requireAuth, HrmsAttendanceController.clockIn);
router.post('/clock-out', requireAuth, HrmsAttendanceController.clockOut);

// Manager routes
router.get('/', requirePermission('hrms:attendance:view'), HrmsAttendanceController.list);
router.put('/:id', requirePermission('hrms:attendance:manage'), HrmsAttendanceController.correct);

export default router;
