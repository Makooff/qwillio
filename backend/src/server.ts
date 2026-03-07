import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { errorMiddleware } from './middleware/error.middleware';
import { botLoop } from './jobs/bot-loop';

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

const app = express();

// ─── Security ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL.split(','),
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
