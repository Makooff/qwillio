import crypto from 'crypto';
import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { logger } from '../config/logger';
import { affiliateService } from './affiliate.service';
import { env } from '../config/env';
import { getPlan } from '../config/plans';
import { discordService } from './discord.service';
import { emailService } from './email.service';
import { onboardingService } from './onboarding.service';

export class StripeService {
  async handleCheckoutCompleted(session: any) {
    logger.info(`Payment received! Session: ${session.id}`);

    // ── Self-onboarding flow: card registered → create Client + start trial ──
    if (session.metadata?.source === 'self-onboarding') {
      await this.handleSelfOnboardingCheckout(session);
      return;
    }

    // ── Plan upgrade via Checkout (trial clients upgrading to a different plan) ──
    if (session.metadata?.source === 'plan-upgrade') {
      await this.handlePlanUpgradeCheckout(session);
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

    // No matching flow — log warning and return
    logger.warn(`Unhandled checkout session ${session.id} — not self-onboarding, not trial conversion, no quote`);
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

    const plan = getPlan(planType);
    const dashboardToken = crypto.randomBytes(32).toString('hex');
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + plan.trialDays);

    // Create Client record — trial starts NOW
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        businessName,
        businessType: industry,
        contactName: user.name,
        contactEmail: user.email,
        contactPhone: businessPhone,
        country: 'BE',
        planType,
        setupFee: 0,
        monthlyFee: plan.monthlyPriceEur,
        currency: 'EUR',
        dashboardToken,
        onboardingStatus: 'pending',
        subscriptionStatus: 'trialing',
        isTrial: true,
        trialStartDate: new Date(),
        trialEndDate: trialEnd,
        monthlyMinutesQuota: plan.includedMinutes,
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
      },
    });

    // Deliberately NOT setting User.onboardingCompleted here. The card is only
    // the second gate: the owner still has to configure the receptionist, and
    // that final step is what marks onboarding done. It is also what
    // grandfathers existing customers, who already carry the flag.

    // Update analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.analyticsDaily.upsert({
      where: { date: today },
      update: { newClients: { increment: 1 } },
      create: { date: today, newClients: 1 },
    });

    await discordService.notify(
      `💳 CARD REGISTERED — trial started\n\nBusiness: ${businessName}\nEmail: ${user.email}\nPlan: ${planType.toUpperCase()}\nTrial: ${plan.trialDays} days free\nClient ID: ${client.id}`
    );

    logger.info(`Card registered for ${user.email} — clientId: ${client.id}, plan: ${planType}, trial ${plan.trialDays}d`);

    // VAPI provisioning is deliberately NOT started here. The assistant is built
    // from the receptionist config (hours, services, voice, transfer number),
    // none of which exists yet — the owner fills it in during onboarding, and
    // authController.onboard triggers onboardClient once it does. The retry cron
    // only picks up `retry_pending`, so a client left at `pending` stays put.
  }

  private async handleTrialConversion(client: any, session: any) {
    logger.info(`Trial conversion for ${client.businessName}`);

    const plan = getPlan(client.planType);

    // Update client to active paid subscription
    await prisma.client.update({
      where: { id: client.id },
      data: {
        isTrial: false,
        subscriptionStatus: 'active',
        trialConvertedAt: new Date(),
        stripeCustomerId: session.customer || null,
        setupFee: 0,
        monthlyMinutesQuota: plan.includedMinutes,
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
        const priceId = await this.resolveMonthlyPriceId(client.planType);
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

    // No setup fee in the per-minute model — record the plan activation
    // only if a setup fee is ever configured (kept 0 during transition).
    if (plan.monthlyPriceEur > 0) {
      // Update analytics with the first monthly charge as recurring revenue.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.analyticsDaily.upsert({
        where: { date: today },
        update: {
          revenueSubscriptions: { increment: plan.monthlyPriceEur },
        },
        create: {
          date: today,
          revenueSubscriptions: plan.monthlyPriceEur,
        },
      });
    }

    await discordService.notify(
      `💰 TRIAL CONVERTED TO PAID!\n\nClient: ${client.businessName}\nPlan: ${plan.name}\nMonthly: ${plan.monthlyPriceEur} €/mo · ${plan.includedMinutes} min incluses`
    );

    logger.info(`Trial converted to paid: ${client.businessName} (${client.planType})`);
  }

  async handleInvoicePaid(invoice: any) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const client = await prisma.client.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!client) return;

    // Idempotency: Stripe may deliver invoice.paid more than once (retries).
    // Without this guard we'd record the payment twice and double-count revenue.
    if (invoice.id) {
      const already = await prisma.payment.findFirst({ where: { stripeInvoiceId: invoice.id } });
      if (already) {
        logger.info(`Invoice ${invoice.id} already recorded — skipping duplicate`);
        return;
      }
    }

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

    // Referral commission, if this customer came through an affiliate. Keyed on
    // the invoice id, so a retried webhook cannot credit it twice. Recorded
    // only — no payout is automated.
    await affiliateService.recordCommission(client.id, invoice.id, invoice.amount_paid / 100);

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
      lang: (client as any).language === 'en' ? 'en' : 'fr',
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
    if (!client || !client.stripeSubscriptionId) return;

    const plan = getPlan(client.planType);
    const includedMinutes = client.monthlyMinutesQuota ?? plan.includedMinutes;
    if (!includedMinutes) return;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Sum real call minutes this month (spam excluded — it never counts against
    // the client). Duration is stored in seconds on ClientCall.
    const agg = await prisma.clientCall.aggregate({
      where: { clientId, isSpam: false, createdAt: { gte: monthStart } },
      _sum: { durationSeconds: true },
    });
    const minutesUsed = Math.round((agg._sum.durationSeconds ?? 0) / 60);

    const overage = minutesUsed - includedMinutes;
    if (overage <= 0) return;

    const rate = plan.overagePerMinuteEur;
    logger.info(`Overage for ${client.businessName}: ${overage} min x €${rate} = €${(overage * rate).toFixed(2)}`);

    // Create a one-time invoice item for the overage minutes.
    if (client.stripeCustomerId) {
      try {
        await stripe.invoiceItems.create({
          customer: client.stripeCustomerId,
          amount: Math.round(overage * rate * 100), // cents
          currency: 'eur',
          description: `Dépassement : ${overage} minutes x €${rate}/min`,
        });
        logger.info(`Overage invoice item created for ${client.businessName}`);
      } catch (err) {
        logger.error(`Failed to create overage invoice for ${client.businessName}:`, err);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PLAN UPGRADE — Via Stripe Checkout (trial clients)
  // ═══════════════════════════════════════════════════════════════
  private async handlePlanUpgradeCheckout(session: any) {
    const clientId = session.metadata?.clientId || session.client_reference_id;
    const planType = session.metadata?.planType;
    if (!clientId || !planType) {
      logger.error('Plan upgrade checkout: missing clientId or planType in metadata');
      return;
    }

    const VALID_PLANS = ['solo', 'starter', 'pro', 'enterprise'] as const;
    if (!(VALID_PLANS as readonly string[]).includes(planType)) {
      logger.error(`Plan upgrade: invalid planType "${planType}" in metadata — aborting to prevent DB corruption`);
      return;
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      logger.error(`Plan upgrade: client ${clientId} not found`);
      return;
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        planType,
        monthlyMinutesQuota: getPlan(planType).includedMinutes,
        isTrial: false,
        subscriptionStatus: 'active',
        trialConvertedAt: new Date(),
        stripeCustomerId: session.customer || client.stripeCustomerId,
        stripeSubscriptionId: session.subscription || client.stripeSubscriptionId,
      },
    });

    await prisma.reminder.updateMany({
      where: { targetId: clientId, targetType: 'client', status: 'pending' },
      data: { status: 'canceled' },
    });

    await discordService.notify(
      `🔄 PLAN UPGRADED (checkout)\n\nClient: ${client.businessName}\nNew plan: ${planType.toUpperCase()}\nPrev plan: ${client.planType.toUpperCase()}`
    );

    logger.info(`Plan upgrade completed: ${client.businessName} → ${planType}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // CREATE UPGRADE CHECKOUT — For billing page plan change button
  // Returns null for paid clients (subscription updated inline);
  // returns Stripe Checkout URL for trial clients.
  // ═══════════════════════════════════════════════════════════════
  /**
   * Sign-up checkout: registers a card and opens the free trial.
   *
   * `payment_method_collection: 'always'` is the point of the whole thing —
   * with a trial Stripe defaults to 'if_required' and lets the customer through
   * without a card, which is exactly the hole this closes. Nothing is charged
   * until the trial ends.
   *
   * Completing this session fires `checkout.session.completed`, which
   * `handleSelfOnboardingCheckout` turns into the Client row.
   */
  async createSelfOnboardingCheckout(
    user: { id: string; email: string },
    planType: string,
    businessName: string,
    industry?: string | null,
  ): Promise<string | null> {
    const plan = getPlan(planType);
    const priceId = await this.resolveMonthlyPriceId(planType);
    if (!priceId) throw new Error(`No Stripe price configured for plan: ${planType}`);

    const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: plan.trialDays },
      payment_method_collection: 'always',
      success_url: `${frontendUrl}/onboard?payment=success`,
      cancel_url: `${frontendUrl}/subscribe?payment=cancelled`,
      client_reference_id: user.id,
      metadata: {
        source: 'self-onboarding',
        userId: user.id,
        planType: plan.id,
        businessName,
        industry: industry || 'other',
      },
    });

    logger.info(`Self-onboarding checkout created for ${user.email} — plan ${plan.id}, trial ${plan.trialDays}d`);
    return session.url;
  }

  async createUpgradeCheckout(client: any, planType: string): Promise<string | null> {
    const priceId = await this.resolveMonthlyPriceId(planType);
    if (!priceId) throw new Error(`No Stripe price configured for plan: ${planType}`);

    // Paid client with active subscription → update subscription directly, no checkout
    const isActivePaid = client.stripeSubscriptionId &&
      !client.isTrial &&
      client.subscriptionStatus !== 'canceled' &&
      client.subscriptionStatus !== 'cancelled';
    if (isActivePaid) {
      const subscription = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);
      const itemId = subscription.items.data[0]?.id;
      if (itemId) {
        await stripe.subscriptions.update(client.stripeSubscriptionId, {
          items: [{ id: itemId, price: priceId }],
          metadata: { client_id: client.id, plan_type: planType },
        });
      }
      await prisma.client.update({
        where: { id: client.id },
        data: { planType, monthlyMinutesQuota: getPlan(planType).includedMinutes },
      });
      await discordService.notify(
        `🔄 PLAN UPGRADED (inline)\n\nClient: ${client.businessName}\nNew plan: ${planType.toUpperCase()}\nPrev plan: ${client.planType.toUpperCase()}`
      );
      logger.info(`Inline plan upgrade: ${client.businessName} → ${planType}`);
      return null;
    }

    // Trial or no subscription → Stripe Checkout session
    const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(client.stripeCustomerId ? { customer: client.stripeCustomerId } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/dashboard/billing?payment=success`,
      cancel_url: `${frontendUrl}/dashboard/billing`,
      metadata: {
        source: 'plan-upgrade',
        clientId: client.id,
        planType,
      },
      client_reference_id: client.id,
    });

    return session.url;
  }

  // Optional manual override per plan (kept for backward compat). When set, it
  // wins over auto-provisioning so the founder can still pin a specific Price.
  private envPriceOverride(planId: string): string {
    switch (planId) {
      case 'solo':                 return env.STRIPE_PRICE_SOLO_MONTHLY;
      case 'starter': case 'basic': return env.STRIPE_PRICE_BASIC_MONTHLY;
      case 'pro':                  return env.STRIPE_PRICE_PRO_MONTHLY;
      case 'enterprise':           return env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
      default:                     return '';
    }
  }

  // In-process cache so we hit Stripe at most once per plan per boot.
  private priceIdCache = new Map<string, string>();

  /**
   * Resolve the recurring monthly Stripe Price id for a plan, creating it in
   * EUR from config/plans.ts if it does not exist yet. Idempotent via a stable
   * lookup_key, so no manual Stripe dashboard setup is required — only
   * STRIPE_SECRET_KEY (already needed for all billing). An explicit
   * STRIPE_PRICE_<PLAN>_MONTHLY env var, if set, overrides this.
   */
  private async resolveMonthlyPriceId(planType: string): Promise<string> {
    const plan = getPlan(planType);
    const planId = plan.id;

    const override = this.envPriceOverride(planId);
    if (override) return override;

    const cached = this.priceIdCache.get(planId);
    if (cached) return cached;

    const lookupKey = `qwillio_${planId}_monthly_eur`;

    // 1. Reuse an existing Price with our lookup key (created on a prior boot).
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (existing.data[0]?.id) {
      this.priceIdCache.set(planId, existing.data[0].id);
      return existing.data[0].id;
    }

    // 2. Otherwise create it from the plan definition (EUR, monthly recurring).
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(plan.monthlyPriceEur * 100),
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      product_data: { name: `Qwillio ${plan.name}` },
    });
    this.priceIdCache.set(planId, price.id);
    logger.info(`Auto-created Stripe Price ${price.id} for plan ${planId} (${plan.monthlyPriceEur}€/mo)`);
    return price.id;
  }
}

export const stripeService = new StripeService();
