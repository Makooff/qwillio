import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware, requireConfirmedEmail } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', (req, res) => authController.login(req, res));
router.post('/register', (req, res) => authController.register(req, res));
router.post('/google', (req, res) => authController.googleAuth(req, res));
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));
router.get('/confirm/:token', (req, res) => authController.confirmEmail(req, res));
/* Confirmation d'un CHANGEMENT d'adresse. Publique et en GET: le lien est
   cliqué depuis une boîte mail, où il n'y a ni session ni jeton d'API. Elle
   REDIRIGE vers le portail plutôt que de rendre du JSON, parce que ce qui
   s'affiche ici est une page, pas une réponse d'API. */
router.get('/confirm-email-change/:token', (req, res) => authController.confirmEmailChange(req, res));
router.post('/resend-confirmation', authMiddleware, (req, res) => authController.resendConfirmation(req, res));
// Sign-up gates: the card step and the final step both require a real address.
router.post('/checkout', authMiddleware, requireConfirmedEmail, (req, res) => authController.startSubscription(req, res));
router.post('/onboard', authMiddleware, requireConfirmedEmail, (req, res) => authController.onboard(req, res));
router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));

export default router;
