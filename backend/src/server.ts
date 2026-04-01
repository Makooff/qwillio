import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { errorMiddleware } from './middleware/error.middleware';
import { botLoop } from './jobs/bot-loop';

// ─── Sentry Error Monitoring ────────────────────────────
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
  logger.info('Sentry error monitoring initialized');
}

// Routes
import authRoutes from './routes/auth.routes';
import prospectsRoutes from './routes/prospects.routes';
import clientsRoutes from './routes/clients.routes';
import dashboardRoutes from './routes/dashboard.routes';
import botRoutes from './routes/bot.routes';
import campaignsRoutes from './routes/campaigns.routes';
import quotesRoutes from './routes/quotes.routes';
import webhooksRoutes from './routes/webhooks.routes';
import clientPortalRoutes from './routes/client-portal.routes';
import onboardingRoutes from './routes/onboarding.routes';
import adminAnalyticsRoutes from './routes/admin-analytics.routes';
import myDashboardRoutes from './routes/my-dashboard.routes';
import trialRoutes from './routes/trial.routes';
import agentRoutes from './routes/agent.routes';
import crmRoutes from './routes/crm.routes';
import aiLearningRoutes from './routes/ai-learning.routes';
import prospectingRoutes from './routes/prospecting.routes';

const app = express();

// ─── Security ────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = new Set(env.FRONTEND_URL.split(',').map(o => o.trim()));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin) || /\.vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─── Body Parsing ────────────────────────────────────────
// Stripe webhook needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
// Everything else uses JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ─────────────────────────────────────
app.use((req, _res, next) => {
  if (!req.path.includes('/webhooks/')) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/prospects', prospectsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/admin-analytics', adminAnalyticsRoutes);
app.use('/api/my-dashboard', myDashboardRoutes);
app.use('/api/trial', trialRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/ai', aiLearningRoutes);
app.use('/api/prospecting', prospectingRoutes);

// ─── Contact Form ─────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    // Send via Resend
    const { resend } = await import('./config/resend');
    await resend.emails.send({
      from: 'Qwillio Contact <noreply@qwillio.com>',
      to: 'hello@qwillio.com',
      replyTo: email,
      subject: `Contact Form — ${subject || 'General'} — ${name}`,
      html: `<p><strong>From:</strong> ${name} (${email})</p><p><strong>Subject:</strong> ${subject}</p><p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>`,
    });
    logger.info(`Contact form submitted by ${email}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ─── Unsubscribe ────────────────────────────────────────
app.get('/api/unsubscribe/:token', async (req, res) => {
  try {
    const email = Buffer.from(req.params.token, 'base64url').toString('utf-8');
    if (!email || !email.includes('@')) {
      res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;"><h2>Invalid link</h2></body></html>');
      return;
    }
    // Mark prospect as unsubscribed
    const updated = await prisma.prospect.updateMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      data: { emailUnsubscribed: true, emailUnsubscribedAt: new Date() },
    });
    if (updated.count > 0) {
      logger.info(`Email unsubscribed: ${email}`);
    }
    res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:60px;">
      <h2>You've been unsubscribed</h2>
      <p>You will no longer receive emails from Qwillio.</p>
      <p style="color:#888;margin-top:30px;">If this was a mistake, contact us at contact@qwillio.com</p>
    </body></html>`);
  } catch (error) {
    logger.error('Unsubscribe error:', error);
    res.status(500).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;"><h2>Something went wrong</h2></body></html>');
  }
});

// ─── Health Check ────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const botStatus = await botLoop.getStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      bot: botStatus,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ─── Error Handler ───────────────────────────────────────
if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorMiddleware);

// ─── Start Server ────────────────────────────────────────
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Initialize bot loop (creates bot_status record if needed)
    await botLoop.initialize();
    logger.info('Bot loop initialized');

    app.listen(env.PORT, () => {
      logger.info('═══════════════════════════════════════');
      logger.info(`  🚀 Qwillio API running on port ${env.PORT}`);
      logger.info(`  📊 Dashboard: ${env.FRONTEND_URL}`);
      logger.info(`  🔗 API: ${env.API_BASE_URL}`);
      logger.info(`  📦 Environment: ${env.NODE_ENV}`);
      logger.info('═══════════════════════════════════════');
      logger.info('');
      logger.info('  Endpoints:');
      logger.info('  POST /api/bot/start      → Start bot loop');
      logger.info('  POST /api/bot/stop       → Stop bot loop');
      logger.info('  GET  /api/bot/status      → Bot status');
      logger.info('  GET  /api/dashboard/stats → Dashboard');
      logger.info('  GET  /api/prospects       → Prospects list');
      logger.info('  GET  /api/clients         → Clients list');
      logger.info('  POST /api/webhooks/stripe → Stripe webhooks');
      logger.info('  POST /api/webhooks/vapi   → VAPI webhooks');
      logger.info('  GET  /api/client-portal/:id → Client dashboard');
      logger.info('');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await botLoop.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await botLoop.stop();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export default app;
