import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', (req, res) => dashboardController.getStats(req, res));
router.get('/revenue-history', (req, res) => dashboardController.getRevenueHistory(req, res));
router.get('/activity', (req, res) => dashboardController.getRecentActivity(req, res));
router.get('/calls', (req, res) => dashboardController.getCalls(req, res));
router.get('/leads', (req, res) => dashboardController.getLeads(req, res));

export default router;
