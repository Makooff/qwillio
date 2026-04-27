import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { analyticsService } from '../services/analytics.service';
import { getLogs, clearLogs, getLastId } from '../config/log-store';
import { getLogsFromDb, getLastIdFromDb, clearLogsInDb, isDbLogStoreReady } from '../config/db-log-store';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { getErrors, markResolved } from '../utils/error-store';
import { emailService } from '../services/email.service';
import { smsService } from '../services/sms.service';
import { smsTemplates } from '../services/sms-templates';

const router = Router();

// All admin routes require JWT auth + admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Log viewer endpoints ─────────────────────────────────
// Reads from the persistent bot_log table (7-day retention) when
// available; falls back to the in-memory ring buffer if the DB query
// fails or the table isn't ready yet.
router.get('/logs', async (req: Request, res: Response) => {
  const since = req.query.since ? parseInt(req.query.since as string) : undefined;
  const level = req.query.level as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string) || 200, 1000) : 200;

  if (isDbLogStoreReady()) {
    try {
      const [logs, lastId] = await Promise.all([
        getLogsFromDb({ since, level, search, limit }),
        getLastIdFromDb(),
      ]);
      return res.json({ logs, lastId, source: 'db' });
    } catch {
      /* fall through to memory */
    }
  }
  res.json({
    logs: getLogs({ since, level, search, limit }),
    lastId: getLastId(),
    source: 'memory',
  });
});

router.delete('/logs', async (_req: Request, res: Response) => {
  clearLogs();
  await clearLogsInDb();
  res.json({ success: true });
});

// ─── Test email — fires any of our transactional templates against
// an arbitrary address. Admin only. Reports the Resend ID + error
// inline so we can debug deliverability without leaving the app.
router.post('/test-email', async (req: Request, res: Response) => {
  const to   = String(req.body?.to   || '').trim();
  const type = String(req.body?.type || 'welcome').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ ok: false, error: 'Email destinataire invalide' });
  }
  const dashboardUrl = env.FRONTEND_URL?.split(',')[0] || 'https://qwillio.com';
  // Tag the businessName with a short unique suffix so consecutive tests
  // produce distinct subjects — otherwise Gmail collapses them into a
  // single thread and hides everything behind the "…" trim toggle.
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const sample = {
    to,
    contactName:  'Mathieu Test',
    businessName: `Demo Plumbing ${stamp}`,
    dashboardUrl: `${dashboardUrl}/dashboard`,
  };
  try {
    let result: any;
    switch (type) {
      case 'welcome':
        result = await (emailService as any).sendWelcomeEmail({
          ...sample,
          planType: 'pro',
          vapiPhoneNumber: env.VAPI_PHONE_NUMBER || '+1 607 354 8569',
        });
        break;
      case 'trial-welcome':
        result = await (emailService as any).sendTrialWelcomeEmail({
          ...sample,
          packageType: 'pro',
          trialEndDate: new Date(Date.now() + 30 * 86_400_000),
          trialCallsQuota: 100,
        });
        break;
      case 'loom':
        result = await (emailService as any).sendLoomVideoEmail(sample);
        break;
      case 'payment-failed':
        result = await (emailService as any).sendPaymentFailedEmail({ ...sample, amount: 1297, paymentLink: null });
        break;
      case 'confirmation':
        result = await (emailService as any).sendConfirmationEmail({
          to,
          name: sample.contactName,
          confirmUrl: `${dashboardUrl}/auth/confirm?token=test`,
        });
        break;
      case 'quote':
        result = await (emailService as any).sendQuoteEmail({
          ...sample,
          packageType:  'pro',
          setupPrice:   1297,
          monthlyPrice: 397,
          features: [
            'AI receptionist available 24/7',
            'Up to 500 calls per month',
            'Automatic booking & reservations',
            'Real-time tracking dashboard',
            'Priority technical support',
          ],
          validUntil:  new Date(Date.now() + 7 * 86_400_000),
          paymentLink: `${dashboardUrl}/pay/test`,
          quoteId:     'QUO-TEST-001',
        });
        break;
      case 'followup-day1':
      case 'followup-day3':
      case 'followup-day7':
        result = await (emailService as any).sendFollowUpEmail({
          ...sample,
          packageName:  'Pro',
          monthlyPrice: 397,
          setupPrice:   1297,
          paymentLink:  `${dashboardUrl}/pay/test`,
          type:         type.replace('followup-', '') as 'day1' | 'day3' | 'day7',
        });
        break;
      case 'trial-ending-7d':
      case 'trial-ending-1d': {
        const daysLeft = type === 'trial-ending-1d' ? 1 : 7;
        result = await (emailService as any).sendTrialEndingEmail({
          ...sample,
          packageType:  'pro',
          daysLeft,
          trialEndDate: new Date(Date.now() + daysLeft * 86_400_000),
          paymentLink:  `${dashboardUrl}/pay/test`,
          monthlyPrice: 397,
        });
        break;
      }
      case 'trial-expired':
        result = await (emailService as any).sendTrialExpiredEmail({
          ...sample,
          packageType:  'pro',
          paymentLink:  `${dashboardUrl}/pay/test`,
          monthlyPrice: 397,
        });
        break;
      case 'callback-3months':
        result = await (emailService as any).sendCallback3MonthsEmail(sample);
        break;
      case 'onboarding':
        result = await (emailService as any).sendOnboardingEmail({
          ...sample,
          businessType:    'plumbing',
          planType:        'pro',
          isTrial:         true,
          trialEndDate:    new Date(Date.now() + 30 * 86_400_000),
          formUrl:         `${dashboardUrl}/onboarding/test`,
          vapiPhoneNumber: env.VAPI_PHONE_NUMBER || '+1 607 354 8569',
        });
        break;
      case 'trial-end-invoice':
        result = await (emailService as any).sendTrialEndInvoiceEmail({
          ...sample,
          planType:     'pro',
          packageName:  'Pro',
          monthlyPrice: 397,
          setupPrice:   1297,
          paymentLink:  `${dashboardUrl}/pay/test`,
          trialStats:   { totalCalls: 87, totalBookings: 24, totalLeads: 12 },
        });
        break;
      case 'account-deactivated':
        result = await (emailService as any).sendAccountDeactivatedEmail(sample);
        break;
      case 'payment-link-signature':
        result = await (emailService as any).sendPaymentLinkAfterSignature({
          ...sample,
          packageType: 'pro',
          setupFee:    1297,
          monthlyFee:  397,
          paymentLink: `${dashboardUrl}/pay/test`,
        });
        break;
      case 'booking-reminder':
        result = await (emailService as any).sendBookingReminderEmail({
          to,
          customerName:    sample.contactName,
          businessName:    sample.businessName,
          bookingDate:     new Date(Date.now() + 86_400_000),
          bookingTime:     '10:00 AM',
          serviceType:     'Consultation',
          specialRequests: null,
          businessPhone:   env.VAPI_PHONE_NUMBER || '+1 607 354 8569',
        });
        break;
      case 'reschedule':
        result = await (emailService as any).sendRescheduleEmail({
          to,
          customerName:  sample.contactName,
          businessName:  sample.businessName,
          originalDate:  new Date(Date.now() - 86_400_000),
          businessPhone: env.VAPI_PHONE_NUMBER || '+1 607 354 8569',
        });
        break;
      case 'email-confirmation':
        result = await (emailService as any).sendEmailConfirmation({
          to,
          contactName:  sample.contactName,
          businessName: sample.businessName,
          prospectId:   'PROSPECT-TEST-001',
        });
        break;
      case 'digest':
        result = await (emailService as any).sendDigestEmail({
          to,
          contactName:  sample.contactName,
          businessName: sample.businessName,
          totalEmails:  42,
          urgent:       3,
          appointment:  8,
          payment:      2,
          autoReplied:  27,
          needsReview:  2,
        });
        break;
      case 'registration-invite':
        result = await (emailService as any).sendRegistrationInvite({
          to,
          contactName:     sample.contactName,
          businessName:    sample.businessName,
          registrationUrl: `${dashboardUrl}/register?token=test`,
          recommendedPlan: 'pro',
        });
        break;
      default:
        return res.status(400).json({ ok: false, error: `Type d'email inconnu: ${type}` });
    }
    logger.info(`[admin/test-email] sent type=${type} to=${to}`);
    res.json({ ok: true, type, to, resend: result ?? null });
  } catch (err: any) {
    logger.error('[admin/test-email] failed:', err);
    res.status(500).json({ ok: false, error: err?.message || 'Échec envoi' });
  }
});

// ─── Test SMS — fires a real Twilio SMS using one of the production templates.
router.post('/test-sms', async (req: Request, res: Response) => {
  const to   = String(req.body?.to   || '').trim();
  const type = String(req.body?.type || 'welcome').trim();
  if (!/^\+?[0-9 .()-]{7,}$/.test(to)) {
    return res.status(400).json({ ok: false, error: 'Numéro invalide (format E.164 attendu, ex. +14155552671)' });
  }
  if (!env.SMS_ENABLED) {
    return res.status(400).json({ ok: false, error: 'SMS_ENABLED=false dans les env vars' });
  }

  const sample = {
    firstName:        'Mathieu',
    businessName:     'Demo Plumbing',
    niche:            'plumbers',
    agentName:        'Ashley',
    registrationLink: 'https://qwillio.com/register',
  };

  let body: string;
  switch (type) {
    case 'welcome':
      body = smsTemplates.welcome(sample);
      break;
    case 'voicemail':
      body = smsTemplates.voicemail(sample);
      break;
    case 'interested':
      body = smsTemplates.interested(sample);
      break;
    case 'callback':
      body = smsTemplates.callback(sample);
      break;
    case 'noanswer':
      body = smsTemplates.noanswer(sample);
      break;
    case 'email-bounce':
      body = smsTemplates.emailBounce(sample);
      break;
    case 'exhausted':
      body = smsTemplates.exhausted(sample);
      break;
    case 'booking-confirm':
      body = smsTemplates.bookingConfirm({
        firstName:    sample.firstName,
        businessName: sample.businessName,
        date:         'Monday, January 15',
        time:         ' at 10:00 AM',
        service:      ' (consultation)',
      });
      break;
    case 'booking-reminder':
      body = smsTemplates.bookingReminder({
        firstName:    sample.firstName,
        businessName: sample.businessName,
        time:         ' tomorrow at 10:00 AM',
        service:      ' for your consultation',
      });
      break;
    case 'custom':
      body = String(req.body?.body || '').trim();
      if (!body) return res.status(400).json({ ok: false, error: 'Body vide pour SMS custom' });
      body = body.slice(0, 1600);
      break;
    default:
      return res.status(400).json({ ok: false, error: `Type SMS inconnu: ${type}` });
  }

  try {
    const result = await smsService.sendSMS(to, body, { messageType: `admin_test_${type}` });
    if (result.success) {
      logger.info(`[admin/test-sms] sent type=${type} to=${to} sid=${result.messageId}`);
      return res.json({ ok: true, type, to, messageId: result.messageId, body });
    }
    return res.status(500).json({
      ok: false,
      error: result.error || 'Échec envoi (raison inconnue)',
      body,
    });
  } catch (err: any) {
    logger.error('[admin/test-sms] failed:', err);
    res.status(500).json({ ok: false, error: err?.message || 'Échec' });
  }
});

// ─── Diagnostic Twilio — list the account, balance, and the numbers
// it actually owns. Helps debug "21659 'From' not in account" errors
// caused by a stale TWILIO_PHONE_NUMBER env value.
router.get('/twilio-info', async (_req: Request, res: Response) => {
  try {
    const twilio = require('twilio');
    const accountSid =
      env.TWILIO_ACCOUNT_SID ||
      Object.values(process.env).find(v => typeof v === 'string' && /^AC[a-f0-9]{32}$/.test(v as string)) as string | undefined;

    if (!accountSid) {
      return res.status(400).json({ ok: false, error: 'TWILIO_ACCOUNT_SID introuvable dans les env vars' });
    }

    let client: any;
    if (env.TWILIO_AUTH_TOKEN) {
      client = twilio(accountSid, env.TWILIO_AUTH_TOKEN);
    } else if (env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET) {
      client = twilio(env.TWILIO_API_KEY_SID, env.TWILIO_API_KEY_SECRET, { accountSid });
    } else {
      return res.status(400).json({ ok: false, error: 'Auth Twilio incomplète (TWILIO_AUTH_TOKEN ou API_KEY)' });
    }

    const [account, numbers, balance] = await Promise.all([
      client.api.v2010.accounts(accountSid).fetch().catch(() => null),
      client.incomingPhoneNumbers.list({ limit: 50 }),
      client.balance.fetch().catch(() => null),
    ]);

    const configuredFrom = env.TWILIO_PHONE_NUMBER;
    const numberList = numbers.map((n: any) => ({
      phoneNumber:  n.phoneNumber,
      friendlyName: n.friendlyName,
      smsEnabled:   !!n.capabilities?.sms,
      mmsEnabled:   !!n.capabilities?.mms,
      voiceEnabled: !!n.capabilities?.voice,
      countryISO:   (n.phoneNumber || '').startsWith('+1') ? 'US/CA' : 'OTHER',
      isConfigured: n.phoneNumber === configuredFrom,
    }));

    const configuredOk = numberList.some((n: any) => n.isConfigured && n.smsEnabled);

    res.json({
      ok: true,
      accountSid,
      accountName:   account?.friendlyName ?? null,
      accountStatus: account?.status ?? null,
      balance:       balance ? `${balance.balance} ${balance.currency}` : null,
      configuredFrom,
      configuredOk,
      numbers: numberList,
      hint: configuredOk
        ? '✅ TWILIO_PHONE_NUMBER est bien dans le compte et SMS-capable.'
        : `❌ TWILIO_PHONE_NUMBER (${configuredFrom}) n'est pas SMS-capable ou pas dans ce compte. Choisis un numéro dans la liste ci-dessus.`,
    });
  } catch (err: any) {
    logger.error('[admin/twilio-info] failed:', err);
    res.status(500).json({ ok: false, error: `${err?.message || 'Échec'}${err?.code ? ` [Twilio ${err.code}]` : ''}` });
  }
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

router.post('/bot/reset-quota', async (_req: Request, res: Response) => {
  try {
    const existing = await prisma.botStatus.findFirst();
    if (existing) {
      await prisma.botStatus.update({ where: { id: existing.id }, data: { callsToday: 0 } });
    }
    // Also clean up orphan queued calls with no vapiCallId (failed VAPI attempts)
    const cleaned = await prisma.call.deleteMany({
      where: { status: 'queued', vapiCallId: null },
    });
    res.json({ success: true, message: `Quota reset to 0. Cleaned ${cleaned.count} orphan queued calls.` });
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

// POST /api/admin/cron/run/:name — Trigger a named cron job manually
router.post('/cron/run/:name', async (req: Request, res: Response) => {
  const name = req.params.name as string;
  const { botLoop } = await import('../jobs/bot-loop');
  try {
    await botLoop.triggerJob(name);
    res.json({ message: `Job ${name} triggered successfully` });
  } catch (error: any) {
    res.status(400).json({ error: error.message || `Unknown job: ${name}` });
  }
});


// GET /api/admin/errors — returns recent errors for self-healing monitor
router.get('/errors', (req: Request, res: Response) => {
  const since = req.query.since as string | undefined;
  const errors = getErrors(since);
  res.json({ errors, count: errors.length, timestamp: new Date().toISOString() });
});

// POST /api/admin/errors/:id/resolve — mark error as resolved
router.post('/errors/:id/resolve', (req: Request, res: Response) => {
  markResolved(req.params.id as string);
  res.json({ ok: true });
});

// ─── Test activation (admin-only) ────────────────────────────
// POST /api/admin/test-activate-client  body: { email, plan? }
// Flips the target account to a fully-paid, fully-onboarded Client so the
// client dashboard can be exercised end-to-end without going through
// Stripe. Admin only.
const PLAN_PRICES: Record<string, { monthly: number; calls: number }> = {
  starter:    { monthly: 497,  calls: 800 },
  pro:        { monthly: 1297, calls: 2000 },
  enterprise: { monthly: 2497, calls: 4000 },
};

router.post('/test-activate-client', async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const plan  = String(req.body?.plan  ?? 'pro').toLowerCase();

  if (!email) return res.status(400).json({ error: 'email is required' });
  const priceSpec = PLAN_PRICES[plan];
  if (!priceSpec) return res.status(400).json({ error: `Unknown plan: ${plan}. Options: ${Object.keys(PLAN_PRICES).join(', ')}` });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: `No user with email ${email}` });

    // Mark user onboarded so the dashboard route guards let them through
    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
        planType: plan,
        businessName: user.businessName ?? `${user.name || email.split('@')[0]} — Test`,
      },
    });

    const dashboardToken = crypto.randomBytes(24).toString('hex');
    const now = new Date();

    const client = await prisma.client.upsert({
      where: { userId: user.id },
      create: {
        userId:               user.id,
        businessName:         user.businessName ?? `${user.name || email.split('@')[0]} — Test`,
        businessType:         user.industry ?? 'home_services',
        contactName:          user.name ?? email,
        contactEmail:         email,
        contactPhone:         user.businessPhone ?? null,
        planType:             plan,
        setupFee:             0,
        monthlyFee:           priceSpec.monthly,
        monthlyCallsQuota:    priceSpec.calls,
        currency:             'USD',
        subscriptionStatus:   'active',
        onboardingStatus:     'completed',
        onboardingCompletedAt: now,
        activationDate:       now,
        dashboardToken,
        agentLanguage:        'en',
        agentName:            'Ashley',
        isTrial:              false,
      },
      update: {
        planType:             plan,
        monthlyFee:           priceSpec.monthly,
        monthlyCallsQuota:    priceSpec.calls,
        subscriptionStatus:   'active',
        onboardingStatus:     'completed',
        onboardingCompletedAt: now,
        activationDate:       now,
        dashboardToken,       // always rotate for a clean test link
        isTrial:              false,
      },
    });

    logger.warn(`[admin] Test-activated client ${email} (plan=${plan})`);

    return res.json({
      ok:           true,
      email,
      plan,
      clientId:     client.id,
      dashboardUrl: `/portal/${dashboardToken}`,
      dashboardToken,
    });
  } catch (err) {
    logger.error('[admin] test-activate-client failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
