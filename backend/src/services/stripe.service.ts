import crypto from 'crypto';
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

    // ── Self-onboarding flow: card registered → create Client + start trial ──
    if (session.metadata?.source === 'self-onboarding') {
      await this.handleSelfOnboardingCheckout(session);
      return;
    }

    // Idempotency: check if this session was already processed
    const existingPayment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: session.payment_intent },
    });
    if (existingPayment) {
      logger.info(`Session ${session.id} already processed (payment ${existingPayment.id}), skipping`);
      return;
    }

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

  // ═══════════════════════════════════════════════════════════════
  // SELF-ONBOARDING: Stripe card registered → Create Client record
  // Flow: Register → Confirm email → Onboard (info+plan) → Stripe → HERE
  // ═══════════════════════════════════════════════════════════════
  private async handleSelfOnboardingCheckout(session: any) {
    const userId = session.metadata?.userId || session.client_reference_id;
    if (!userId) {
      logger.error('Self-onboarding checkout: no userId in metadata');
      return;
    }

    // Idempotency: check if Client already exists for this user
    const existingClient = await prisma.client.findUnique({ where: { userId } });
    if (existingClient) {
      logger.info(`Self-onboarding: Client already exists for userId ${userId} — skipping creation`);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      logger.error(`Self-onboarding: User ${userId} not found`);
      return;
    }

    const planType = session.metadata?.planType || user.planType || 'pro';
    const businessName = session.metadata?.businessName || user.businessName || 'My Business';
    const businessPhone = session.metadata?.businessPhone || user.businessPhone || null;
    const industry = session.metadata?.industry || user.industry || 'other';

    const PLAN_PRICING: Record<string, { setupFee: number; monthlyFee: number; callsQuota: number }> = {
      starter:    { setupFee: 697, monthlyFee: 197, callsQuota: 200 },
      pro:        { setupFee: 997, monthlyFee: 347, callsQuota: 500 },
      enterprise: { setupFee: 1497, monthlyFee: 497, callsQuota: 1000 },
    };

    const pricing = PLAN_PRICING[planType] || PLAN_PRICING.pro;
    const dashboardToken = crypto.randomBytes(32).toString('hex');
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    // Create Client record — trial starts NOW
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        businessName,
        businessType: industry,
        contactName: user.name,
        contactEmail: user.email,
        contactPhone: businessPhone,
        country: 'US',
        planType,
        setupFee: pricing.setupFee,
        monthlyFee: pricing.monthlyFee,
        currency: 'USD',
        dashboardToken,
        onboardingStatus: 'completed',
        subscriptionStatus: 'active',
        isTrial: true,
        trialStartDate: new Date(),
        trialEndDate: trialEnd,
        monthlyCallsQuota: pricing.callsQuota,
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
      },
    });

    // Mark user onboarding as completed
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true },
    });

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: { newClients: { increment: 1 } },
      create: { date: today, newClients: 1 },
    });

    await discordService.notify(
      `🎉 NEW SELF-ONBOARD CLIENT!\n\nBusiness: ${businessName}\nEmail: ${user.email}\nPlan: ${planType.toUpperCase()}\nTrial: 30 days free\nClient ID: ${client.id}`
    );

    logger.info(`Self-onboarding complete: Client created for ${user.email} — clientId: ${client.id}, plan: ${planType}`);
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
        logger.error('Failed to create subscription for trial conversion:', error);
        // Revert to past_due so we can retry — don't leave client in limbo
        await prisma.client.update({
          where: { id: client.id },
          data: { subscriptionStatus: 'past_due' },
        });
        await discordService.notify(
          `⚠️ SUBSCRIPTION CREATION FAILED (trial conversion)\n\nClient: ${client.businessName}\nSetup fee paid but subscription failed\nStatus: past_due\nError: ${(error as Error).message}`
        );
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

    // Idempotency: skip if quote already accepted
    if (quote.status === 'accepted') {
      logger.info(`Quote ${quoteId} already accepted, skipping`);
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

    // Check contract signature status
    if (!quote.contractSignedAt) {
      logger.warn(`Payment received but contract not signed for quote ${quoteId}`);
      await discordService.notify(`⚠️ PAYMENT WITHOUT CONTRACT\n\nQuote: ${quoteId}\nBusiness: ${quote.prospect.businessName}\nPayment accepted — client will be created without signed contract`);
    }

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
        contractSignedAt: quote.contractSignedAt || null,
        contractUrl: quote.contractPdfUrl || null,
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
        logger.error('Failed to create subscription for new client:', error);
        await prisma.client.update({
          where: { id: client.id },
          data: { subscriptionStatus: 'past_due' },
        });
        await discordService.notify(
          `⚠️ SUBSCRIPTION CREATION FAILED (new client)\n\nClient: ${client.businessName}\nSetup fee paid but subscription failed\nStatus: past_due\nError: ${(error as Error).message}`
        );
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

    // Notify client via email with payment update link
    await emailService.sendPaymentFailedEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      amount: invoice.amount_due / 100,
      paymentLink: invoice.hosted_invoice_url || null,
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

  async handleSubscriptionCreated(subscription: any) {
    logger.info(`Subscription created: ${subscription.id}`);
    const client = await prisma.client.findFirst({ where: { stripeSubscriptionId: subscription.id } });
    if (client) {
      await prisma.client.update({ where: { id: client.id }, data: { subscriptionStatus: subscription.status } });
    }
  }

  async handleSubscriptionUpdated(subscription: any) {
    logger.info(`Subscription updated: ${subscription.id} → ${subscription.status}`);
    const client = await prisma.client.findFirst({ where: { stripeSubscriptionId: subscription.id } });
    if (!client) return;
    await prisma.client.update({
      where: { id: client.id },
      data: { subscriptionStatus: subscription.status === 'active' ? 'active' : subscription.status === 'past_due' ? 'past_due' : subscription.status },
    });
  }

  async handleSubscriptionDeleted(subscription: any) {
    logger.info(`Subscription deleted: ${subscription.id}`);
    const client = await prisma.client.findFirst({ where: { stripeSubscriptionId: subscription.id } });
    if (!client) return;
    await prisma.client.update({
      where: { id: client.id },
      data: { subscriptionStatus: 'canceled', cancellationDate: new Date() },
    });
    await discordService.notify(`❌ SUBSCRIPTION CANCELED\n\nClient: ${client.businessName}\nPlan: ${client.planType}\nSubscription: ${subscription.id}`);
  }

  // ═══════════════════════════════════════════════════════════
  // OVERAGE BILLING — Reports excess call usage to Stripe
  // Creates a one-time invoice item for calls beyond quota
  // ═══════════════════════════════════════════════════════════
  async reportOverageUsage(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !client.stripeSubscriptionId || !client.monthlyCallsQuota) return;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const callCount = await prisma.clientCall.count({
      where: { clientId, createdAt: { gte: monthStart } },
    });

    const overage = callCount - client.monthlyCallsQuota;
    if (overage <= 0) return;

    const overageRates: Record<string, number> = { starter: 0.22, pro: 0.18, enterprise: 0.15 };
    const rate = overageRates[client.planType] || 0.22;

    logger.info(`Overage for ${client.businessName}: ${overage} calls x $${rate} = $${(overage * rate).toFixed(2)}`);

    // Create a one-time invoice item for overage
    if (client.stripeCustomerId) {
      try {
        await stripe.invoiceItems.create({
          customer: client.stripeCustomerId,
          amount: Math.round(overage * rate * 100), // cents
          currency: 'usd',
          description: `Overage: ${overage} additional calls x $${rate}/call`,
        });
        logger.info(`Overage invoice item created for ${client.businessName}`);
      } catch (err) {
        logger.error(`Failed to create overage invoice for ${client.businessName}:`, err);
      }
    }
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
