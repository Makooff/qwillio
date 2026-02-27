import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { PACKAGES } from '../types';
import { onboardingService } from './onboarding.service';
import { discordService } from './discord.service';
import { emailService } from './email.service';

export class StripeService {
  async handleCheckoutCompleted(session: any) {
    logger.info(`Payment received! Session: ${session.id}`);

    const referenceId = session.client_reference_id || session.metadata?.quote_id;
    if (!referenceId) {
      logger.error('No reference ID in checkout session');
      return;
    }

    // Check if this is a trial client converting to paid
    const existingClient = await prisma.client.findUnique({
      where: { id: referenceId },
    });

    if (existingClient && existingClient.isTrial) {
      await this.handleTrialConversion(existingClient, session);
      return;
    }

    // Otherwise, handle as a normal quote payment
    await this.handleQuotePayment(referenceId, session);
  }

  private async handleTrialConversion(client: any, session: any) {
    logger.info(`Trial conversion for ${client.businessName}`);

    const pkg = PACKAGES[client.planType] || PACKAGES.basic;

    // Update client to active paid subscription
    await prisma.client.update({
      where: { id: client.id },
      data: {
        isTrial: false,
        subscriptionStatus: 'active',
        trialConvertedAt: new Date(),
        stripeCustomerId: session.customer || null,
        setupFee: pkg.setupFee,
        monthlyCallsQuota: pkg.callsQuota,
      },
    });

    // Cancel all pending trial reminders
    await prisma.reminder.updateMany({
      where: { targetId: client.id, targetType: 'client', status: 'pending' },
      data: { status: 'canceled' },
    });

    // Create Stripe subscription for monthly payments
    if (session.customer) {
      try {
        const priceId = this.getMonthlyPriceId(client.planType);
        if (priceId) {
          const subscription = await stripe.subscriptions.create({
            customer: session.customer,
            items: [{ price: priceId }],
            metadata: {
              client_id: client.id,
              business_name: client.businessName,
            },
          });

          await prisma.client.update({
            where: { id: client.id },
            data: { stripeSubscriptionId: subscription.id },
          });
        }
      } catch (error) {
        logger.error('Failed to create subscription:', error);
      }
    }

    // Record setup fee payment
    await prisma.payment.create({
      data: {
        clientId: client.id,
        stripePaymentIntentId: session.payment_intent,
        amount: pkg.setupFee,
        paymentType: 'setup_fee',
        status: 'succeeded',
        paidAt: new Date(),
        description: `Setup fee (trial conversion) - Package ${client.planType.toUpperCase()}`,
      },
    });

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: {
        revenueSetupFees: { increment: pkg.setupFee },
      },
      create: {
        date: today,
        revenueSetupFees: pkg.setupFee,
      },
    });

    await discordService.notify(
      `💰 TRIAL CONVERTED TO PAID!\n\nClient: ${client.businessName}\nPackage: ${client.planType.toUpperCase()}\nSetup: $${pkg.setupFee}\nMonthly: $${pkg.monthlyFee}/mo`
    );

    logger.info(`Trial converted to paid: ${client.businessName} (${client.planType})`);
  }

  private async handleQuotePayment(quoteId: string, session: any) {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { prospect: true },
    });

    if (!quote || !quote.prospect) {
      logger.error(`Quote not found: ${quoteId}`);
      return;
    }

    // Update quote
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    // Cancel all pending reminders for this quote
    await prisma.reminder.updateMany({
      where: { targetId: quoteId, targetType: 'quote', status: 'pending' },
      data: { status: 'canceled' },
    });

    // Create client
    const pkg = PACKAGES[quote.packageType] || PACKAGES.basic;
    const client = await prisma.client.create({
      data: {
        prospectId: quote.prospect.id,
        quoteId: quote.id,
        businessName: quote.prospect.businessName,
        businessType: quote.prospect.businessType,
        sector: quote.prospect.sector,
        contactName: quote.prospect.contactName || quote.prospect.businessName,
        contactEmail: quote.prospect.email || session.customer_email || '',
        contactPhone: quote.prospect.phone,
        address: quote.prospect.address,
        city: quote.prospect.city,
        postalCode: quote.prospect.postalCode,
        country: quote.prospect.country,
        planType: quote.packageType,
        setupFee: quote.setupFee,
        monthlyFee: quote.monthlyFee,
        stripeCustomerId: session.customer || null,
        subscriptionStatus: 'active',
        onboardingStatus: 'pending',
        activationDate: new Date(),
        monthlyCallsQuota: pkg.callsQuota,
      },
    });

    // Create Stripe subscription for monthly payments
    if (session.customer) {
      try {
        const priceId = this.getMonthlyPriceId(quote.packageType);
        if (priceId) {
          const subscription = await stripe.subscriptions.create({
            customer: session.customer,
            items: [{ price: priceId }],
            metadata: {
              client_id: client.id,
              business_name: client.businessName,
            },
          });

          await prisma.client.update({
            where: { id: client.id },
            data: { stripeSubscriptionId: subscription.id },
          });
        }
      } catch (error) {
        logger.error('Failed to create subscription:', error);
      }
    }

    // Record payment
    await prisma.payment.create({
      data: {
        clientId: client.id,
        stripePaymentIntentId: session.payment_intent,
        amount: Number(quote.setupFee),
        paymentType: 'setup_fee',
        status: 'succeeded',
        paidAt: new Date(),
        description: `Setup fee - Package ${quote.packageType.toUpperCase()}`,
      },
    });

    // Update prospect status
    await prisma.prospect.update({
      where: { id: quote.prospect.id },
      data: { status: 'converted' },
    });

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: {
        quotesAccepted: { increment: 1 },
        newClients: { increment: 1 },
        revenueSetupFees: { increment: Number(quote.setupFee) },
      },
      create: {
        date: today,
        quotesAccepted: 1,
        newClients: 1,
        revenueSetupFees: Number(quote.setupFee),
      },
    });

    // AUTOMATIC ONBOARDING - Create VAPI assistant, buy phone number, send welcome email
    await onboardingService.onboardClient(client.id);

    logger.info(`New client created: ${client.businessName} (${client.planType})`);
  }

  async handleInvoicePaid(invoice: any) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const client = await prisma.client.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!client) return;

    await prisma.payment.create({
      data: {
        clientId: client.id,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid / 100,
        paymentType: 'monthly_subscription',
        status: 'succeeded',
        paidAt: new Date(),
        description: `Monthly subscription - ${client.planType.toUpperCase()}`,
      },
    });

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: { revenueSubscriptions: { increment: invoice.amount_paid / 100 } },
      create: { date: today, revenueSubscriptions: invoice.amount_paid / 100 },
    });

    logger.info(`Invoice paid for ${client.businessName}: ${invoice.amount_paid / 100}€`);
  }

  async handlePaymentFailed(invoice: any) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const client = await prisma.client.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!client) return;

    await prisma.client.update({
      where: { id: client.id },
      data: { subscriptionStatus: 'past_due' },
    });

    await prisma.payment.create({
      data: {
        clientId: client.id,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due / 100,
        paymentType: 'monthly_subscription',
        status: 'failed',
        failedAt: new Date(),
        failureReason: 'Payment failed',
      },
    });

    await discordService.notify(
      `⚠️ PAYMENT FAILED\n\nClient: ${client.businessName}\nAmount: $${invoice.amount_due / 100}\nAction: Automatic retry scheduled`
    );

    // Notify client via email
    await emailService.sendPaymentFailedEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      amount: invoice.amount_due / 100,
    });

    // Create payment failed reminder
    await prisma.reminder.create({
      data: {
        targetType: 'client',
        targetId: client.id,
        reminderType: 'payment_failed',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  private getMonthlyPriceId(packageType: string): string {
    switch (packageType) {
      case 'basic': return env.STRIPE_PRICE_BASIC_MONTHLY;
      case 'pro': return env.STRIPE_PRICE_PRO_MONTHLY;
      case 'enterprise': return env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
      default: return env.STRIPE_PRICE_BASIC_MONTHLY;
    }
  }
}

export const stripeService = new StripeService();
