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

// Dictation fans out to a paid transcription API with multi-megabyte bodies,
// so it gets its own budget per client. Generous enough for normal dictation,
// tight enough that a runaway loop cannot bill the account dry.
const transcribeLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req: any) => req.clientId || req.ip,
  message: { error: 'transcription_rate_limited' },
  standardHeaders: true,
  legacyHeaders: false,
});

const extractLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  keyGenerator: (req: any) => req.clientId || req.ip,
  message: { error: 'extraction_rate_limited' },
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
router.get('/characters/:id/preview', (req, res) => clientDashboardController.characterPreview(req, res));
// Fired by the settings page on open so the clips exist before anyone presses
// ▶. Rate-limited with the other paid fan-outs: a loop here would synthesise
// the catalog over and over.
router.post('/characters/warm', extractLimiter, (req, res) => clientDashboardController.warmCharacterPreviews(req, res));
router.get('/voices', (req, res) => clientDashboardController.listVoices(req, res));

/* Clés d'API, réservées au forfait qui les annonce. La clé complète n'est
   renvoyée qu'à la création: la liste ne montre que le nom et l'usage. */
router.get('/api-keys', (req, res) => clientDashboardController.listApiKeys(req, res));
router.post('/api-keys', (req, res) => clientDashboardController.createApiKey(req, res));
router.delete('/api-keys/:id', (req, res) => clientDashboardController.revokeApiKey(req, res));

/* Lignes supplémentaires (multi-sites), reserve au forfait qui les annonce. */
router.get('/phone-numbers', (req, res) => clientDashboardController.listPhoneNumbers(req, res));
router.post('/phone-numbers', (req, res) => clientDashboardController.addPhoneNumber(req, res));
router.delete('/phone-numbers/:id', (req, res) => clientDashboardController.removePhoneNumber(req, res));
// Voice cloning. Same budget as dictation — a multi-megabyte body going to a
// paid API, and a retry loop here would both bill the account and litter it
// with dead voices.
router.post('/voice-clone', transcribeLimiter, (req, res) => clientDashboardController.createVoiceClone(req, res));
router.delete('/voice-clone', (req, res) => clientDashboardController.deleteVoiceClone(req, res));
router.post('/assistant/chat', (req, res) => clientDashboardController.assistantChat(req, res));
router.post('/assistant/transcribe', transcribeLimiter, (req, res) => clientDashboardController.assistantTranscribe(req, res));
// Vision costs more per call than transcription, hence the tighter budget.
router.post('/assistant/extract-items', extractLimiter, (req, res) => clientDashboardController.assistantExtractItems(req, res));
router.get('/voice/live-config', (req, res) => clientDashboardController.voiceLiveConfig(req, res));
// Talk to the SETUP assistant by voice. Same voice quality as the receptionist,
// different job: it changes settings, it does not answer callers.
router.get('/assistant/voice-config', (req, res) => clientDashboardController.assistantVoiceConfig(req, res));
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
