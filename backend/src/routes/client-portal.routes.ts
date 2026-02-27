import { Router } from 'express';
import { clientDashboardController } from '../controllers/client-dashboard.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════
// CLIENT PORTAL ROUTES - Public API for client dashboards
// No auth required - clients access via unique client ID
// (In production, add API key or client token auth)
// ═══════════════════════════════════════════════════════════

// Client overview (main dashboard)
router.get('/:clientId/overview', (req, res) => clientDashboardController.getOverview(req, res));

// Call history (filterable, paginated)
router.get('/:clientId/calls', (req, res) => clientDashboardController.getCalls(req, res));

// Bookings (upcoming & past)
router.get('/:clientId/bookings', (req, res) => clientDashboardController.getBookings(req, res));

// Leads collected by AI
router.get('/:clientId/leads', (req, res) => clientDashboardController.getLeads(req, res));

// Detailed analytics (conversion, sentiment, peak hours)
router.get('/:clientId/analytics', (req, res) => clientDashboardController.getAnalytics(req, res));

export default router;
