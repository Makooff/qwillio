import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { analyticsService } from '../services/analytics.service';
import { getLogs, clearLogs, getLastId } from '../config/log-store';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { env } from '../config/env';

const router = Router();

// All admin routes require JWT auth + admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Log viewer endpoints ─────────────────────────────────
router.get('/logs', (req: Request, res: Response) => {
  const since = req.query.since ? parseInt(req.query.since as string) : undefined;
  const level = req.query.level as string | undefined;
  const search = req.query.search as string | undefined;
  res.json({
    logs: getLogs({ since, level, search, limit: 200 }),
    lastId: getLastId(),
  });
});

router.delete('/logs', (_req: Request, res: Response) => {
  clearLogs();
  res.json({ success: true });
});

// ─── Bot config (used by AdminSettings page) ─────────────
// GET  /api/admin/bot-config  — returns AdminConfig + BotStatus + env defaults
router.get('/bot-config', async (_req: Request, res: Response) => {
  try {
    const [adminCfg, bot] = await Promise.all([
      prisma.adminConfig.findFirst().catch(() => null),
      prisma.botStatus.findFirst({ select: { callsQuotaDaily: true } }),
    ]);
    res.json({
      // Call scheduling
      startHour:           adminCfg?.callWindowStart ?? env.AUTOMATION_START_HOUR,
      endHour:             adminCfg?.callWindowEnd ?? env.AUTOMATION_END_HOUR,
      callsPerDay:         bot?.callsQuotaDaily ?? adminCfg?.callsPerDay ?? env.CALLS_PER_DAY,
      callIntervalSeconds: (adminCfg?.callIntervalMinutes ?? env.CALL_INTERVAL_MINUTES) * 60,
      activeDays:          env.AUTOMATION_DAYS,
      maxCallDuration:     (adminCfg?.maxCallDurationMin ?? 10) * 60,
      retryDelay:          3600,
      maxRetries:          3,
      // Prospecting
      prospectionQuotaPerDay: adminCfg?.prospectionQuotaPerDay ?? env.PROSPECTION_DAILY_QUOTA,
      minPriorityScore:       adminCfg?.minPriorityScore ?? env.MIN_PRIORITY_SCORE,
      targetCities:           adminCfg?.targetCities ?? env.PROSPECTION_CITIES,
      targetNiches:           adminCfg?.targetNiches ?? [],
      apifyTargetCities:      adminCfg?.apifyTargetCities ?? [],
      // VAPI voice settings
      vapiModel:              env.VAPI_MODEL,
      vapiVoiceId:            adminCfg?.vapiVoiceId ?? env.VAPI_VOICE_ID,
      vapiStability:          env.VAPI_STABILITY,
      vapiSimilarityBoost:    env.VAPI_SIMILARITY_BOOST,
      vapiStyle:              env.VAPI_STYLE,
      vapiLatency:            env.VAPI_OPTIMIZE_LATENCY,
      vapiInterruptionMs:     env.VAPI_INTERRUPTION_THRESHOLD,
      vapiSilenceTimeout:     adminCfg?.silenceTimeoutSeconds ?? env.VAPI_SILENCE_TIMEOUT,
      vapiMaxDuration:        env.VAPI_MAX_DURATION,
      // Env-level settings (read-only info)
      smsEnabled:             env.SMS_ENABLED,
      prospectionRadius:      env.PROSPECTION_RADIUS_METERS,
      timezone:               env.TZ,
      resendFrom:             env.RESEND_FROM_EMAIL,
      resendReplyTo:          env.RESEND_REPLY_TO,
      jwtExpiresIn:           env.JWT_EXPIRES_IN,
      bcryptRounds:           env.BCRYPT_ROUNDS,
    });
  } catch (err: any) {
    logger.error('[API] bot-config GET failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/bot-config  — persists to AdminConfig + BotStatus
router.post('/bot-config', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, any>;

    // Update BotStatus.callsQuotaDaily
    if (body.callsPerDay !== undefined) {
      const bot = await prisma.botStatus.findFirst({ select: { id: true } });
      if (bot) {
        await prisma.botStatus.update({
          where: { id: bot.id },
          data: { callsQuotaDaily: Math.min(Math.max(Number(body.callsPerDay), 1), 500) },
        });
      }
    }

    // Upsert AdminConfig with all supported fields
    const cfgData: Record<string, any> = {};
    if (body.callsPerDay !== undefined)           cfgData.callsPerDay = Math.min(Math.max(Number(body.callsPerDay), 1), 500);
    if (body.startHour !== undefined)              cfgData.callWindowStart = Math.min(Math.max(Number(body.startHour), 0), 23);
    if (body.endHour !== undefined)                cfgData.callWindowEnd = Math.min(Math.max(Number(body.endHour), 0), 23);
    if (body.callIntervalSeconds !== undefined)    cfgData.callIntervalMinutes = Math.max(1, Math.round(Number(body.callIntervalSeconds) / 60));
    if (body.maxCallDuration !== undefined)        cfgData.maxCallDurationMin = Math.max(1, Math.round(Number(body.maxCallDuration) / 60));
    if (body.prospectionQuotaPerDay !== undefined) cfgData.prospectionQuotaPerDay = Math.max(1, Number(body.prospectionQuotaPerDay));
    if (body.minPriorityScore !== undefined)       cfgData.minPriorityScore = Math.max(0, Number(body.minPriorityScore));
    if (body.vapiSilenceTimeout !== undefined)     cfgData.silenceTimeoutSeconds = Math.max(5, Number(body.vapiSilenceTimeout));
    if (body.targetCities && Array.isArray(body.targetCities))       cfgData.targetCities = body.targetCities;
    if (body.targetNiches && Array.isArray(body.targetNiches))       cfgData.targetNiches = body.targetNiches;
    if (body.apifyTargetCities && Array.isArray(body.apifyTargetCities)) cfgData.apifyTargetCities = body.apifyTargetCities;

    if (Object.keys(cfgData).length > 0) {
      const existing = await prisma.adminConfig.findFirst({ select: { id: true } });
      if (existing) {
        await prisma.adminConfig.update({ where: { id: existing.id }, data: cfgData });
      } else {
        await prisma.adminConfig.create({ data: cfgData });
      }
    }

    logger.info(`[API] bot-config saved: ${JSON.stringify(Object.keys(cfgData))}`);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[API] bot-config POST failed:', err);
    res.status(500).json({ error: err.message });
  }
});

const EMPTY_DASHBOARD = {
  prospects: { total: 0, newThisMonth: 0, byStatus: {} as Record<string, number> },
  clients: { totalActive: 0, newThisMonth: 0, byPlan: {} as Record<string, number> },
  revenue: { mrr: 0, setupFeesThisMonth: 0, totalThisMonth: 0 },
  conversion: { prospectToClient: 0, quoteAcceptanceRate: 0 },
  calls: { today: 0, thisWeek: 0, successRate: 0 },
  bot: { isActive: false, callsToday: 0, callsQuota: 50 },
  prospectsReadyToCall: 0,
  activity: [] as any[],
};

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const [statsResult, activityResult, prospectsReadyResult] = await Promise.allSettled([
      analyticsService.getDashboardStats(),
      analyticsService.getRecentActivity(10),
      prisma.prospect.count({ where: { status: 'new', eligibleForCall: true, callAttempts: { lt: 3 }, phone: { not: null } } }),
    ]);
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];
    const prospectsReadyToCall = prospectsReadyResult.status === 'fulfilled' ? prospectsReadyResult.value : 0;
    res.json({ ...(stats ?? EMPTY_DASHBOARD), prospectsReadyToCall, activity });
  } catch (err: any) {
    logger.error('[API] Admin dashboard error:', err);
    res.json({ ...EMPTY_DASHBOARD });
  }
});

router.get('/prospects', async (_req: Request, res: Response) => {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, businessName: true, contactName: true, email: true, phone: true,
        status: true, eligibleForCall: true, callAttempts: true,
        createdAt: true, updatedAt: true,
      }
    });
    res.json(prospects);
  } catch (err: any) {
    logger.error('[API] Prospects list error:', err);
    res.json([]);
  }
});

router.get('/clients', async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, businessName: true, contactName: true, contactEmail: true, contactPhone: true,
        planType: true, subscriptionStatus: true, setupFee: true, monthlyFee: true, createdAt: true,
      }
    });
    res.json(clients);
  } catch (err: any) {
    logger.error('[API] Clients list error:', err);
    res.json([]);
  }
});

router.get('/calls', async (_req: Request, res: Response) => {
  try {
    const calls = await prisma.call.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        prospect: { select: { businessName: true, contactName: true, phone: true } }
      }
    });
    res.json(calls);
  } catch (err: any) {
    logger.error('[API] Calls list error:', err);
    res.json([]);
  }
});

router.get('/leads', async (_req: Request, res: Response) => {
  try {
    const leads = await prisma.prospect.findMany({
      where: { status: { in: ['contacted', 'qualified', 'proposal'] } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    res.json(leads);
  } catch (err: any) {
    logger.error('[API] Leads list error:', err);
    res.json([]);
  }
});

router.get('/billing', async (_req: Request, res: Response) => {
  try {
    const [clients, fees] = await Promise.allSettled([
      prisma.client.findMany({ where: { subscriptionStatus: 'active' }, select: { planType: true, setupFee: true, monthlyFee: true } }),
      prisma.client.aggregate({ where: { subscriptionStatus: 'active' }, _sum: { setupFee: true, monthlyFee: true } })
    ]);
    const activeClients = clients.status === 'fulfilled' ? clients.value : [];
    const totalMonthlyFee = fees.status === 'fulfilled' ? Number(fees.value._sum.monthlyFee ?? 0) : 0;
    const totalSetupFee = fees.status === 'fulfilled' ? Number(fees.value._sum.setupFee ?? 0) : 0;
    const byPlan = activeClients.reduce((acc: Record<string, number>, c: any) => {
      acc[c.planType] = (acc[c.planType] || 0) + 1;
      return acc;
    }, {});
    res.json({ totalMonthlyFee, totalSetupFee, clientCount: activeClients.length, byPlan });
  } catch (err: any) {
    logger.error('[API] Billing error:', err);
    res.json({ totalMonthlyFee: 0, totalSetupFee: 0, clientCount: 0, byPlan: {} });
  }
});

router.get('/system', async (_req: Request, res: Response) => {
  try {
    const [prospectCount, clientCount, callCount] = await Promise.allSettled([
      prisma.prospect.count(),
      prisma.client.count(),
      prisma.call.count(),
    ]);
    res.json({
      db: 'connected',
      prospects: prospectCount.status === 'fulfilled' ? prospectCount.value : 0,
      clients: clientCount.status === 'fulfilled' ? clientCount.value : 0,
      calls: callCount.status === 'fulfilled' ? callCount.value : 0,
      uptime: process.uptime(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
    });
  } catch (err: any) {
    logger.error('[API] System error:', err);
    res.json({ db: 'error', error: err.message });
  }
});

router.post('/bot/start', async (_req: Request, res: Response) => {
  try {
    const existing = await prisma.botStatus.findFirst();
    const bot = existing
      ? await prisma.botStatus.update({ where: { id: existing.id }, data: { isActive: true } })
      : await prisma.botStatus.create({ data: { isActive: true, callsQuotaDaily: 50, callsToday: 0 } });
    res.json({ success: true, message: 'Bot started', bot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bot/stop', async (_req: Request, res: Response) => {
  try {
    const existing = await prisma.botStatus.findFirst();
    const bot = existing
      ? await prisma.botStatus.update({ where: { id: existing.id }, data: { isActive: false } })
      : await prisma.botStatus.create({ data: { isActive: false, callsQuotaDaily: 50, callsToday: 0 } });
    res.json({ success: true, message: 'Bot stopped', bot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI endpoints ──────────────────────────────────────────

// GET /api/admin/ai/insights
router.get('/ai/insights', async (_req: Request, res: Response) => {
  try {
    const insights = await prisma.nicheInsight.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    res.json({ insights });
  } catch (e) {
    logger.error('[API] AI insights error:', e);
    res.json({ insights: [] });
  }
});

// GET /api/admin/ai/scripts
router.get('/ai/scripts', async (_req: Request, res: Response) => {
  try {
    const scripts = await prisma.scriptMutation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ scripts });
  } catch (e) {
    logger.error('[API] AI scripts error:', e);
    res.json({ scripts: [] });
  }
});

// GET /api/admin/ai/decisions
router.get('/ai/decisions', async (_req: Request, res: Response) => {
  try {
    const decisions = await prisma.aiDecision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ decisions });
  } catch (e) {
    logger.error('[API] AI decisions error:', e);
    res.json({ decisions: [] });
  }
});

/** DELETE /api/admin/clients/:id — delete a client + linked user */
router.delete('/clients/:id', async (req: Request, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, businessName: true, userId: true },
    });
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    // Cascade delete handles related records automatically
    await prisma.client.delete({ where: { id: client.id } });
    // Delete linked user
    if (client.userId) {
      await prisma.user.delete({ where: { id: client.userId } }).catch(() => {});
    }
    logger.info(`[API] Admin deleted client: ${client.businessName} (${client.id})`);
    res.json({ success: true, message: `Client "${client.businessName}" deleted` });
  } catch (err: any) {
    logger.error('[API] Admin delete client error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/admin/prospects/cleanup-belgian — remove fake Belgian/EU prospects */
router.delete('/prospects/cleanup-belgian', async (_req: Request, res: Response) => {
  try {
    const belgianCities = ['Liège', 'Bruxelles', 'Anvers', 'Gand', 'Brussels', 'Antwerp', 'Ghent', 'Liege'];
    const found = await prisma.prospect.findMany({
      where: {
        OR: [
          { country: 'BE' },
          { country: 'Belgium' },
          { city: { in: belgianCities } },
        ],
      },
      select: { id: true, businessName: true, city: true },
    });
    if (found.length === 0) {
      res.json({ success: true, deleted: 0, message: 'No Belgian prospects found' });
      return;
    }
    const ids = found.map(p => p.id);
    const result = await prisma.prospect.deleteMany({ where: { id: { in: ids } } });
    logger.info(`[API] Admin deleted ${result.count} Belgian prospects`);
    res.json({ success: true, deleted: result.count, prospects: found.map(p => `${p.businessName} / ${p.city}`) });
  } catch (err: any) {
    logger.error('[API] Admin cleanup-belgian error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/create-client — Create a Client record for a user by email
router.post('/create-client', async (req: Request, res: Response) => {
  try {
    const { email, planType, businessName } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: `User ${email} not found` });

    const existing = await prisma.client.findUnique({ where: { userId: user.id } });
    if (existing) return res.json({ message: 'Client already exists', clientId: existing.id });

    const plan = planType || 'starter';
    const pricing: Record<string, { setup: number; monthly: number; quota: number }> = {
      starter: { setup: 697, monthly: 197, quota: 200 },
      pro: { setup: 997, monthly: 347, quota: 500 },
      enterprise: { setup: 1497, monthly: 497, quota: 1000 },
    };
    const p = pricing[plan] || pricing.starter;
    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        businessName: businessName || user.businessName || user.name || 'Mon entreprise',
        businessType: user.industry || 'other',
        contactName: user.name,
        contactEmail: user.email,
        contactPhone: user.businessPhone || null,
        country: 'US',
        planType: plan,
        setupFee: p.setup,
        monthlyFee: p.monthly,
        currency: 'USD',
        dashboardToken: require('crypto').randomBytes(32).toString('hex'),
        onboardingStatus: 'completed',
        subscriptionStatus: 'active',
        isTrial: true,
        trialStartDate: new Date(),
        trialEndDate: trialEnd,
        monthlyCallsQuota: p.quota,
        activationDate: new Date(),
      },
    });

    // Make sure onboardingCompleted is set
    await prisma.user.update({ where: { id: user.id }, data: { onboardingCompleted: true } });

    logger.info(`[Admin] Client created for ${email} — clientId: ${client.id}, plan: ${plan}`);
    res.json({ success: true, clientId: client.id, plan });
  } catch (err: any) {
    logger.error('[Admin] create-client failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
