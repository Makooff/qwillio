import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { prospectionService } from '../services/prospection.service';
import { vapiService } from '../services/vapi.service';
import { reminderService } from '../services/reminder.service';
import { analyticsService } from '../services/analytics.service';
import { discordService } from '../services/discord.service';
import { onboardingService } from '../services/onboarding.service';
import { clientDashboardService } from '../services/client-dashboard.service';
import { bookingReminderService } from '../services/booking-reminder.service';
import { optimizationService } from '../services/optimization.service';
import { phoneValidationService } from '../services/phone-validation.service';
import { nicheLearningService } from '../services/niche-learning.service';
import { agentPaymentsService } from '../services/agent-payments.service';
import { agentAccountingService } from '../services/agent-accounting.service';
import { agentInventoryService } from '../services/agent-inventory.service';
import { agentEmailService } from '../services/agent-email.service';
// ─── Prospecting Engine ───────────────────────────────────
import { apifyScrapingService } from '../services/apify-scraping.service';
import { outboundEngineService } from '../services/outbound-engine.service';
import { abTestingService } from '../services/ab-testing.service';
import { bestTimeLearningService } from '../services/best-time-learning.service';
import { scriptLearningService } from '../services/script-learning.service';
import { followUpSequencesService } from '../services/follow-up-sequences.service';
import { prospectScoringService } from '../services/prospect-scoring.service';

class BotLoop {
  private prospectionJob: cron.ScheduledTask | null = null;
  private callingJob: cron.ScheduledTask | null = null;
  private remindersJob: cron.ScheduledTask | null = null;
  private analyticsJob: cron.ScheduledTask | null = null;
  private dailyResetJob: cron.ScheduledTask | null = null;
  private trialCheckJob: cron.ScheduledTask | null = null;
  private onboardingRetryJob: cron.ScheduledTask | null = null;
  private bookingRemindersJob: cron.ScheduledTask | null = null;
  private clientAnalyticsJob: cron.ScheduledTask | null = null;
  private optimizationJob: cron.ScheduledTask | null = null;
  private phoneValidationJob: cron.ScheduledTask | null = null;
  private nicheLearningJob: cron.ScheduledTask | null = null;
  private staleCallCleanupJob: cron.ScheduledTask | null = null;
  private keepAliveJob: cron.ScheduledTask | null = null;
  // Agent AI module jobs
  private agentPaymentsJob: cron.ScheduledTask | null = null;
  private agentAccountingJob: cron.ScheduledTask | null = null;
  private agentInventoryAlertJob: cron.ScheduledTask | null = null;
  private agentInventoryForecastJob: cron.ScheduledTask | null = null;
  private agentEmailSyncJob: cron.ScheduledTask | null = null;
  private agentEmailFollowUpJob: cron.ScheduledTask | null = null;
  // ─── Prospecting Engine cron jobs ─────────────────────
  private apifyScrapingJob: cron.ScheduledTask | null = null;
  private outboundEngineJob: cron.ScheduledTask | null = null;
  private abTestingJob: cron.ScheduledTask | null = null;
  private bestTimeJob: cron.ScheduledTask | null = null;
  private scriptLearningJob: cron.ScheduledTask | null = null;
  private followUpJob: cron.ScheduledTask | null = null;
  private rescoreJob: cron.ScheduledTask | null = null;

  async initialize() {
    // Ensure bot_status record exists
    const existing = await prisma.botStatus.findFirst();
    if (!existing) {
      await prisma.botStatus.create({
        data: {
          isActive: false,
          callsToday: 0,
          callsQuotaDaily: env.CALLS_PER_DAY,
        },
      });
      logger.info('Bot status record created (inactive by default)');
    }
  }

  async start() {
    await this.initialize();

    const botStatus = await prisma.botStatus.findFirst();
    if (!botStatus) return;

    await prisma.botStatus.update({
      where: { id: botStatus.id },
      data: { isActive: true },
    });

    logger.info('🤖 QWILLIO STARTING...');
    logger.info('================================');
    logger.info(`Calls per day: ${env.CALLS_PER_DAY}`);
    logger.info(`Hours: ${env.AUTOMATION_START_HOUR}h - ${env.AUTOMATION_END_HOUR}h`);
    logger.info(`Days: ${env.AUTOMATION_DAYS.join(', ')}`);
    logger.info(`Cities: ${env.PROSPECTION_CITIES.join(', ')}`);
    logger.info('================================');

    // ═══════════════════════════════════════════════════════════
    // CRON 1: PROSPECTION - Every day at 9h (Mon-Fri)
    // ═══════════════════════════════════════════════════════════
    this.prospectionJob = cron.schedule('0 9 * * 1-5', async () => {
      const status = await prisma.botStatus.findFirst();
      if (!status?.isActive) return;

      logger.info('🔍 [CRON] Starting daily prospection...');
      try {
        const count = await prospectionService.runDailyProspection();
        await discordService.notify(`🔍 DAILY PROSPECTION\n\n${count} new prospects added`);
      } catch (error) {
        logger.error('[CRON] Prospection failed:', error);
        await discordService.notify(`❌ PROSPECTION ERROR: ${(error as Error).message}`);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 2: CALLS - Every 20 minutes, 9h-19h, Mon-Fri
    // ═══════════════════════════════════════════════════════════
    this.callingJob = cron.schedule(`*/${env.CALL_INTERVAL_MINUTES} ${env.AUTOMATION_START_HOUR}-${env.AUTOMATION_END_HOUR} * * 1-5`, async () => {
      const status = await prisma.botStatus.findFirst();
      if (!status?.isActive) return;

      logger.info('📞 [CRON] Attempting next call...');
      try {
        await vapiService.callNextProspect();
      } catch (error) {
        logger.error('[CRON] Call failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 3: FOLLOW-UPS - Every hour
    // ═══════════════════════════════════════════════════════════
    this.remindersJob = cron.schedule('0 * * * *', async () => {
      const status = await prisma.botStatus.findFirst();
      if (!status?.isActive) return;

      logger.info('📧 [CRON] Processing reminders...');
      try {
        const count = await reminderService.processReminders();
        if (count > 0) {
          logger.info(`[CRON] ${count} reminders processed`);
        }
      } catch (error) {
        logger.error('[CRON] Reminders processing failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 4: ANALYTICS - Every day at 23h55
    // ═══════════════════════════════════════════════════════════
    this.analyticsJob = cron.schedule('55 23 * * *', async () => {
      logger.info('📊 [CRON] Aggregating daily analytics...');
      try {
        await analyticsService.aggregateDaily();
      } catch (error) {
        logger.error('[CRON] Analytics aggregation failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 5: DAILY RESET - Every day at 00:01
    // ═══════════════════════════════════════════════════════════
    this.dailyResetJob = cron.schedule('1 0 * * *', async () => {
      logger.info('🔄 [CRON] Daily reset...');
      try {
        const botStatusRecord = await prisma.botStatus.findFirst();
        if (botStatusRecord) {
          await prisma.botStatus.update({
            where: { id: botStatusRecord.id },
            data: { callsToday: 0 },
          });
        }
        logger.info('[CRON] Daily call counter reset to 0');
      } catch (error) {
        logger.error('[CRON] Daily reset failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 6: TRIAL EXPIRY CHECK - Every day at 8h
    // ═══════════════════════════════════════════════════════════
    this.trialCheckJob = cron.schedule('0 8 * * *', async () => {
      logger.info('⏰ [CRON] Checking trial expirations...');
      try {
        // Find trials that expired but weren't caught by reminders
        const expiredTrials = await prisma.client.findMany({
          where: {
            isTrial: true,
            subscriptionStatus: 'trialing',
            trialEndDate: { lte: new Date() },
          },
        });

        for (const client of expiredTrials) {
          logger.info(`Trial expired (cron catch): ${client.businessName}`);

          // Deactivate VAPI assistant + release phone number
          try {
            await onboardingService.deactivateClient(client.id);
          } catch (err) {
            logger.warn(`Could not deactivate VAPI for ${client.businessName}:`, err);
          }

          await prisma.client.update({
            where: { id: client.id },
            data: {
              subscriptionStatus: 'trial_expired',
              cancellationDate: new Date(),
            },
          });

          await discordService.notify(
            `⏰ TRIAL EXPIRED (auto-check)\n\nClient: ${client.businessName}\nVAPI Assistant deleted\nShared number preserved`
          );
        }

        if (expiredTrials.length > 0) {
          logger.info(`[CRON] ${expiredTrials.length} expired trials deactivated`);
        }
      } catch (error) {
        logger.error('[CRON] Trial check failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 7: ONBOARDING RETRY - Every 5 minutes
    // Retries failed onboardings (VAPI assistant creation)
    // ═══════════════════════════════════════════════════════════
    this.onboardingRetryJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const retried = await onboardingService.retryFailedOnboardings();
        if (retried > 0) {
          logger.info(`[CRON] Retried ${retried} failed onboarding(s)`);
        }
      } catch (error) {
        logger.error('[CRON] Onboarding retry failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 8: BOOKING REMINDERS - Every hour
    // Sends email reminders to customers 24h before appointments
    // PRO & ENTERPRISE feature
    // ═══════════════════════════════════════════════════════════
    this.bookingRemindersJob = cron.schedule('30 * * * *', async () => {
      try {
        const sent = await bookingReminderService.processBookingReminders();
        if (sent > 0) {
          logger.info(`[CRON] ${sent} booking reminder(s) sent`);
        }
        // Also check for no-shows
        const noShows = await bookingReminderService.processNoShowFollowUps();
        if (noShows > 0) {
          logger.info(`[CRON] ${noShows} no-show follow-up(s) processed`);
        }
      } catch (error) {
        logger.error('[CRON] Booking reminders failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 9: CLIENT ANALYTICS AGGREGATION - Every day at 23h50
    // Aggregates daily call stats per client
    // ═══════════════════════════════════════════════════════════
    this.clientAnalyticsJob = cron.schedule('50 23 * * *', async () => {
      logger.info('📊 [CRON] Aggregating client analytics...');
      try {
        const count = await clientDashboardService.aggregateClientAnalytics();
        if (count > 0) {
          logger.info(`[CRON] Client analytics aggregated for ${count} client(s)`);
        }
      } catch (error) {
        logger.error('[CRON] Client analytics aggregation failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 10: AI OPTIMIZATION - Every Sunday at midnight
    // Auto-tunes Enterprise client assistants based on call data
    // ═══════════════════════════════════════════════════════════
    this.optimizationJob = cron.schedule('0 0 * * 0', async () => {
      logger.info('🔧 [CRON] Running weekly AI optimization...');
      try {
        const count = await optimizationService.runWeeklyOptimization();
        logger.info(`[CRON] ${count} assistant(s) optimized`);
      } catch (error) {
        logger.error('[CRON] AI optimization failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 11: PHONE VALIDATION - Every 10 minutes
    // Validates unvalidated prospect phone numbers via Twilio Lookup
    // ═══════════════════════════════════════════════════════════
    this.phoneValidationJob = cron.schedule('*/10 * * * *', async () => {
      try {
        const validated = await phoneValidationService.validateBatch(10);
        if (validated > 0) {
          logger.info(`[CRON] ${validated} phone number(s) validated`);
        }
      } catch (error) {
        logger.error('[CRON] Phone validation failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 12: NICHE LEARNING AGGREGATION - Every Sunday at 1 AM
    // Analyzes weekly failed calls per niche, generates insights,
    // prunes stale learnings
    // ═══════════════════════════════════════════════════════════
    this.nicheLearningJob = cron.schedule('0 1 * * 0', async () => {
      logger.info('🧠 [CRON] Running weekly niche learning aggregation...');
      try {
        const count = await nicheLearningService.runWeeklyAggregation();
        logger.info(`[CRON] Niche learning: ${count} niches aggregated`);
      } catch (error) {
        logger.error('[CRON] Niche learning aggregation failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 13.5: STALE CALL CLEANUP - Every 15 minutes
    // Marks calls stuck in 'in-progress' for >15min as 'failed'
    // ═══════════════════════════════════════════════════════════
    this.staleCallCleanupJob = cron.schedule('*/15 * * * *', async () => {
      try {
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
        const staleCalls = await prisma.call.updateMany({
          where: {
            status: 'in-progress',
            startedAt: { lt: fifteenMinAgo },
          },
          data: {
            status: 'failed',
            endedAt: new Date(),
            summary: 'Auto-closed: call stuck in-progress for >15 minutes',
          },
        });
        if (staleCalls.count > 0) {
          logger.warn(`[CRON] Cleaned up ${staleCalls.count} stale in-progress call(s)`);
          await discordService.notify(`🧹 Cleaned ${staleCalls.count} stale call(s) stuck in-progress`);
        }
      } catch (error) {
        logger.error('[CRON] Stale call cleanup failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // CRON 14: KEEP-ALIVE PING - Every 10 minutes
    // Prevents Render free tier from sleeping (cold start ~50s)
    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    // AGENT AI: Payments — process overdue invoices every hour
    // ═══════════════════════════════════════════════════════════
    this.agentPaymentsJob = cron.schedule('15 * * * *', async () => {
      try {
        await agentPaymentsService.processOverdueInvoices();
      } catch (error) {
        logger.error('[CRON] Agent payments processing failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // AGENT AI: Accounting — monthly reports on the 1st at 2 AM
    // ═══════════════════════════════════════════════════════════
    this.agentAccountingJob = cron.schedule('0 2 1 * *', async () => {
      try {
        await agentAccountingService.processAllMonthlyReports();
      } catch (error) {
        logger.error('[CRON] Agent accounting reports failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // AGENT AI: Inventory — low stock alerts every 6 hours
    // ═══════════════════════════════════════════════════════════
    this.agentInventoryAlertJob = cron.schedule('0 */6 * * *', async () => {
      try {
        await agentInventoryService.processAutoReorders();
      } catch (error) {
        logger.error('[CRON] Agent inventory reorder failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // AGENT AI: Inventory — demand forecasting daily at 3 AM
    // ═══════════════════════════════════════════════════════════
    this.agentInventoryForecastJob = cron.schedule('0 3 * * *', async () => {
      try {
        await agentInventoryService.processAllForecasts();
      } catch (error) {
        logger.error('[CRON] Agent inventory forecast failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // AGENT AI: Email — sync Gmail every 10 minutes
    // ═══════════════════════════════════════════════════════════
    this.agentEmailSyncJob = cron.schedule('*/10 * * * *', async () => {
      try {
        await agentEmailService.syncAllClients();
      } catch (error) {
        logger.error('[CRON] Agent email sync failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // AGENT AI: Email — process follow-ups every hour
    // ═══════════════════════════════════════════════════════════
    this.agentEmailFollowUpJob = cron.schedule('30 * * * *', async () => {
      try {
        await agentEmailService.processFollowUps();
      } catch (error) {
        logger.error('[CRON] Agent email follow-ups failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // PROSPECTING ENGINE — CRON P1: Apify scraping — daily 2am UTC
    // Scrapes Google Maps via Apify for home services & dental niches
    // ═══════════════════════════════════════════════════════════
    this.apifyScrapingJob = cron.schedule('0 2 * * *', async () => {
      const status = await prisma.botStatus.findFirst();
      if (!status?.isActive) return;

      logger.info('🕷️ [CRON] Starting Apify scraping run...');
      try {
        const count = await apifyScrapingService.runDailyScraping();
        await discordService.notifySystem(`🕷️ APIFY SCRAPING: ${count} new prospects added`);
      } catch (error) {
        logger.error('[CRON] Apify scraping failed:', error);
        await discordService.notifyAlerts(`❌ APIFY SCRAPING FAILED: ${(error as Error).message}`);
      }
    }, { timezone: 'UTC' });

    // ═══════════════════════════════════════════════════════════
    // PROSPECTING ENGINE — CRON P2: Outbound engine — every 20min during call windows
    // Tue-Thu: 9-11:30, 14-17 | Mon/Fri: 10-11:30 (prospect local time enforced in service)
    // ═══════════════════════════════════════════════════════════
    this.outboundEngineJob = cron.schedule('*/20 9-17 * * 1-5', async () => {
      const status = await prisma.botStatus.findFirst();
      if (!status?.isActive) return;

      try {
        await outboundEngineService.callNextProspect();
      } catch (error) {
        logger.error('[CRON] Outbound engine call failed:', error);
      }
    }, { timezone: 'America/Chicago' }); // Central time (covers most target cities)

    // ═══════════════════════════════════════════════════════════
    // PROSPECTING ENGINE — CRON P3: A/B testing analysis — daily 6am UTC
    // ═══════════════════════════════════════════════════════════
    this.abTestingJob = cron.schedule('0 6 * * *', async () => {
      try {
        await abTestingService.analyzeAll();
      } catch (error) {
        logger.error('[CRON] A/B analysis failed:', error);
      }
    }, { timezone: 'UTC' });

    // ═══════════════════════════════════════════════════════════
    // PROSPECTING ENGINE — CRON P4: Best-time learning — every 500 calls (daily trigger)
    // ═══════════════════════════════════════════════════════════
    this.bestTimeJob = cron.schedule('0 4 * * *', async () => {
      try {
        await bestTimeLearningService.analyzeAll();
      } catch (error) {
        logger.error('[CRON] Best-time learning failed:', error);
      }
    }, { timezone: 'UTC' });

    // ═══════════════════════════════════════════════════════════
    // PROSPECTING ENGINE — CRON P5: Script self-learning — Sunday 1am UTC
    // ═══════════════════════════════════════════════════════════
    this.scriptLearningJob = cron.schedule('0 1 * * 0', async () => {
      logger.info('🧠 [CRON] Running script self-learning analysis...');
      try {
        await scriptLearningService.runWeeklyAnalysis();
      } catch (error) {
        logger.error('[CRON] Script learning failed:', error);
        await discordService.notifyAlerts(`❌ SCRIPT LEARNING FAILED: ${(error as Error).message}`);
      }
    }, { timezone: 'UTC' });

    // ═══════════════════════════════════════════════════════════
    // PROSPECTING ENGINE — CRON P6: Follow-up sequences — every 30 min
    // ═══════════════════════════════════════════════════════════
    this.followUpJob = cron.schedule('*/30 * * * *', async () => {
      try {
        const sent = await followUpSequencesService.processDue();
        if (sent > 0) {
          logger.info(`[CRON] Follow-up sequences: ${sent} sent`);
        }
      } catch (error) {
        logger.error('[CRON] Follow-up sequences failed:', error);
      }
    }, { timezone: env.TZ });

    // ═══════════════════════════════════════════════════════════
    // PROSPECTING ENGINE — CRON P7: Re-score prospects — daily 3am UTC
    // ═══════════════════════════════════════════════════════════
    this.rescoreJob = cron.schedule('0 3 * * *', async () => {
      try {
        const updated = await prospectScoringService.rescoreUnscored(1000);
        if (updated > 0) {
          logger.info(`[CRON] Re-scored ${updated} prospects`);
        }
      } catch (error) {
        logger.error('[CRON] Prospect re-scoring failed:', error);
      }
    }, { timezone: 'UTC' });

    this.keepAliveJob = cron.schedule('*/10 * * * *', async () => {
      try {
        const url = env.API_BASE_URL || `http://localhost:${env.PORT}`;
        await fetch(`${url}/api/health`);
      } catch (_) {
        // Ignore — the point is just to keep the process alive
      }
    });

    await discordService.notify('🤖 Qwillio started! All 26 cron jobs active (incl. 6 Agent AI + 7 Prospecting Engine).');
    logger.info('🤖 All 26 cron jobs started. Bot is running in automatic loop.');
  }

  async stop() {
    this.prospectionJob?.stop();
    this.callingJob?.stop();
    this.remindersJob?.stop();
    this.analyticsJob?.stop();
    this.dailyResetJob?.stop();
    this.trialCheckJob?.stop();
    this.onboardingRetryJob?.stop();
    this.bookingRemindersJob?.stop();
    this.clientAnalyticsJob?.stop();
    this.optimizationJob?.stop();
    this.phoneValidationJob?.stop();
    this.nicheLearningJob?.stop();
    this.staleCallCleanupJob?.stop();
    this.keepAliveJob?.stop();
    this.agentPaymentsJob?.stop();
    this.agentAccountingJob?.stop();
    this.agentInventoryAlertJob?.stop();
    this.agentInventoryForecastJob?.stop();
    this.agentEmailSyncJob?.stop();
    this.agentEmailFollowUpJob?.stop();
    // Prospecting engine
    this.apifyScrapingJob?.stop();
    this.outboundEngineJob?.stop();
    this.abTestingJob?.stop();
    this.bestTimeJob?.stop();
    this.scriptLearningJob?.stop();
    this.followUpJob?.stop();
    this.rescoreJob?.stop();

    const botStatus = await prisma.botStatus.findFirst();
    if (botStatus) {
      await prisma.botStatus.update({
        where: { id: botStatus.id },
        data: { isActive: false },
      });
    }

    await discordService.notify('🛑 Qwillio stopped. All cron jobs halted.');
    logger.info('🛑 Qwillio stopped. All cron jobs halted.');
  }

  async getStatus() {
    const botStatus = await prisma.botStatus.findFirst();
    return {
      isActive: botStatus?.isActive || false,
      callsToday: botStatus?.callsToday || 0,
      callsQuotaDaily: botStatus?.callsQuotaDaily || env.CALLS_PER_DAY,
      lastProspection: botStatus?.lastProspection || null,
      lastCall: botStatus?.lastCall || null,
      crons: {
        prospection: this.prospectionJob ? 'active' : 'inactive',
        calling: this.callingJob ? 'active' : 'inactive',
        reminders: this.remindersJob ? 'active' : 'inactive',
        analytics: this.analyticsJob ? 'active' : 'inactive',
        dailyReset: this.dailyResetJob ? 'active' : 'inactive',
        trialCheck: this.trialCheckJob ? 'active' : 'inactive',
        onboardingRetry: this.onboardingRetryJob ? 'active' : 'inactive',
        bookingReminders: this.bookingRemindersJob ? 'active' : 'inactive',
        clientAnalytics: this.clientAnalyticsJob ? 'active' : 'inactive',
        optimization: this.optimizationJob ? 'active' : 'inactive',
        phoneValidation: this.phoneValidationJob ? 'active' : 'inactive',
        nicheLearning: this.nicheLearningJob ? 'active' : 'inactive',
        agentPayments: this.agentPaymentsJob ? 'active' : 'inactive',
        agentAccounting: this.agentAccountingJob ? 'active' : 'inactive',
        agentInventoryAlerts: this.agentInventoryAlertJob ? 'active' : 'inactive',
        agentInventoryForecast: this.agentInventoryForecastJob ? 'active' : 'inactive',
        agentEmailSync: this.agentEmailSyncJob ? 'active' : 'inactive',
        agentEmailFollowUp: this.agentEmailFollowUpJob ? 'active' : 'inactive',
        // Prospecting engine
        apifyScraping: this.apifyScrapingJob ? 'active' : 'inactive',
        outboundEngine: this.outboundEngineJob ? 'active' : 'inactive',
        abTesting: this.abTestingJob ? 'active' : 'inactive',
        bestTimeLearning: this.bestTimeJob ? 'active' : 'inactive',
        scriptLearning: this.scriptLearningJob ? 'active' : 'inactive',
        followUpSequences: this.followUpJob ? 'active' : 'inactive',
        rescoreProspects: this.rescoreJob ? 'active' : 'inactive',
      },
    };
  }

  // Manual triggers for testing
  async triggerProspection() {
    return prospectionService.runDailyProspection();
  }

  async triggerCall() {
    return vapiService.callNextProspect();
  }

  async triggerReminders() {
    return reminderService.processReminders();
  }

  async triggerBookingReminders() {
    return bookingReminderService.processBookingReminders();
  }

  async triggerClientAnalytics() {
    return clientDashboardService.aggregateClientAnalytics();
  }

  async triggerOptimization() {
    return optimizationService.runWeeklyOptimization();
  }

  async triggerPhoneValidation() {
    return phoneValidationService.validateBatch(10);
  }

  async triggerNicheLearning() {
    return nicheLearningService.runWeeklyAggregation();
  }
}

export const botLoop = new BotLoop();
