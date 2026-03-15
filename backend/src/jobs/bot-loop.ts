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
    this.keepAliveJob = cron.schedule('*/10 * * * *', async () => {
      try {
        const url = env.API_BASE_URL || `http://localhost:${env.PORT}`;
        await fetch(`${url}/api/health`);
      } catch (_) {
        // Ignore — the point is just to keep the process alive
      }
    });

    await discordService.notify('🤖 Qwillio started! All 13 cron jobs active.');
    logger.info('🤖 All 13 cron jobs started. Bot is running in automatic loop.');
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
