import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { clientMiddleware } from '../middleware/auth.middleware';
import { clientDashboardController } from '../controllers/client-dashboard.controller';

const router = Router();

// All routes require JWT auth + client role
router.use(authMiddleware);
router.use(clientMiddleware);

router.get('/overview', (req, res) => clientDashboardController.getMyOverview(req, res));
router.get('/calls', (req, res) => clientDashboardController.getMyCalls(req, res));
router.get('/bookings', (req, res) => clientDashboardController.getMyBookings(req, res));
router.get('/leads', (req, res) => clientDashboardController.getMyLeads(req, res));
router.get('/analytics', (req, res) => clientDashboardController.getMyAnalytics(req, res));

export default router;
