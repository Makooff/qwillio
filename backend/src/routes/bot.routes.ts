import { Router } from 'express';
import { botController } from '../controllers/bot.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Bot loop control
router.post('/start', (req, res) => botController.start(req, res));
router.post('/stop', (req, res) => botController.stop(req, res));
router.get('/status', (req, res) => botController.getStatus(req, res));

// Manual triggers (for testing)
router.post('/trigger/prospection', (req, res) => botController.triggerProspection(req, res));
router.post('/trigger/call', (req, res) => botController.triggerCall(req, res));
router.post('/trigger/reminders', (req, res) => botController.triggerReminders(req, res));
router.post('/trigger/test-call', (req, res) => botController.triggerTestCall(req, res));
router.post('/trigger/simulate-call', (req, res) => botController.simulateCallResult(req, res));

export default router;
