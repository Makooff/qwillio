import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', (req, res) => authController.login(req, res));
router.post('/register', (req, res) => authController.register(req, res));
router.post('/google', (req, res) => authController.googleAuth(req, res));
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));
router.get('/confirm/:token', (req, res) => authController.confirmEmail(req, res));
router.post('/resend-confirmation', authMiddleware, (req, res) => authController.resendConfirmation(req, res));
router.post('/onboard', authMiddleware, (req, res) => authController.onboard(req, res));
router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));

export default router;
