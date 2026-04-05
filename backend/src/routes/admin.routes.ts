import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', (req, res) => adminController.getStats(req, res));
router.get('/activity-feed', (req, res) => adminController.getActivityFeed(req, res));
router.get('/bot-config', (req, res) => adminController.getBotConfig(req, res));
router.post('/bot-config', (req, res) => adminController.saveBotConfig(req, res));

export default router;
