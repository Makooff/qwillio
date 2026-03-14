import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { PACKAGES } from '../types';
import { emailService } from './email.service';
import { discordService } from './discord.service';
import { onboardingService } from './onboarding.service';
import { onboardingFlowService } from './onboarding-flow.service';

export class QuoteService {
  async startFreeTrial(prospectId: string, packageType: string, email: string) {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);

    const pkg = PACKAGES[packageType] || PACKAGES.basic;
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + pkg.trialDays * 24 * 60 * 60 * 1000);

    // Create client directly in trial mode (no payment needed)
    const client = await prisma.client.create({
      data: {
        prospectId: prospect.id,
        businessName: prospect.businessName,
        businessType: prospect.businessType,
        sector: prospect.sector,
        contactName: prospect.contactName || prospect.businessName,
        contactEmail: email,
        contactPhone: prospect.phone,
        address: prospect.address,
        city: prospect.city,
        postalCode: prospect.postalCode,
        country: prospect.country,
        planType: packageType,
        setupFee: 0,
        monthlyFee: pkg.monthlyFee,
        subscriptionStatus: 'trialing',
        onboardingStatus: 'pending',
        activationDate: trialStart,
        monthlyCallsQuota: pkg.trialCallsQuota,
        isTrial: true,
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
      },
    });

    // Update prospect status
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: 'converted',
        email: email,
        nextAction: 'trial_active',
      },
    });

    // Create trial reminders: J-7, J-1, J+0 (expiry)
    await prisma.reminder.createMany({
      data: [
        {
          targetType: 'client',
          targetId: client.id,
          reminderType: 'trial_ending_7days',
          scheduledAt: new Date(trialEnd.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          targetType: 'client',
          targetId: client.id,
          reminderType: 'trial_ending_1day',
          scheduledAt: new Date(trialEnd.getTime() - 1 * 24 * 60 * 60 * 1000),
        },
        {
          targetType: 'client',
          targetId: client.id,
          reminderType: 'trial_expired',
          scheduledAt: trialEnd,
        },
      ],
    });

    // Send trial welcome email
    await emailService.sendTrialWelcomeEmail({
      to: email,
      contactName: prospect.contactName || prospect.businessName,
      businessName: prospect.businessName,
      packageType,
      trialEndDate: trialEnd,
      trialCallsQuota: pkg.trialCallsQuota,
    });

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: { newClients: { increment: 1 } },
      create: { date: today, newClients: 1 },
    });

    // Start onboarding (VAPI assistant + phone number)
    try {
      await onboardingService.onboardClient(client.id);
    } catch (err) {
      logger.error(`VAPI onboarding failed for ${prospect.businessName} (client ${client.id}):`, err);
      await discordService.notify(`⚠️ ONBOARDING FAILED\n\nClient: ${prospect.businessName}\nError: ${(err as Error).message}\nClient ID: ${client.id}\n\nPlease retry manually.`);
    }

    // Send onboarding flow email (form + dashboard + Loom)
    try {
      await onboardingFlowService.initiateOnboarding(client.id);
    } catch (err) {
      logger.warn(`Onboarding flow email failed for ${prospect.businessName}:`, err);
    }

    // Discord notification
    await discordService.notify(
      `🎁 FREE TRIAL STARTED!\n\nBusiness: ${prospect.businessName}\nContact: ${prospect.contactName || 'N/A'}\nEmail: ${email}\nPackage: ${pkg.name}\nTrial ends: ${trialEnd.toLocaleDateString('en-US')}\nCalls included: ${pkg.trialCallsQuota}`
    );

    logger.info(`Free trial started for ${prospect.businessName} (${pkg.name}) until ${trialEnd.toISOString()}`);
    return client;
  }

  async generateAndSendQuote(prospectId: string, packageType: string, email: string) {
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);

    const pkg = PACKAGES[packageType] || PACKAGES.basic;
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Get or create Stripe payment link
    const paymentLink = this.getPaymentLink(packageType);

    // Create quote in DB
    const quote = await prisma.quote.create({
      data: {
        prospectId,
        packageType,
        setupFee: pkg.setupFee,
        monthlyFee: pkg.monthlyFee,
        featuresIncluded: pkg.features,
        validUntil,
        status: 'sent',
        sentAt: new Date(),
        stripePaymentLink: paymentLink,
      },
    });

    // Send email
    await emailService.sendQuoteEmail({
      to: email,
      contactName: prospect.contactName || prospect.businessName,
      businessName: prospect.businessName,
      packageType,
      setupPrice: pkg.setupFee,
      monthlyPrice: pkg.monthlyFee,
      features: pkg.features,
      validUntil,
      paymentLink: `${paymentLink}?client_reference_id=${quote.id}`,
      quoteId: quote.id,
    });

    // Create automated reminders (J+1, J+3, J+7)
    await this.createReminders(quote.id, prospectId);

    // Update prospect
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: 'qualified',
        nextAction: 'await_payment',
      },
    });

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: { quotesSent: { increment: 1 } },
      create: { date: today, quotesSent: 1 },
    });

    // Discord notification
    await discordService.notify(
      `📧 QUOTE SENT!\n\nBusiness: ${prospect.businessName}\nContact: ${prospect.contactName || 'N/A'}\nEmail: ${email}\nPackage: ${pkg.name} ($${pkg.monthlyFee}/mo)\nSetup: $${pkg.setupFee}\nLink: ${paymentLink}`
    );

    logger.info(`Quote sent to ${email} for ${prospect.businessName} (${pkg.name})`);
    return quote;
  }

  private getPaymentLink(packageType: string): string {
    switch (packageType) {
      case 'basic': return env.STRIPE_LINK_BASIC;
      case 'pro': return env.STRIPE_LINK_PRO;
      case 'enterprise': return env.STRIPE_LINK_ENTERPRISE;
      default: return env.STRIPE_LINK_BASIC;
    }
  }

  private async createReminders(quoteId: string, prospectId: string) {
    const now = new Date();

    await prisma.reminder.createMany({
      data: [
        {
          targetType: 'quote',
          targetId: quoteId,
          reminderType: 'quote_followup_d1',
          scheduledAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        },
        {
          targetType: 'quote',
          targetId: quoteId,
          reminderType: 'quote_followup_d3',
          scheduledAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          targetType: 'quote',
          targetId: quoteId,
          reminderType: 'quote_followup_d7',
          scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    logger.info(`Created 3 follow-up reminders for quote ${quoteId}`);
  }
}

export const quoteService = new QuoteService();
