import crypto from 'crypto';
import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { PACKAGES } from '../types';
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

    const PLAN_PRICING: Record<string, { setupFee: number; monthlyFee: number; callsQuota: number }> = {
      starter:    { setupFee: 0, monthlyFee: 497,  callsQuota: 800 },
      pro:        { setupFee: 0, monthlyFee: 1297, callsQuota: 2000 },
      enterprise: { setupFee: 0, monthlyFee: 2497, callsQuota: 4000 },
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
        onboardingStatus: 'pending',
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

    // Activate selected agent modules from metadata (set during checkout creation).
    // Either `bundle=true` (all 13 modules unlocked) or comma-separated
    // `modules=crm,marketing,...`. The bundle path expands to all field flags so
    // module services that gate on `client.agentSubscriptions?.crmAi` etc. grant
    // access to bundle buyers.
    const isBundle = session.metadata?.bundle === 'true';
    const moduleFlags = isBundle
      ? Object.fromEntries(Object.values(MODULE_FIELD_MAP).map(field => [field, true]))
      : parseModulesMetadata(session.metadata);
    if (Object.keys(moduleFlags).length > 0 || isBundle) {
      try {
        await prisma.agentSubscription.upsert({
          where: { clientId: client.id },
          create: {
            clientId: client.id,
            status: 'active',
            bundle: isBundle,
            ...moduleFlags,
          },
          update: {
            status: 'active',
            bundle: isBundle,
            ...moduleFlags,
          },
        });
        logger.info(`Self-onboarding: ${Object.keys(moduleFlags).length} modules activated for ${client.id} (bundle=${isBundle})`);
      } catch (err) {
        logger.error(`Self-onboarding: failed to activate modules for ${client.id}:`, err);
      }
    }

    // Trigger VAPI assistant creation + welcome email asynchronously.
    // Fire-and-forget: the 5-min onboarding retry cron handles failures.
    onboardingService.onboardClient(client.id).catch((err: Error) => {
      logger.error(`Async onboarding failed for client ${client.id}: ${err.message}`);
    });
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

    const VALID_PLANS = ['starter', 'pro', 'enterprise'] as const;
    if (!(VALID_PLANS as readonly string[]).includes(planType)) {
      logger.error(`Plan upgrade: invalid planType "${planType}" in metadata — aborting to prevent DB corruption`);
      return;
    }

    const PLAN_QUOTAS: Record<string, number> = { starter: 800, pro: 2000, enterprise: 4000 };
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      logger.error(`Plan upgrade: client ${clientId} not found`);
      return;
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        planType,
        monthlyCallsQuota: PLAN_QUOTAS[planType] ?? 2000,
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
  async createUpgradeCheckout(client: any, planType: string): Promise<string | null> {
    const PLAN_QUOTAS: Record<string, number> = { starter: 800, pro: 2000, enterprise: 4000 };
    const priceId = this.getMonthlyPriceId(planType);
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
        data: { planType, monthlyCallsQuota: PLAN_QUOTAS[planType] ?? 2000 },
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

  private getMonthlyPriceId(packageType: string): string {
    switch (packageType) {
      case 'starter':
      case 'basic':
        return env.STRIPE_PRICE_BASIC_MONTHLY;
      case 'pro':
        return env.STRIPE_PRICE_PRO_MONTHLY;
      case 'enterprise':
        return env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
      default:
        throw new Error(`No Stripe price configured for plan: ${packageType}`);
    }
  }

  // Stripe Checkout for the self-onboard flow.
  // Includes base plan + selected agent modules (or All Agents bundle).
  // `trial_period_days: 30` collects the card but charges nothing for 30 days.
  // The metadata is parsed by handleSelfOnboardingCheckout when the webhook fires.
  async createSelfOnboardCheckout(opts: {
    userId: string;
    email: string;
    planType: string;
    businessName?: string;
    businessPhone?: string;
    industry?: string;
    selectedModules?: string[];
    bundle?: boolean;
  }): Promise<{ url: string | null; id: string }> {
    const planPrice = this.getMonthlyPriceId(opts.planType);
    if (!planPrice) throw new Error(`Missing Stripe price for plan: ${opts.planType}`);

    const line_items: Array<{ price: string; quantity: number }> = [
      { price: planPrice, quantity: 1 },
    ];

    // Track which modules will be activated post-payment, even if a price ID is missing.
    // Storing in metadata so the webhook can activate them deterministically.
    const moduleIds: string[] = [];
    const missingPriceModules: string[] = [];

    if (opts.bundle === true) {
      const bundlePrice = env.STRIPE_PRICE_ALL_AGENTS_BUNDLE;
      if (!bundlePrice) {
        throw new Error('STRIPE_PRICE_ALL_AGENTS_BUNDLE is not configured');
      }
      line_items.push({ price: bundlePrice, quantity: 1 });
    } else if (Array.isArray(opts.selectedModules) && opts.selectedModules.length > 0) {
      for (const m of opts.selectedModules) {
        const price = MODULE_PRICE_ID_MAP[m];
        if (price && typeof price === 'string' && price.length > 0) {
          line_items.push({ price, quantity: 1 });
          moduleIds.push(m);
        } else {
          missingPriceModules.push(m);
        }
      }
      if (missingPriceModules.length > 0) {
        logger.warn(`[stripe] Missing price IDs for modules: ${missingPriceModules.join(', ')}`);
      }
    }

    const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items,
      success_url: `${frontendUrl}/onboard/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/onboard?step=5&canceled=1`,
      client_reference_id: opts.userId,
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          source: 'self-onboarding',
          userId: opts.userId,
          email: opts.email,
          planType: opts.planType,
          modules: moduleIds.join(','),
          bundle: opts.bundle === true ? 'true' : 'false',
        },
      },
      metadata: {
        source: 'self-onboarding',
        userId: opts.userId,
        email: opts.email,
        planType: opts.planType,
        businessName: opts.businessName ?? '',
        businessPhone: opts.businessPhone ?? '',
        industry: opts.industry ?? 'other',
        modules: moduleIds.join(','),
        bundle: opts.bundle === true ? 'true' : 'false',
      },
    });

    return { url: session.url, id: session.id };
  }
}

// Map module id (as used in frontend + metadata) → env var holding the Stripe price.
// Empty string means the module is not yet wired to a Stripe price; the line
// item is skipped (but activation via metadata still happens post-payment).
const MODULE_PRICE_ID_MAP: Record<string, string> = {
  email:      env.STRIPE_PRICE_EMAIL_AI,
  payments:   env.STRIPE_PRICE_PAYMENTS_AI,
  accounting: env.STRIPE_PRICE_ACCOUNTING_AI,
  inventory:  env.STRIPE_PRICE_INVENTORY_AI,
  marketing:  env.STRIPE_PRICE_MARKETING_AI,
  reputation: env.STRIPE_PRICE_REPUTATION_AI,
  scheduling: env.STRIPE_PRICE_SCHEDULING_AI,
  support:    env.STRIPE_PRICE_SUPPORT_AI,
  crm:        env.STRIPE_PRICE_CRM_AI,
  document:   env.STRIPE_PRICE_DOCUMENT_AI,
  local_seo:  env.STRIPE_PRICE_LOCAL_SEO_AI,
  lead_gen:   env.STRIPE_PRICE_LEAD_GEN_AI,
  analytics:  env.STRIPE_PRICE_ANALYTICS_AI,
};

// Map module id → AgentSubscription boolean field name.
const MODULE_FIELD_MAP: Record<string, string> = {
  email:      'emailAi',
  payments:   'paymentsAi',
  accounting: 'accountingAi',
  inventory:  'inventoryAi',
  marketing:  'marketingAi',
  reputation: 'reputationAi',
  scheduling: 'schedulingAi',
  support:    'supportAi',
  crm:        'crmAi',
  document:   'documentAi',
  local_seo:  'localSeoAi',
  lead_gen:   'leadGenAi',
  analytics:  'analyticsAi',
};

function parseModulesMetadata(metadata: Record<string, string> | null | undefined): Record<string, boolean> {
  if (!metadata) return {};
  const raw = (metadata.modules || '').trim();
  if (!raw) return {};
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  const flags: Record<string, boolean> = {};
  for (const id of ids) {
    const field = MODULE_FIELD_MAP[id];
    if (field) flags[field] = true;
  }
  return flags;
}

export const stripeService = new StripeService();
