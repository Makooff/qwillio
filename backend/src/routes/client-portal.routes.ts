import { Router, Request, Response, NextFunction } from 'express';
import { clientDashboardController } from '../controllers/client-dashboard.controller';
import { prisma } from '../config/database';

const router = Router();

// ═══════════════════════════════════════════════════════════
// CLIENT PORTAL ROUTES - Token-authenticated API
// Clients access via dashboardToken query param
// ═══════════════════════════════════════════════════════════

/**
 * Middleware: validate dashboardToken for client portal access
 */
async function clientPortalAuth(req: Request, res: Response, next: NextFunction) {
  const clientId = req.params.clientId as string;
  const headerToken = req.headers['x-client-token'];
  const token = (req.query.token as string) || (typeof headerToken === 'string' ? headerToken : undefined);

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, dashboardToken: true, subscriptionStatus: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.dashboardToken || client.dashboardToken !== token) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (client.subscriptionStatus === 'canceled') {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// Apply auth to all client portal routes
router.use('/:clientId', clientPortalAuth);

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
