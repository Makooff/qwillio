import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth.middleware';
import { clientMiddleware } from '../middleware/auth.middleware';
import { clientDashboardController } from '../controllers/client-dashboard.controller';

const billingLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req: any) => req.clientId || req.ip,
  message: { error: 'Too many billing requests, please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// All routes require JWT auth + client role
router.use(authMiddleware);
router.use(clientMiddleware);

// ─── Dashboard data ─────────────────────────────────────
router.get('/overview', (req, res) => clientDashboardController.getMyOverview(req, res));
router.get('/calls', (req, res) => clientDashboardController.getMyCalls(req, res));
router.get('/bookings', (req, res) => clientDashboardController.getMyBookings(req, res));
router.get('/leads', (req, res) => clientDashboardController.getMyLeads(req, res));
router.get('/analytics', (req, res) => clientDashboardController.getMyAnalytics(req, res));

// ─── Lead management ────────────────────────────────────
router.put('/leads/:id/status', (req, res) => clientDashboardController.updateLeadStatus(req, res));
router.put('/leads/:id/notes', (req, res) => clientDashboardController.updateLeadNotes(req, res));

// ─── Integrations ───────────────────────────────────────
router.get('/integrations/google-calendar/auth-url', (req, res) => clientDashboardController.getGoogleCalendarAuthUrl(req, res));
router.post('/integrations/google-calendar/callback', (req, res) => clientDashboardController.connectGoogleCalendar(req, res));
router.get('/integrations/google-calendar/status', (req, res) => clientDashboardController.googleCalendarStatus(req, res));
router.delete('/integrations/google-calendar', (req, res) => clientDashboardController.disconnectGoogleCalendar(req, res));

// ─── Receptionist settings ──────────────────────────────
router.get('/settings', (req, res) => clientDashboardController.getMySettings(req, res));
router.put('/settings', (req, res) => clientDashboardController.updateMySettings(req, res));
router.get('/characters', (req, res) => clientDashboardController.getCharacters(req, res));
router.post('/assistant/chat', (req, res) => clientDashboardController.assistantChat(req, res));
router.post('/pause', (req, res) => clientDashboardController.pauseAgent(req, res));
router.post('/resume', (req, res) => clientDashboardController.resumeAgent(req, res));

// ─── Account ────────────────────────────────────────────
router.put('/profile', (req, res) => clientDashboardController.updateProfile(req, res));
router.put('/password', (req, res) => clientDashboardController.changePassword(req, res));
router.get('/billing', (req, res) => clientDashboardController.getBilling(req, res));
router.post('/cancel', (req, res) => clientDashboardController.cancelSubscription(req, res));
router.post('/upgrade', billingLimiter, (req, res) => clientDashboardController.upgradeSubscription(req, res));

// ─── Agent modules ──────────────────────────────────────
router.put('/agent-modules', (req, res) => clientDashboardController.updateAgentModules(req, res));

// ─── Notifications ──────────────────────────────────────
router.put('/notifications', (req, res) => clientDashboardController.updateNotifications(req, res));

// ─── Support ────────────────────────────────────────────
router.post('/support', (req, res) => clientDashboardController.sendSupport(req, res));

export default router;
