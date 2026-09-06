import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant } from '../middlewares/tenant.middleware';

const router = Router();

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/register-invited', AuthController.registerInvited);
router.post('/validate-invitation', AuthController.validateInvitation);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.me);
router.get('/permissions', requireAuth, requireTenant, AuthController.getPermissions);

export default router;
