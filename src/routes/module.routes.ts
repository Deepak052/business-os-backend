import { Router } from 'express';
import { ModuleController } from '../controllers/module.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth);

router.get('/all', ModuleController.listAll);

router.use(requireTenant);
router.get('/active', ModuleController.listActive);
router.post('/active', ModuleController.enable);
router.delete('/active/:id', ModuleController.disable);

export default router;
