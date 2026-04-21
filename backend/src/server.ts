import * as Sentry from '@sentry/node';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { errorMiddleware } from './middleware/error.middleware';
import { botLoop } from './jobs/bot-loop';
import { initSocket } from './config/socket';

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
import adminRoutes from './routes/admin.routes';
import clientApiRoutes from './routes/client-api.routes';
import autofixRoutes from './routes/autofix.routes';

const app = express();

// ─── Security ────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = new Set(env.FRONTEND_URL.split(',').map(o => o.trim()).filter(Boolean));
app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /^https?:\/\/(www\.)?qwillio\.(com|app|io)$/.test(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin)
    ) {
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

// Stricter rate limit for auth routes (5 req/min)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many attempts, please try again in a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Body Parsing ────────────────────────────────────────
// Stripe webhook needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
// Everything else uses JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static assets ───────────────────────────────────────
app.use('/public', express.static(path.join(__dirname, '../public')));

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
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientApiRoutes);
app.use('/api/autofix', autofixRoutes);

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
    // Extract email address from "Name <email>" format if needed
    const fromEmail = env.RESEND_FROM_EMAIL.match(/<(.+)>/)?.[1] ?? env.RESEND_FROM_EMAIL;
    await resend.emails.send({
      from: `Qwillio Contact <${fromEmail}>`,
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

    // Seed/reset admin accounts
    try {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash('Qwillio2026!', 12);

      await prisma.user.upsert({
        where: { email: 'makho.off@gmail.com' },
        update: { passwordHash, role: 'admin', emailConfirmed: true, onboardingCompleted: true },
        create: {
          email: 'makho.off@gmail.com',
          name: 'Mathieu',
          passwordHash,
          role: 'admin',
          emailConfirmed: true,
          onboardingCompleted: true,
        },
      });

      await prisma.user.upsert({
        where: { email: 'admin@qwillio.com' },
        update: { passwordHash, role: 'admin', emailConfirmed: true, onboardingCompleted: true },
        create: {
          email: 'admin@qwillio.com',
          name: 'Admin Qwillio',
          passwordHash,
          role: 'admin',
          emailConfirmed: true,
          onboardingCompleted: true,
        },
      });
      logger.info('Admin accounts seeded ✅');
    } catch (seedErr) {
      logger.error('Admin seed failed (non-fatal):', seedErr);
    }

    // ─── One-time cleanup: remove fake Belgian prospects + vivi pizza client ──
    try {
      const belgianCities = ['Liège', 'Bruxelles', 'Anvers', 'Gand', 'Brussels', 'Antwerp', 'Ghent', 'Liege'];
      const belgianProspects = await prisma.prospect.findMany({
        where: { OR: [{ country: 'BE' }, { country: 'Belgium' }, { city: { in: belgianCities } }] },
        select: { id: true },
      });
      if (belgianProspects.length > 0) {
        await prisma.prospect.deleteMany({ where: { id: { in: belgianProspects.map(p => p.id) } } });
        logger.info(`[Startup] Cleaned ${belgianProspects.length} fake Belgian prospect(s)`);
      }
      const viviClients = await prisma.client.findMany({
        where: { OR: [{ businessName: { contains: 'vivi', mode: 'insensitive' } }, { businessName: { contains: 'pizza', mode: 'insensitive' } }] },
        select: { id: true, businessName: true, userId: true },
      });
      for (const c of viviClients) {
        await prisma.client.delete({ where: { id: c.id } });
        if (c.userId) await prisma.user.delete({ where: { id: c.userId } }).catch(() => {});
        logger.info(`[Startup] Deleted fake client: ${c.businessName}`);
      }
    } catch (cleanupErr) {
      logger.warn('[Startup] Fake data cleanup (non-fatal):', cleanupErr);
    }

    // ── Bootstrap: auto-activate a test client from env vars ──
    // If BOOTSTRAP_ACTIVATE_EMAIL is set, upsert a fully-paid Client row
    // for that user on every boot. Lets the owner QA the client dashboard
    // from mobile without calling any admin API. Safe because only Render
    // env vars can trigger it.
    const bootstrapEmail = (process.env.BOOTSTRAP_ACTIVATE_EMAIL || '').trim().toLowerCase();
    const bootstrapPlan  = (process.env.BOOTSTRAP_ACTIVATE_PLAN  || 'pro').toLowerCase();
    const BOOTSTRAP_PLANS: Record<string, { monthly: number; calls: number }> = {
      starter:    { monthly: 497,  calls: 800 },
      pro:        { monthly: 1297, calls: 2000 },
      enterprise: { monthly: 2497, calls: 4000 },
    };
    if (bootstrapEmail) {
      try {
        const crypto = await import('crypto');
        const spec   = BOOTSTRAP_PLANS[bootstrapPlan] || BOOTSTRAP_PLANS.pro;
        const user   = await prisma.user.findUnique({ where: { email: bootstrapEmail } });
        if (!user) {
          logger.warn(`[bootstrap] No user with email ${bootstrapEmail} — skipping test-activation`);
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              onboardingCompleted: true,
              planType: bootstrapPlan,
              businessName: user.businessName ?? `${user.name || bootstrapEmail.split('@')[0]} — Test`,
            },
          });
          // Reuse the existing dashboard token so the link stays stable
          // across boots (bookmark-friendly).
          const existingClient = await prisma.client.findUnique({ where: { userId: user.id } });
          const dashboardToken = existingClient?.dashboardToken ?? crypto.randomBytes(24).toString('hex');
          const now = new Date();
          const onboardingDataSeed = {
            businessType: user.industry ?? 'home_services',
            services: ['Appointment booking', '24/7 call answering', 'Lead capture'],
            hours: 'Mon-Fri 9h-18h',
            transferNumber: user.businessPhone ?? null,
            bootstrapped: true,
            bootstrappedAt: now.toISOString(),
          };
          const client = await prisma.client.upsert({
            where: { userId: user.id },
            create: {
              userId:                user.id,
              businessName:          user.businessName ?? `${user.name || bootstrapEmail.split('@')[0]} — Test`,
              businessType:          user.industry ?? 'home_services',
              contactName:           user.name ?? bootstrapEmail,
              contactEmail:          bootstrapEmail,
              contactPhone:          user.businessPhone ?? null,
              planType:              bootstrapPlan,
              setupFee:              0,
              monthlyFee:            spec.monthly,
              monthlyCallsQuota:     spec.calls,
              currency:              'USD',
              subscriptionStatus:    'active',
              onboardingStatus:      'completed',
              onboardingCompletedAt: now,
              activationDate:        now,
              dashboardToken,
              agentLanguage:         'en',
              agentName:             'Ashley',
              isTrial:               false,
              // Complete the row so the portal reads as a real paying client
              stripeCustomerId:      'cus_bootstrap_test',
              stripeSubscriptionId:  'sub_bootstrap_test',
              contractSignedAt:      now,
              transferNumber:        user.businessPhone ?? null,
              onboardingData:        onboardingDataSeed,
              vapiAssistantId:       env.VAPI_ASSISTANT_ID || null,
              vapiPhoneNumber:       env.VAPI_PHONE_NUMBER || null,
              forwardingStatus:      env.VAPI_PHONE_NUMBER ? 'verified' : null,
              forwardingVerifiedAt:  env.VAPI_PHONE_NUMBER ? now : null,
            },
            update: {
              planType:              bootstrapPlan,
              monthlyFee:            spec.monthly,
              monthlyCallsQuota:     spec.calls,
              subscriptionStatus:    'active',
              onboardingStatus:      'completed',
              onboardingCompletedAt: now,
              activationDate:        now,
              isTrial:               false,
              contractSignedAt:      now,
              stripeCustomerId:      'cus_bootstrap_test',
              stripeSubscriptionId:  'sub_bootstrap_test',
              vapiAssistantId:       env.VAPI_ASSISTANT_ID || undefined,
              vapiPhoneNumber:       env.VAPI_PHONE_NUMBER || undefined,
              forwardingStatus:      env.VAPI_PHONE_NUMBER ? 'verified' : undefined,
              forwardingVerifiedAt:  env.VAPI_PHONE_NUMBER ? now : undefined,
            },
          });
          logger.info(`[bootstrap] ✅ Test-activated client ${bootstrapEmail} (plan=${bootstrapPlan})`);
          logger.info(`[bootstrap] Client ID: ${client.id}`);
          logger.info(`[bootstrap] Dashboard URL: ${env.FRONTEND_URL.split(',')[0]}/portal/${dashboardToken}`);
        }
      } catch (err) {
        logger.error('[bootstrap] Test-activate failed:', err);
      }
    }

    // Initialize bot loop (creates bot_status record if needed)
    await botLoop.initialize();
    logger.info('Bot loop initialized');

    // Auto-start bot loop in production
    if (env.NODE_ENV === 'production') {
      try {
        await botLoop.start();
        logger.info('Bot loop auto-started in production ✅');
      } catch (botErr) {
        logger.error('Bot loop auto-start failed (non-fatal):', botErr);
      }
    }

    const server = createServer(app);
    initSocket(server);

    server.listen(env.PORT, () => {
      logger.info('═══════════════════════════════════════');
      logger.info(`  🚀 Qwillio API running on port ${env.PORT}`);
      logger.info(`  📊 Dashboard: ${env.FRONTEND_URL}`);
      logger.info(`  🔗 API: ${env.API_BASE_URL}`);
      logger.info(`  📦 Environment: ${env.NODE_ENV}`);
      logger.info('═══════════════════════════════════════');

      // Production warnings
      if (env.NODE_ENV === 'production') {
        if (env.RESEND_FROM_EMAIL.includes('resend.dev')) {
          logger.warn('⚠️  RESEND_FROM_EMAIL uses resend.dev test domain — emails will only reach verified addresses!');
        }
        if (!env.ANTHROPIC_API_KEY) {
          logger.warn('⚠️  ANTHROPIC_API_KEY missing — A/B challenger generation and script learning disabled');
        }
      }

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
