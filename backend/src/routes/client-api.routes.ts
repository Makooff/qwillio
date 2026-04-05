/**
 * Client API Routes — /api/client/*
 * All endpoints require JWT auth + client role.
 * These are canonical client endpoints; existing routes at /api/my-dashboard/*
 * remain fully functional.
 */
import { Router } from 'express';
import { authMiddleware, clientMiddleware } from '../middleware/auth.middleware';
import { clientDashboardController } from '../controllers/client-dashboard.controller';

const router = Router();

router.use(authMiddleware);
router.use(clientMiddleware);

/** GET /api/client/overview — dashboard KPIs for logged-in client */
router.get('/overview', (req, res) => clientDashboardController.getMyOverview(req, res));

/** GET /api/client/calls — call history */
router.get('/calls', (req, res) => clientDashboardController.getMyCalls(req, res));

/** GET /api/client/analytics — charts data */
router.get('/analytics', (req, res) => clientDashboardController.getMyAnalytics(req, res));

export default router;
