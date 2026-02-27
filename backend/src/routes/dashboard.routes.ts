import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/stats', (req, res) => dashboardController.getStats(req, res));
router.get('/revenue-history', (req, res) => dashboardController.getRevenueHistory(req, res));
router.get('/activity', (req, res) => dashboardController.getRecentActivity(req, res));

export default router;
