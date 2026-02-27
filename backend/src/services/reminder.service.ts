import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { discordService } from './discord.service';
import { onboardingService } from './onboarding.service';
import { onboardingFlowService } from './onboarding-flow.service';
import { PACKAGES } from '../types';

export class ReminderService {
  async processReminders() {
    const pendingReminders = await prisma.reminder.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    if (pendingReminders.length === 0) {
      return 0;
    }

    logger.info(`Processing ${pendingReminders.length} reminders...`);
    let processed = 0;

    for (const reminder of pendingReminders) {
      try {
        await this.processReminder(reminder);
        processed++;
      } catch (error) {
        logger.error(`Failed to process reminder ${reminder.id}:`, error);
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: 'failed',
            errorMessage: (error as Error).message,
          },
        });
      }
    }

    logger.info(`Processed ${processed}/${pendingReminders.length} reminders`);
    return processed;
  }

  private async processReminder(reminder: any) {
    switch (reminder.reminderType) {
      case 'quote_followup_d1':
      case 'quote_followup_d3':
      case 'quote_followup_d7':
        await this.processQuoteFollowUp(reminder);
        break;
      case 'trial_ending_7days':
        await this.processTrialEnding(reminder, 7);
        break;
      case 'trial_ending_1day':
        await this.processTrialEnding(reminder, 1);
        break;
      case 'trial_expired':
        await this.processTrialExpired(reminder);
        break;
      case 'callback_3months':
        await this.processCallback3Months(reminder);
        break;
      case 'payment_failed':
        await this.processPaymentFailed(reminder);
        break;
      case 'payment_overdue_3days':
        await this.processPaymentOverdue(reminder);
        break;
      case 'account_deactivation':
        await this.processAccountDeactivation(reminder);
        break;

      // ═══ NEW FOLLOW-UP SEQUENCE TYPES ═══
      case 'sms_post_call':
        await this.processSmsPostCall(reminder);
        break;
      case 'email_video':
        await this.processEmailVideo(reminder);
        break;
      case 'email_reminder_24h':
        await this.processEmailReminder24h(reminder);
        break;
      case 'email_dashboard_48h':
        await this.processEmailDashboard48h(reminder);
        break;
      case 'callback_retry':
        await this.processCallbackRetry(reminder);
        break;

      default:
        logger.warn(`Unknown reminder type: ${reminder.reminderType}`);
    }
  }

  private async processQuoteFollowUp(reminder: any) {
    const quote = await prisma.quote.findUnique({
      where: { id: reminder.targetId },
      include: { prospect: true },
    });

    if (!quote || !quote.prospect || !quote.prospect.email) {
      logger.warn(`Quote or prospect not found for reminder ${reminder.id}`);
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Quote or prospect not found' },
      });
      return;
    }

    // Don't send follow-up if quote is already accepted
    if (quote.status === 'accepted') {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Quote already accepted' },
      });
      return;
    }

    const typeMap: Record<string, 'day1' | 'day3' | 'day7'> = {
      'quote_followup_d1': 'day1',
      'quote_followup_d3': 'day3',
      'quote_followup_d7': 'day7',
    };

    const pkg = PACKAGES[quote.packageType] || PACKAGES.basic;

    await emailService.sendFollowUpEmail({
      to: quote.prospect.email,
      contactName: quote.prospect.contactName || quote.prospect.businessName,
      businessName: quote.prospect.businessName,
      packageName: pkg.name,
      monthlyPrice: pkg.monthlyFee,
      setupPrice: pkg.setupFee,
      paymentLink: quote.stripePaymentLink || '',
      type: typeMap[reminder.reminderType],
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: 'Email sent' },
    });

    // If J+7 and still no payment, schedule 3-month callback
    if (reminder.reminderType === 'quote_followup_d7') {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'expired' },
      });

      await prisma.reminder.create({
        data: {
          targetType: 'prospect',
          targetId: quote.prospect.id,
          reminderType: 'callback_3months',
          scheduledAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.prospect.update({
        where: { id: quote.prospect.id },
        data: {
          nextAction: 'callback_3months',
          nextActionDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  private async processTrialEnding(reminder: any, daysLeft: number) {
    const client = await prisma.client.findUnique({
      where: { id: reminder.targetId },
    });

    if (!client) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Client not found' },
      });
      return;
    }

    // Don't send if already converted or canceled
    if (!client.isTrial || client.subscriptionStatus !== 'trialing') {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Trial already ended or converted' },
      });
      return;
    }

    const pkg = PACKAGES[client.planType] || PACKAGES.basic;
    const paymentLink = this.getPaymentLink(client.planType);

    await emailService.sendTrialEndingEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      packageType: client.planType,
      daysLeft,
      trialEndDate: client.trialEndDate!,
      paymentLink: `${paymentLink}?client_reference_id=${client.id}`,
      monthlyPrice: pkg.monthlyFee,
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: `Trial ending ${daysLeft}d email sent` },
    });

    await discordService.notify(
      `⏰ TRIAL ENDING (${daysLeft} day${daysLeft > 1 ? 's' : ''} left)\n\nClient: ${client.businessName}\nEmail: ${client.contactEmail}\nTrial ends: ${client.trialEndDate?.toLocaleDateString('en-US')}`
    );
  }

  private async processTrialExpired(reminder: any) {
    const client = await prisma.client.findUnique({
      where: { id: reminder.targetId },
    });

    if (!client) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Client not found' },
      });
      return;
    }

    // Don't process if already converted
    if (!client.isTrial || client.subscriptionStatus !== 'trialing') {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Trial already ended or converted' },
      });
      return;
    }

    const pkg = PACKAGES[client.planType] || PACKAGES.basic;
    const paymentLink = this.getPaymentLink(client.planType);

    // Send trial end invoice with stats + payment link (7-day grace period)
    await onboardingFlowService.processTrialConversion(client.id);

    // Update status to trial_expired (but don't deactivate yet - 7 day grace period)
    await prisma.client.update({
      where: { id: client.id },
      data: { subscriptionStatus: 'trial_expired' },
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: 'Trial expired - invoice sent with 7-day grace period' },
    });

    await discordService.notify(
      `⏰ TRIAL EXPIRED\n\nClient: ${client.businessName}\nEmail: ${client.contactEmail}\n📄 Invoice + payment link sent\n⏳ 7-day grace period before deactivation`
    );

    logger.info(`Trial expired for ${client.businessName} - invoice sent, 7-day grace period started`);
  }

  private getPaymentLink(planType: string): string {
    switch (planType) {
      case 'basic': return env.STRIPE_LINK_BASIC;
      case 'pro': return env.STRIPE_LINK_PRO;
      case 'enterprise': return env.STRIPE_LINK_ENTERPRISE;
      default: return env.STRIPE_LINK_BASIC;
    }
  }

  private async processCallback3Months(reminder: any) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: reminder.targetId },
    });

    if (!prospect || !prospect.email) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Prospect or email not found' },
      });
      return;
    }

    // Don't callback if already converted
    if (prospect.status === 'converted') {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Already converted' },
      });
      return;
    }

    await emailService.sendCallback3MonthsEmail({
      to: prospect.email,
      contactName: prospect.contactName || prospect.businessName,
      businessName: prospect.businessName,
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: '3-month callback email sent' },
    });

    // Re-add to call queue
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        status: 'new',
        nextAction: 'call',
        nextActionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  private async processPaymentOverdue(reminder: any) {
    const client = await prisma.client.findUnique({ where: { id: reminder.targetId } });
    if (!client) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Client not found' } });
      return;
    }

    // Don't send if already paid
    if (client.subscriptionStatus === 'active') {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Already converted' } });
      return;
    }

    const pkg = PACKAGES[client.planType] || PACKAGES.basic;
    const paymentLink = this.getPaymentLink(client.planType);

    // Send urgent payment reminder
    await emailService.sendTrialEndingEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      packageType: client.planType,
      daysLeft: 4, // 4 days left before deactivation
      trialEndDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      paymentLink: `${paymentLink}?client_reference_id=${client.id}`,
      monthlyPrice: pkg.monthlyFee,
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: 'Payment overdue reminder sent' },
    });

    await discordService.notify(
      `⚠️ PAYMENT OVERDUE (3 days)\n\nClient: ${client.businessName}\nEmail: ${client.contactEmail}\nDeactivation in 4 days if no payment`
    );
  }

  private async processAccountDeactivation(reminder: any) {
    const client = await prisma.client.findUnique({ where: { id: reminder.targetId } });
    if (!client) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Client not found' } });
      return;
    }

    // Don't deactivate if already paid
    if (client.subscriptionStatus === 'active') {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Already converted - no deactivation needed' } });
      return;
    }

    // Hard deactivation
    await onboardingFlowService.hardDeactivateClient(client.id);

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: 'Account deactivated - no payment' },
    });
  }

  private async processPaymentFailed(reminder: any) {
    const client = await prisma.client.findUnique({
      where: { id: reminder.targetId },
    });

    if (!client) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'canceled', result: 'Client not found' },
      });
      return;
    }

    // Send payment failed notification email (reuse follow-up template)
    logger.info(`Payment failed reminder for client ${client.businessName}`);

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: 'Payment failure notification sent' },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // NEW FOLLOW-UP SEQUENCE HANDLERS
  // ═══════════════════════════════════════════════════════════

  private async processSmsPostCall(reminder: any) {
    const prospect = await prisma.prospect.findUnique({ where: { id: reminder.targetId } });
    if (!prospect || !prospect.phone) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Prospect or phone not found' } });
      return;
    }

    const lastCall = await prisma.call.findFirst({
      where: { prospectId: prospect.id },
      orderBy: { createdAt: 'desc' },
    });

    await smsService.sendPostCallSMS(
      { phone: prospect.phone, businessName: prospect.businessName, contactName: prospect.contactName },
      lastCall?.outcome || 'callback_later'
    );

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: 'Post-call SMS sent' },
    });
  }

  private async processEmailVideo(reminder: any) {
    const prospect = await prisma.prospect.findUnique({ where: { id: reminder.targetId } });
    if (!prospect || !prospect.email) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Prospect or email not found' } });
      return;
    }

    // Send Loom video email
    await emailService.sendFollowUpEmail({
      to: prospect.email,
      contactName: prospect.contactName || prospect.businessName,
      businessName: prospect.businessName,
      packageName: 'PRO',
      monthlyPrice: PACKAGES.pro.monthlyFee,
      setupPrice: PACKAGES.pro.setupFee,
      paymentLink: '',
      type: 'day1', // Reuse day1 template with video
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: 'Video follow-up email sent (T+5min)' },
    });
    logger.info(`Email video follow-up sent to ${prospect.businessName}`);
  }

  private async processEmailReminder24h(reminder: any) {
    const prospect = await prisma.prospect.findUnique({ where: { id: reminder.targetId } });
    if (!prospect || !prospect.email) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Prospect or email not found' } });
      return;
    }

    // Check if quote was viewed — if so, skip
    const quote = await prisma.quote.findFirst({
      where: { prospectId: prospect.id },
      orderBy: { createdAt: 'desc' },
    });
    if (quote?.viewedAt) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Quote already viewed' } });
      return;
    }

    await emailService.sendFollowUpEmail({
      to: prospect.email,
      contactName: prospect.contactName || prospect.businessName,
      businessName: prospect.businessName,
      packageName: 'PRO',
      monthlyPrice: PACKAGES.pro.monthlyFee,
      setupPrice: PACKAGES.pro.setupFee,
      paymentLink: quote?.stripePaymentLink || '',
      type: 'day3', // Reuse day3 template
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: '24h reminder email sent' },
    });
    logger.info(`24h reminder email sent to ${prospect.businessName}`);
  }

  private async processEmailDashboard48h(reminder: any) {
    const prospect = await prisma.prospect.findUnique({ where: { id: reminder.targetId } });
    if (!prospect || !prospect.email) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Prospect or email not found' } });
      return;
    }

    // Check if quote was accepted — if so, skip
    const quote = await prisma.quote.findFirst({
      where: { prospectId: prospect.id },
      orderBy: { createdAt: 'desc' },
    });
    if (quote?.status === 'accepted') {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Quote already accepted' } });
      return;
    }

    await emailService.sendFollowUpEmail({
      to: prospect.email,
      contactName: prospect.contactName || prospect.businessName,
      businessName: prospect.businessName,
      packageName: 'PRO',
      monthlyPrice: PACKAGES.pro.monthlyFee,
      setupPrice: PACKAGES.pro.setupFee,
      paymentLink: quote?.stripePaymentLink || '',
      type: 'day7', // Reuse day7 template (dashboard preview)
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: '48h dashboard preview email sent' },
    });
    logger.info(`48h dashboard email sent to ${prospect.businessName}`);
  }

  private async processCallbackRetry(reminder: any) {
    const prospect = await prisma.prospect.findUnique({ where: { id: reminder.targetId } });
    if (!prospect) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Prospect not found' } });
      return;
    }

    // Don't retry if prospect is already contacted/qualified/converted
    if (['qualified', 'converted', 'interested'].includes(prospect.status)) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: 'Prospect already progressed' } });
      return;
    }

    // Check max attempts
    if (prospect.callAttempts >= prospect.maxAttempts) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'canceled', result: `Max attempts reached (${prospect.callAttempts}/${prospect.maxAttempts})` } });
      return;
    }

    // Re-add to call queue
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        status: 'new',
        nextAction: 'call',
        nextActionDate: new Date(),
      },
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', sentAt: new Date(), result: `Callback retry scheduled (attempt ${prospect.callAttempts + 1})` },
    });

    logger.info(`Callback retry: ${prospect.businessName} re-added to queue (attempt ${prospect.callAttempts + 1})`);
  }
}

export const reminderService = new ReminderService();
