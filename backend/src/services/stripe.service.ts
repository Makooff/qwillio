import crypto from 'crypto';
import { signupAgentLanguage } from '../utils/client-locale';
import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { logger } from '../config/logger';
import { affiliateService } from './affiliate.service';
import { env } from '../config/env';
import { getPlan, annualPriceEur, type BillingPeriod, type Plan, type PlanId } from '../config/plans';
import { discordService } from './discord.service';
import { emailService } from './email.service';
import { onboardingService } from './onboarding.service';
import { releaseClientNumbers } from './voice/phone-stock.service';
import { planAllows } from '../config/plan-features';
import {
  OPTION_LOOKUP_PREFIX,
  optionLookupKey,
  optionPriceEur,
  optionViability,
  superagentOffer,
} from '../config/superagent-option';

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

    /* Rejeu: on ne garde que si la session PORTE une intention de paiement.
       En SQL, `WHERE colonne = NULL` ne matche rien, mais Prisma traduit
       `{ stripePaymentIntentId: null }` en `IS NULL` — et une session en mode
       abonnement n'a pas d'intention de paiement, elle a une facture. La
       requête retrouvait donc la première ligne de paiement venue (toutes sont
       écrites sans intention, seulement avec un identifiant de facture) et
       déclarait « déjà traitée » une session qui ne l'était pas. Dès la
       première mensualité encaissée de la flotte, ce chemin refusait toutes les
       conversions d'essai, en silence, avec un journal qui disait le contraire.
       La protection contre le rejeu de ce chemin-là ne venait de toute façon
       pas d'ici: il n'écrit aucune ligne de paiement. C'est `isTrial` qui la
       porte, ci-dessous — la conversion le passe à faux, donc un rejeu ne
       rentre plus. */
    if (typeof session.payment_intent === 'string' && session.payment_intent) {
      const existingPayment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: session.payment_intent },
      });
      if (existingPayment) {
        logger.info(`Session ${session.id} already processed (payment ${existingPayment.id}), skipping`);
        return;
      }
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
    /* La période vient de la session Stripe, pas d'une supposition: c'est elle
       qui décide du montant réellement prélevé et de ce que la facturation
       affiche ensuite. */
    const billingPeriod: BillingPeriod = session.metadata?.billingPeriod === 'annual' ? 'annual' : 'monthly';
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
        /* La langue choisie sur le site, à la caisse ou à l'inscription; le
           pays ne tranche que si aucune des deux n'est connue. C'est la seule
           chose qui décide de la langue du premier appel, et elle reste
           modifiable dans Paramètres. */
        agentLanguage: signupAgentLanguage({
          siteLanguage: session.metadata?.language ?? user.language,
          country: 'BE',
        }),
        planType,
        setupFee: 0,
        /* En annuel, la mensualité EFFECTIVE est remisée de 20 %: reporter le
           tarif mensuel plein ici gonflerait le revenu récurrent de ce client
           d'un cinquième dans tous les tableaux de bord. */
        monthlyFee: billingPeriod === 'annual' ? Math.round(annualPriceEur(plan) / 12) : plan.monthlyPriceEur,
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
        /* L'option achetée à l'inscription, posée DÈS la création.
           `customer.subscription.updated` la relira sur les lignes de
           l'abonnement, mais il peut arriver avant que cette ligne existe: il
           cherche le client par `stripeSubscriptionId` et ne trouverait
           personne. Le droit serait alors facturé sans être accordé. */
        superagentOption: session.metadata?.superagent === 'on',
        vapiConfig: {
          billingPeriod,
          /* Acheter l'option, c'est demander le Superagent: le forfait seul ne
             le déclenche pas, c'est `voiceTier` qui décide du moteur. Le poser
             ici évite qu'un client paie et n'entende aucune différence. */
          ...(session.metadata?.superagent === 'on' ? { voiceTier: 'superagent' } : {}),
        },
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

  /**
   * Donne sa ligne dédiée à un client qui vient de devenir payant.
   *
   * Passe par `ensureLine`, la MÊME fonction que l'inscription: le stock
   * d'abord, l'achat automatique ensuite s'il est activé, la ligne partagée en
   * dernier recours. Une seconde règle d'attribution écrite ici finirait par
   * diverger de celle qui fait foi.
   *
   * N'échoue jamais vers l'appelant: un webhook Stripe qui lève est rejoué par
   * Stripe, et une panne Vapi ferait alors reconvertir l'abonnement en boucle.
   * Le client garde sa ligne partagée en attendant, et `npm run phone:assign`
   * rattrape le cas — c'est exactement ce pour quoi ce script existe.
   */
  private async provisionLineAfterPayment(clientId: string, businessName: string): Promise<void> {
    try {
      const { phoneSetupService } = await import('./voice/phone-setup.service');
      const line = await phoneSetupService.ensureLine(clientId);
      if (line.state === 'active' && line.number) {
        logger.info(`[Stripe] ${businessName}: ligne dédiée ${line.number} attribuée après paiement`);
      } else {
        /* Pas une erreur: stock vide, achat automatique éteint, ou assistant
           pas encore créé. Le client est joignable, mais sur la ligne
           partagée, et il PAIE. C'est un rattrapage à faire, donc c'est dit. */
        logger.warn(
          `[Stripe] ${businessName}: pas de ligne dédiée après paiement (${line.state})` +
            `${line.reason ? ` — ${line.reason}` : ''}. Rattrapage: npm run phone:assign`,
        );
      }
    } catch (error) {
      logger.error(`[Stripe] ${businessName}: attribution de ligne impossible: ${(error as Error).message}`);
    }
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

    /* La ligne dédiée, MAINTENANT qu'il paie.
       C'était le trou: `ensureLine` n'est appelée qu'à l'inscription, où le
       client est encore en essai et reçoit donc la ligne PARTAGÉE. La
       conversion passait le statut à `active` et s'arrêtait là. Le client
       payait, un numéro du stock l'attendait en base, et il restait sur la
       ligne partagée pour toujours — jusqu'à ce que quelqu'un pense à lancer
       `phone:assign` à la main.
       Attendue et non détachée: obtenir sa ligne fait partie de devenir
       client, et un numéro attribué trente secondes plus tard vaut mieux
       qu'une réponse Stripe trente millisecondes plus tôt.
       Le `catch` est là parce qu'un webhook Stripe qui lève est rejoué: une
       panne Vapi ferait alors reconvertir l'abonnement en boucle. `ensureLine`
       est idempotente, donc le rejeu la reprend sans risque. */
    await this.provisionLineAfterPayment(client.id, client.businessName);

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
          /* L'option achetée PENDANT l'essai voyage vers l'abonnement payant.
             Cet abonnement est créé de zéro: sans cette ligne, un client qui a
             activé le Superagent pendant son essai le perdrait le jour où il
             commence à payer, avec `superagentOption` resté à vrai en base —
             donc un droit servi que plus aucune ligne ne facture. */
          const carry = await this.optionLineItems(
            client.planType, 'monthly', client.superagentOption === true,
          );
          const subscription = await stripe.subscriptions.create({
            customer: session.customer,
            items: [{ price: priceId }, ...carry],
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
    const status = subscription.status === 'active' ? 'active'
      : subscription.status === 'past_due' ? 'past_due'
      : subscription.status;

    /* Un abonnement qui passe à `active` met fin à l'essai, et personne ne le
       disait: `isTrial` restait vrai après conversion. Le client apparaissait
       donc en essai dans le portail, continuait de recevoir les relances de fin
       d'essai, et surtout restait à portée du cron d'expiration, qui pouvait
       supprimer l'assistant Vapi d'un client qui venait de payer. */
    const converting = status === 'active' && client.isTrial;
    if (converting) {
      logger.info(`[Stripe] essai converti pour ${client.businessName}`);
    }

    /* LE DROIT SE LIT LÀ OÙ IL EST FACTURÉ.
     *
     * `superagentOption` suit les lignes réellement portées par l'abonnement,
     * jamais l'intention de celui qui a cliqué. C'est ce qui fait que trois
     * chemins convergent sans être écrits trois fois: la vente depuis le
     * portail, l'achat à la caisse d'inscription, et une ligne ajoutée ou
     * retirée à la main dans le tableau de bord Stripe.
     *
     * C'est aussi ce qui referme la porte de sortie: une option retirée (par le
     * client, par un changement de forfait, par un impayé qui résilie la ligne)
     * coupe le droit au prochain appel, au lieu de laisser tourner un moteur
     * que plus personne ne paie.
     *
     * La garde sur `items.data` n'est pas décorative: un objet d'abonnement
     * sans ses lignes se lirait « aucune option », donc RETIRERAIT le droit à
     * tous ceux qui l'ont payé. Un champ absent ne vaut pas un champ vide. */
    const lines = subscription?.items?.data;
    const optionPaid = Array.isArray(lines) ? this.optionItemOf(subscription) !== null : null;

    await prisma.client.update({
      where: { id: client.id },
      data: {
        subscriptionStatus: status,
        ...(converting ? { isTrial: false, trialConvertedAt: new Date() } : {}),
        ...(optionPaid !== null && optionPaid !== client.superagentOption
          ? { superagentOption: optionPaid }
          : {}),
      },
    });

    if (optionPaid !== null && optionPaid !== client.superagentOption) {
      logger.info(
        `[Stripe] ${client.businessName}: option Superagent ${optionPaid ? 'ACTIVE' : 'retirée'} ` +
          `(lue sur les lignes de l'abonnement).`,
      );
      await this.applySuperagentTier(client, optionPaid);
    }

    /* Meme geste que `handleTrialConversion`: sans lui, un client qui vient de
       payer continue de recevoir les relances de fin d'essai. */
    if (converting) {
      await prisma.reminder.updateMany({
        where: { targetId: client.id, targetType: 'client', status: 'pending' },
        data: { status: 'canceled' },
      });
    }
  }

  async handleSubscriptionDeleted(subscription: any) {
    logger.info(`Subscription deleted: ${subscription.id}`);
    const client = await prisma.client.findFirst({ where: { stripeSubscriptionId: subscription.id } });
    if (!client) return;
    await prisma.client.update({
      where: { id: client.id },
      data: { subscriptionStatus: 'canceled', cancellationDate: new Date() },
    });

    /* Le numéro belge retourne au stock. Sans ce geste, chaque résiliation
       retirerait une ligne du lot pour toujours: elle resterait facturée chez
       Twilio, attribuée à un client parti, et invisible dans le compte des
       numéros libres. Le numéro n'est PAS rendu à Twilio — il est déjà payé et
       déjà couvert par le dossier réglementaire, il sert au client suivant. */
    let released = 0;
    try {
      released = await releaseClientNumbers(client.id);
    } catch (error) {
      /* Une résiliation ne doit jamais échouer pour cette raison: le paiement
         est déjà arrêté côté Stripe, et un numéro coincé se rattrape à la main
         (`npm run phone:stock` le montre). */
      logger.error(`[Stripe] libération du numéro de ${client.id} échouée: ${(error as Error).message}`);
    }

    await discordService.notify(
      `❌ SUBSCRIPTION CANCELED\n\nClient: ${client.businessName}\nPlan: ${client.planType}\nSubscription: ${subscription.id}` +
        (released > 0 ? `\nNuméro(s) rendu(s) au stock: ${released}` : ''),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // OVERAGE BILLING — Reports excess call usage to Stripe
  // Creates a one-time invoice item for calls beyond quota
  // ═══════════════════════════════════════════════════════════
  /**
   * Le supplément du mode parole-à-parole, facturé à la minute réellement
   * passée dans ce mode.
   *
   * Ne fait rien tant que `VOICE_REALTIME_SURCHARGE_EUR` vaut 0: l'option
   * n'est alors pas vendue, et poser ce prix est le seul geste qui la met en
   * vente. Le même réglage fait résoudre `auto` en classique, pour qu'aucun
   * client ne découvre l'option sur sa facture.
   */
  private async reportRealtimeSurcharge(input: {
    clientId: string;
    customerId: string | null;
    businessName: string;
    planType: string;
    superagentOption: boolean;
    billedMonth: string;
    billedMonthStart: Date;
    monthStart: Date;
  }): Promise<void> {
    const rate = env.VOICE_REALTIME_SURCHARGE_EUR;
    if (rate <= 0 || !input.customerId) return;

    /* L'option vendue au FORFAIT a déjà payé le mois. La facturer aussi à la
       minute, c'est prélever deux fois la même chose sur la même carte, et
       personne ne le verrait avant le relevé: la ligne « Voix temps réel » et
       la ligne « Superagent » vivraient côte à côte sur la même facture.
       C'est la moitié manquante du garde-fou juste en dessous: il couvrait le
       forfait qui INCLUT le Superagent, pas l'option qui le VEND. */
    if (input.superagentOption) {
      logger.info(
        `[Stripe] supplément temps réel non facturé à ${input.businessName}: ` +
          `l'option Superagent est déjà payée au forfait.`,
      );
      return;
    }

    /* Un forfait qui INCLUT le Superagent ne le paie pas une seconde fois.
       Sans cette ligne, poser le prix de l'option facturerait la minute temps
       réel à un client Pro qui l'a déjà payée dans son abonnement: un double
       prélèvement, sur une vraie carte, invisible jusqu'au relevé. C'est le
       mode d'échec de 6duodecies, depuis l'autre bout de la chaîne.
       Le droit ACHETÉ (`superagentOption`), lui, se facture: c'est ce qu'il
       est. La distinction se lit dans `planAllows`, pas ici. */
    if (planAllows(input.planType, 'superagent')) {
      logger.info(
        `[Stripe] supplément temps réel non facturé à ${input.businessName}: ` +
          `le forfait ${input.planType} l'inclut.`,
      );
      return;
    }

    const agg = await prisma.clientCall.aggregate({
      where: {
        clientId: input.clientId,
        isSpam: false,
        voiceMode: 'realtime',
        createdAt: { gte: input.billedMonthStart, lt: input.monthStart },
      },
      _sum: { durationSeconds: true },
    });
    const minutes = Math.round((agg._sum.durationSeconds ?? 0) / 60);
    if (minutes <= 0) return;

    logger.info(
      `Realtime surcharge for ${input.businessName} (${input.billedMonth}): ${minutes} min x €${rate} = €${(minutes * rate).toFixed(2)}`,
    );

    try {
      await stripe.invoiceItems.create(
        {
          customer: input.customerId,
          amount: Math.round(minutes * rate * 100), // centimes
          currency: 'eur',
          description: `Voix temps réel ${input.billedMonth} : ${minutes} minutes x €${rate}/min`,
        },
        // Distincte de celle du dépassement: les deux lignes coexistent sur la
        // même facture, et un cron rejoué ne doit dupliquer ni l'une ni l'autre.
        { idempotencyKey: `realtime-${input.clientId}-${input.billedMonth}` },
      );
    } catch (err) {
      logger.error(`Failed to create realtime surcharge invoice for ${input.businessName}:`, err);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // OPTION SUPERAGENT — un forfait mensuel, seconde ligne de l'abonnement
  // ═══════════════════════════════════════════════════════════════
  /**
   * Pourquoi une seconde LIGNE et pas un second abonnement.
   *
   * Un second abonnement produirait une seconde facture, une seconde date de
   * renouvellement et une seconde résiliation à ne pas oublier — c'est
   * exactement le montage qui a fait facturer deux fois un même client en
   * 6undecies. Une ligne supplémentaire sur l'abonnement existant partage la
   * période, la facture et la carte, et Stripe calcule le prorata seul quand
   * elle arrive ou repart en milieu de mois.
   */

  /** Le prix Stripe de l'option pour ce forfait et cette période, créé depuis la config si absent. */
  private async resolveOptionPriceId(planId: PlanId, period: BillingPeriod, priceEur: number): Promise<string> {
    const lookupKey = optionLookupKey(planId, period);
    const cached = this.priceIdCache.get(lookupKey);
    if (cached) return cached;

    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (existing.data[0]?.id) {
      this.priceIdCache.set(lookupKey, existing.data[0].id);
      /* Retrouvé par clé, donc possiblement créé sous une tarification
         précédente: c'est le chemin que le garde-fou des forfaits surveille, et
         l'option n'a aucune raison d'y échapper. */
      await this.assertOptionPriceMatches(existing.data[0].id, planId, period, priceEur);
      return existing.data[0].id;
    }

    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(priceEur * 100),
      recurring: { interval: period === 'annual' ? 'year' : 'month' },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      product_data: { name: `Qwillio Superagent (${getPlan(planId).name})` },
    });
    this.priceIdCache.set(lookupKey, price.id);
    // Créé à l'instant depuis la config: juste par construction (cf. les forfaits).
    this.verifiedPrices.add(price.id);
    logger.info(
      `Auto-created Stripe Price ${price.id} for Superagent option ` +
        `(${planId}, ${priceEur}€/${period === 'annual' ? 'an' : 'mois'})`,
    );
    return price.id;
  }

  /** Même refus que pour un forfait: on ne prélève pas un montant que la page n'a pas annoncé. */
  private async assertOptionPriceMatches(
    priceId: string, planId: PlanId, period: BillingPeriod, priceEur: number,
  ): Promise<void> {
    if (this.verifiedPrices.has(priceId)) return;

    const attendu = Math.round(priceEur * 100);
    const intervalleAttendu = period === 'annual' ? 'year' : 'month';
    const price = await stripe.prices.retrieve(priceId);
    const ecarts: string[] = [];
    if (price.unit_amount !== attendu) {
      ecarts.push(`montant ${(price.unit_amount ?? 0) / 100} € au lieu de ${priceEur} €`);
    }
    if (price.currency !== 'eur') ecarts.push(`devise ${price.currency} au lieu de eur`);
    if (price.recurring?.interval !== intervalleAttendu) {
      ecarts.push(`période ${price.recurring?.interval ?? 'aucune'} au lieu de ${intervalleAttendu}`);
    }
    if (!ecarts.length) {
      this.verifiedPrices.add(priceId);
      return;
    }

    const message =
      `Le prix Stripe ${priceId} de l'option Superagent (${planId}, ${period}) ne correspond pas: ${ecarts.join(', ')}.`;
    logger.error(`[Stripe] ${message}`);
    await discordService.notify(
      `🚨 TARIF INCOHÉRENT (option Superagent)\n\n${message}\n\n` +
        `La vente est REFUSÉE tant que ce n'est pas corrigé. Le prix est créé depuis ` +
        `config/superagent-option.ts et retrouvé par la clé \`${optionLookupKey(planId, period)}\`: ` +
        `désactiver le prix divergent chez Stripe suffit à le faire recréer au bon montant.`,
    );
    throw new Error(message);
  }

  /**
   * Faire ARRIVER le droit jusqu'à l'appel: le niveau, le cache, l'assistant.
   *
   * Un droit écrit en base ne change rien à l'appel suivant. Le moteur est
   * décidé par `voiceTier`, le profil est servi depuis un cache, et l'assistant
   * DISTANT garde la configuration figée à la dernière synchronisation. Sans ces
   * gestes, un client qui vient d'acheter paie sans entendre la moindre
   * différence, et un client qui annule continue d'être servi.
   *
   * Un seul endroit les fait, appelé par le webhook ET par la route du portail:
   * deux copies d'une même règle divergent en moins d'un mois (6vicies).
   */
  async applySuperagentTier(
    client: { id: string; businessName: string; vapiConfig?: unknown },
    active: boolean,
  ): Promise<void> {
    /* En retirant, on ne remet à zéro que si le client avait DEMANDÉ le
       Superagent: écraser un « base » choisi effacerait un réglage que l'option
       n'a jamais touché. */
    const chosen = (client.vapiConfig as any)?.voiceTier;
    const next = active ? 'superagent' : (chosen === 'superagent' ? null : chosen ?? null);
    const { applyVoiceTier } = await import('./voice/apply-voice-tier');
    /* Ne lève jamais vers l'appelant: un webhook Stripe qui lève est rejoué,
       donc un refus de Vapi ferait rejouer le changement d'abonnement en
       boucle. `applyVoiceTier` rend son échec au lieu de le jeter, et il est
       déjà journalisé avec le corps de la réponse de Vapi. */
    await applyVoiceTier(client.id, next)
      .catch(error => logger.error(`[Stripe] niveau non appliqué pour ${client.businessName}:`, error));
  }

  /** La ligne d'option sur cet abonnement, s'il en porte une. */
  private optionItemOf(subscription: any): any | null {
    return subscription?.items?.data?.find(
      (item: any) => typeof item?.price?.lookup_key === 'string'
        && item.price.lookup_key.startsWith(OPTION_LOOKUP_PREFIX),
    ) ?? null;
  }

  /**
   * La période RÉELLE de cet abonnement, lue sur sa ligne de forfait.
   *
   * Stripe refuse un abonnement dont les lignes n'ont pas le même intervalle,
   * donc c'est lui qui commande, pas `vapiConfig.billingPeriod`. Les deux
   * devraient dire la même chose; quand ils divergent, celui qui fait échouer
   * l'appel d'API est celui de Stripe.
   */
  private subscriptionPeriod(subscription: any): BillingPeriod {
    const plan = subscription?.items?.data?.find(
      (item: any) => !String(item?.price?.lookup_key ?? '').startsWith(OPTION_LOOKUP_PREFIX),
    );
    return plan?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
  }

  /**
   * Vendre l'option à un client qui a déjà un abonnement.
   *
   * Ne touche PAS `superagentOption` en base: c'est `customer.subscription.updated`
   * qui l'écrit, depuis les lignes réellement portées par l'abonnement. Un droit
   * facturé se lit là où il est facturé, sinon une ligne retirée à la main dans
   * le tableau de bord Stripe laisserait le droit ouvert pour toujours.
   */
  async addSuperagentOption(client: {
    id: string; businessName: string; planType: string;
    stripeSubscriptionId: string | null; superagentOption?: boolean | null;
  }): Promise<{ ok: true; alreadyOn: boolean } | { ok: false; error: string; message: string }> {
    const check = superagentOffer(client, env.VOICE_REALTIME_MODEL);
    if (check.included) {
      return { ok: false, error: 'already_included', message: 'Votre forfait inclut déjà le Superagent.' };
    }
    if (check.priceEur === null) {
      return { ok: false, error: 'not_sold', message: "Le Superagent ne se vend pas en option sur ce forfait." };
    }
    if (!client.stripeSubscriptionId) {
      return {
        ok: false, error: 'no_subscription',
        message: "Aucun abonnement actif: l'option s'ajoute à un abonnement, pas à côté.",
      };
    }
    if (!check.sellable && !check.active) {
      /* Le refus est une anomalie de CONFIGURATION, pas une erreur du client:
         il porte sur le modèle temps réel de toute la flotte. Il s'alerte. */
      logger.error(`[Stripe] option Superagent invendable: ${check.blockedReason}`);
      await discordService.notify(
        `🚫 OPTION SUPERAGENT INVENDABLE\n\n${client.businessName} a voulu l'acheter et ne peut pas.\n\n` +
          `${check.blockedReason}`,
      );
      return {
        ok: false, error: 'not_sellable',
        message: "L'option n'est pas disponible pour le moment. Nous avons été prévenus.",
      };
    }

    const plan = getPlan(client.planType);
    const subscription = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);
    if (this.optionItemOf(subscription)) {
      return { ok: true, alreadyOn: true };
    }

    /* La période vient de l'abonnement, pas de ce que nous en avons retenu:
       Stripe refuse une ligne mensuelle sur un abonnement annuel, et c'est lui
       qui tranche. */
    const period = this.subscriptionPeriod(subscription);
    const priceEur = optionPriceEur(plan.id, period);
    if (priceEur === null) {
      return { ok: false, error: 'not_sold', message: "Le Superagent ne se vend pas en option sur ce forfait." };
    }

    const priceId = await this.resolveOptionPriceId(plan.id, period, priceEur);
    await stripe.subscriptions.update(client.stripeSubscriptionId, {
      items: [...subscription.items.data.map((i: any) => ({ id: i.id })), { price: priceId, quantity: 1 }],
      /* Le prorata est celui de Stripe: l'option prise le 20 du mois n'est pas
         due en entier, et l'annuler le 8 rend la différence. Écrire notre
         propre règle ici produirait un montant que la facture contredit. */
      proration_behavior: 'create_prorations',
    });

    const unite = period === 'annual' ? 'an' : 'mois';
    logger.info(`[Stripe] option Superagent vendue à ${client.businessName} (${plan.id}, ${priceEur}€/${unite})`);
    await discordService.notify(
      `⚡ OPTION SUPERAGENT\n\nClient: ${client.businessName}\nForfait: ${plan.name}\n` +
        `Prix: ${priceEur} €/${unite}`,
    );
    return { ok: true, alreadyOn: false };
  }

  /** Retirer l'option. Idempotent: une ligne absente n'est pas une erreur. */
  async removeSuperagentOption(client: {
    id: string; businessName: string; stripeSubscriptionId: string | null;
  }): Promise<{ ok: true; wasOn: boolean }> {
    if (!client.stripeSubscriptionId) return { ok: true, wasOn: false };

    const subscription = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);
    const item = this.optionItemOf(subscription);
    if (!item) return { ok: true, wasOn: false };

    await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
    logger.info(`[Stripe] option Superagent retirée pour ${client.businessName}`);
    return { ok: true, wasOn: true };
  }

  /**
   * Remettre la ligne d'option d'accord avec le forfait, après un changement.
   *
   * Deux dérives, toutes deux silencieuses et toutes deux sur une vraie carte:
   *
   *  - monter vers Pro, qui INCLUT le Superagent, en gardant la ligne d'option:
   *    le client paie 20 € par mois pour ce que son abonnement lui donne déjà ;
   *  - passer de Solo à Starter en gardant le prix Solo: l'option est facturée
   *    20 € pour 750 minutes incluses, c'est-à-dire sous son coût.
   *
   * Appelée après chaque changement de forfait, des deux chemins.
   */
  async reconcileSuperagentOptionForPlan(
    client: { id: string; businessName: string; stripeSubscriptionId: string | null },
    nextPlanType: string,
  ): Promise<void> {
    if (!client.stripeSubscriptionId) return;
    try {
      const subscription = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);
      const item = this.optionItemOf(subscription);
      if (!item) return;

      const plan = getPlan(nextPlanType);
      if (planAllows(plan.id, 'superagent')) {
        await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
        logger.info(
          `[Stripe] ${client.businessName}: option Superagent retirée, le forfait ${plan.id} l'inclut.`,
        );
        return;
      }

      const period = this.subscriptionPeriod(subscription);
      const priceEur = optionPriceEur(plan.id, period);
      if (priceEur === null) {
        await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
        logger.warn(`[Stripe] ${client.businessName}: option Superagent retirée, invendable sur ${plan.id}.`);
        return;
      }

      const wanted = await this.resolveOptionPriceId(plan.id, period, priceEur);
      if (item.price?.id === wanted) return;
      await stripe.subscriptionItems.update(item.id, { price: wanted, proration_behavior: 'create_prorations' });
      logger.info(`[Stripe] ${client.businessName}: option Superagent repricée sur ${plan.id} (${priceEur}€).`);
    } catch (error) {
      /* Jamais fatal: cette méthode est appelée depuis un webhook et depuis un
         changement de forfait déjà enregistré. Lever ici ferait rejouer le
         changement entier par Stripe pour une ligne d'option. */
      logger.error(`[Stripe] réconciliation de l'option Superagent impossible pour ${client.businessName}:`, error);
    }
  }

  /**
   * La ligne d'option à poser dans une CAISSE, quand elle s'achète en même
   * temps que le forfait.
   *
   * Rend un tableau (vide ou d'un élément) pour s'étaler dans `line_items` sans
   * condition à l'appel. Refuse silencieusement quand l'option n'est pas
   * vendable: une caisse qui s'ouvre sans la ligne vaut mieux qu'une caisse qui
   * ne s'ouvre pas, et le droit ne sera pas accordé puisqu'il se lit sur les
   * lignes de l'abonnement.
   */
  private async optionLineItems(
    planType: string, period: BillingPeriod, wanted: boolean,
  ): Promise<Array<{ price: string; quantity: number }>> {
    if (!wanted) return [];
    const plan = getPlan(planType);
    const priceEur = optionPriceEur(plan.id, period);
    if (priceEur === null) return [];
    const viability = optionViability(env.VOICE_REALTIME_MODEL);
    if (!viability.sellable) {
      logger.error(`[Stripe] option Superagent demandée à la caisse mais invendable: ${viability.reason}`);
      return [];
    }
    return [{ price: await this.resolveOptionPriceId(plan.id, period, priceEur), quantity: 1 }];
  }

  async reportOverageUsage(clientId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !client.stripeSubscriptionId) return;

    const plan = getPlan(client.planType);
    const includedMinutes = client.monthlyMinutesQuota ?? plan.includedMinutes;
    if (!includedMinutes) return;

    /* Fenêtre facturée: le mois PRÉCÉDENT, en entier.
     *
     * Le cron tourne le 1er à 06:00. L'ancienne version sommait depuis le 1er
     * du mois COURANT, c'est-à-dire six heures d'appels: l'overage ne
     * facturait jamais rien. On fige [1er du mois précédent, 1er du mois
     * courant), et cette borne devient aussi la clé d'idempotence — un cron
     * relancé (retry, double instance) ne peut plus produire deux lignes de
     * facture pour le même mois. */
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const billedMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const billedMonth = `${billedMonthStart.getFullYear()}-${String(billedMonthStart.getMonth() + 1).padStart(2, '0')}`;

    // Sum real call minutes for the billed month (spam excluded — it never
    // counts against the client). Duration is stored in seconds on ClientCall.
    const agg = await prisma.clientCall.aggregate({
      where: { clientId, isSpam: false, createdAt: { gte: billedMonthStart, lt: monthStart } },
      _sum: { durationSeconds: true },
    });
    const minutesUsed = Math.round((agg._sum.durationSeconds ?? 0) / 60);

    /* Le supplément « temps réel », AVANT le retour anticipé du dépassement.
     *
     * C'est une option à la minute, pas un dépassement: un client qui reste
     * sous son quota la doit quand même, sinon l'option ne serait facturée
     * qu'aux gros consommateurs. Les deux lignes sont donc indépendantes, avec
     * chacune sa clé d'idempotence.
     *
     * On somme `voiceMode: 'realtime'`, c'est-à-dire le moteur RÉELLEMENT
     * utilisé, consigné appel par appel. Les appels antérieurs à cette colonne
     * valent `null` et ne sont pas facturés: une facture ne se fonde pas sur
     * une reconstitution. */
    await this.reportRealtimeSurcharge({
      clientId,
      customerId: client.stripeCustomerId,
      businessName: client.businessName,
      planType: client.planType,
      superagentOption: client.superagentOption === true,
      billedMonth,
      billedMonthStart,
      monthStart,
    });

    const overage = minutesUsed - includedMinutes;
    if (overage <= 0) return;

    const rate = plan.overagePerMinuteEur;
    logger.info(`Overage for ${client.businessName} (${billedMonth}): ${overage} min x €${rate} = €${(overage * rate).toFixed(2)}`);

    // Create a one-time invoice item for the overage minutes.
    if (client.stripeCustomerId) {
      try {
        await stripe.invoiceItems.create(
          {
            customer: client.stripeCustomerId,
            amount: Math.round(overage * rate * 100), // cents
            currency: 'eur',
            description: `Dépassement ${billedMonth} : ${overage} minutes x €${rate}/min`,
          },
          { idempotencyKey: `overage-${clientId}-${billedMonth}` },
        );
        logger.info(`Overage invoice item created for ${client.businessName}`);
      } catch (err) {
        logger.error(`Failed to create overage invoice for ${client.businessName}:`, err);
      }
    }
  }

  /**
   * Annule l'abonnement que le nouveau remplace.
   *
   * Le passage en caisse d'un changement d'offre crée un SECOND abonnement
   * chez Stripe. Le client gardait donc les deux: l'essai (sa carte, son plan
   * d'origine) et le nouveau. À la fin de l'essai, Stripe facturait les deux.
   * Qwillio, lui, ne pointait plus que le second, donc aucun chemin du produit
   * n'aurait annulé le premier ni même signalé son existence: seule une
   * lecture du tableau de bord Stripe l'aurait montré, après le prélèvement.
   *
   * L'ORDRE fait la moitié du correctif et n'est pas interchangeable.
   * `customer.subscription.deleted` retrouve le client par son
   * `stripeSubscriptionId`: annuler AVANT la mise à jour ferait donc trouver
   * CE client, passerait son statut à `canceled` et RENDRAIT SON NUMÉRO AU
   * STOCK, quelques secondes après le lui avoir attribué. Annulé après,
   * l'ancien identifiant ne désigne plus personne et l'événement est ignoré,
   * ce qui est précisément ce qu'on veut.
   *
   * Rejeu: Stripe rejoue ses webhooks. Au second passage, le client pointe
   * déjà le nouvel abonnement, les deux identifiants sont égaux, et rien n'est
   * annulé.
   */
  private async cancelSupersededSubscription(
    previousId: string | null | undefined,
    nextId: string | null | undefined,
    businessName: string,
  ): Promise<void> {
    if (!previousId || !nextId || previousId === nextId) return;
    try {
      await stripe.subscriptions.cancel(previousId);
      logger.info(
        `[Stripe] ${businessName}: ancien abonnement ${previousId} annulé, remplacé par ${nextId}`,
      );
    } catch (error) {
      /* Ne fait pas échouer le webhook: Stripe le rejouerait, et le rejeu
         reconvertirait un client déjà converti. Un abonnement déjà annulé
         tombe ici aussi, et n'est pas un incident. Ce qui compte, c'est que le
         cas où il RESTE facturable soit écrit noir sur blanc. */
      logger.error(
        `[Stripe] ${businessName}: annulation de l'ancien abonnement ${previousId} impossible: ` +
          `${(error as Error).message}. À annuler à la main dans Stripe, sinon il sera ` +
          'facturé à la fin de l\'essai.',
      );
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

    const nextSubscriptionId = session.subscription || client.stripeSubscriptionId;

    /* Le droit suit la caisse qui vient d'être payée, pas celle d'avant. Sans
       cette ligne, un client qui monte vers Pro garderait `superagentOption` à
       vrai — un droit ACHETÉ, donc facturable à la minute par
       `reportRealtimeSurcharge`, alors qu'il ne paie plus aucune ligne
       d'option. L'événement d'abonnement dirait la même chose, mais rien ne
       garantit qu'il arrive avant celui-ci. */
    const optionBought = session.metadata?.superagent === 'on';

    await prisma.client.update({
      where: { id: clientId },
      data: {
        planType,
        monthlyMinutesQuota: getPlan(planType).includedMinutes,
        isTrial: false,
        subscriptionStatus: 'active',
        trialConvertedAt: new Date(),
        stripeCustomerId: session.customer || client.stripeCustomerId,
        stripeSubscriptionId: nextSubscriptionId,
        superagentOption: optionBought,
      },
    });

    /* L'essai que ce passage en caisse vient de remplacer. APRÈS la mise à
       jour, jamais avant: voir le commentaire de la méthode. */
    await this.cancelSupersededSubscription(
      client.stripeSubscriptionId,
      nextSubscriptionId,
      client.businessName,
    );

    // Même raison qu'à la conversion: un client qui monte d'offre depuis un
    // essai devient payant, et devait déjà repartir sans sa ligne dédiée.
    await this.provisionLineAfterPayment(clientId, client.businessName);

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
    period: BillingPeriod = 'monthly',
    /* La langue du site: portée par la session, relue par le webhook qui crée
       le client. Sans elle, l'agent naissait en anglais pour tout le monde. */
    language: string | null = null,
    /* L'option Superagent, achetée EN MÊME TEMPS que le forfait. C'est le
       « activable à l'achat »: elle entre dans la même caisse, donc dans le
       même abonnement et la même facture, plutôt que dans un second passage
       que personne ne fait. */
    withSuperagent = false,
  ): Promise<string | null> {
    const plan = getPlan(planType);
    const priceId = await this.resolvePriceId(planType, period);
    if (!priceId) throw new Error(`No Stripe price configured for plan: ${planType}`);
    await this.assertPriceMatchesPlan(priceId, plan, period);
    const optionItems = await this.optionLineItems(plan.id, period, withSuperagent);

    const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }, ...optionItems],
      subscription_data: { trial_period_days: plan.trialDays, metadata: { billingPeriod: period } },
      payment_method_collection: 'always',
      /* Le champ code promo à la caisse.
         Deux usages, et le second est la raison de l'écrire aujourd'hui: une
         remise commerciale sur un prospect, et un compte de test qui suit le
         VRAI parcours sans qu'un euro bouge. Un coupon à 100 % vaut mieux
         qu'un prix à 0 € créé pour l'occasion: il ne vit que sur ce client-là,
         il expire, et il ne peut pas être choisi par quelqu'un d'autre dans la
         liste des tarifs.
         Le parcours reste identique en tout point: même caisse, mêmes
         webhooks, même conversion, même attribution de ligne. C'est ce qui en
         fait un test et pas une imitation. */
      allow_promotion_codes: true,
      success_url: `${frontendUrl}/onboard?payment=success`,
      cancel_url: `${frontendUrl}/subscribe?payment=cancelled`,
      client_reference_id: user.id,
      metadata: {
        source: 'self-onboarding',
        userId: user.id,
        planType: plan.id,
        // Repris par le webhook pour retenir la période choisie: sans ça, un
        // abonnement annuel serait indiscernable d'un mensuel côté Qwillio.
        billingPeriod: period,
        businessName,
        industry: industry || 'other',
        ...(language ? { language } : {}),
        /* Ce qui a RÉELLEMENT été mis dans la caisse, pas ce qui a été demandé:
           `optionLineItems` rend une liste vide quand l'option n'est pas
           vendable, et le webhook doit accorder le droit sur ce qui est facturé.
           Une métadonnée qui dit « oui » sur une ligne absente, c'est un moteur
           servi gratuitement, pour toujours. */
        superagent: optionItems.length ? 'on' : 'off',
      },
    });

    logger.info(`Self-onboarding checkout created for ${user.email} — plan ${plan.id}, trial ${plan.trialDays}d`);
    return session.url;
  }

  async createUpgradeCheckout(
    client: any,
    planType: string,
    requestedPeriod?: BillingPeriod,
  ): Promise<string | null> {
    /* Un client déjà annuel qui change de forfait RESTE annuel. Résoudre le
       prix en mensuel d'office le ferait basculer sans rien lui demander, et
       lui ferait perdre sa remise au passage.
       Mais la période stockée ne peut pas être le dernier mot: sans choix
       possible, un client mensuel n'avait AUCUN chemin vers l'annuel, dans un
       produit qui vend l'annuel sur sa page tarifs. Le choix explicite gagne
       donc, et son absence retombe sur ce que le client a déjà. */
    const stored: BillingPeriod = client.vapiConfig?.billingPeriod === 'annual' ? 'annual' : 'monthly';
    const period: BillingPeriod = requestedPeriod ?? stored;
    const priceId = await this.resolvePriceId(planType, period);
    if (!priceId) throw new Error(`No Stripe price configured for plan: ${planType}`);
    await this.assertPriceMatchesPlan(priceId, getPlan(planType), period);

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
      /* La ligne d'option ne suit pas le forfait toute seule: le bloc ci-dessus
         ne remplace que la ligne de forfait. Sans cette réconciliation, monter
         vers Pro laisse le client payer 20 €/mois pour ce que son abonnement
         inclut désormais. `customer.subscription.updated` écrira ensuite le
         droit depuis les lignes réelles. */
      await this.reconcileSuperagentOptionForPlan(client, planType);
      await discordService.notify(
        `🔄 PLAN UPGRADED (inline)\n\nClient: ${client.businessName}\nNew plan: ${planType.toUpperCase()}\nPrev plan: ${client.planType.toUpperCase()}`
      );
      logger.info(`Inline plan upgrade: ${client.businessName} → ${planType}`);
      return null;
    }

    // Trial or no subscription → Stripe Checkout session
    /* Cette caisse crée un NOUVEL abonnement et remplace l'ancien (6undecies).
       L'option, elle, vivait sur l'ancien: sans la reporter ici, un client qui
       l'a payée la perdrait au premier changement de forfait, en silence, avec
       un droit qui resterait ouvert en base jusqu'au premier webhook. Elle ne
       part évidemment pas vers un forfait qui l'inclut déjà. */
    const carryOption = client.superagentOption === true && !planAllows(planType, 'superagent');
    const upgradeOptionItems = await this.optionLineItems(planType, period, carryOption);

    const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(client.stripeCustomerId ? { customer: client.stripeCustomerId } : {}),
      line_items: [{ price: priceId, quantity: 1 }, ...upgradeOptionItems],
      // Même raison qu'à l'inscription: c'est CE passage en caisse qui
      // déclenche la conversion d'un essai en client payant.
      allow_promotion_codes: true,
      success_url: `${frontendUrl}/dashboard/billing?payment=success`,
      cancel_url: `${frontendUrl}/dashboard/billing`,
      metadata: {
        source: 'plan-upgrade',
        clientId: client.id,
        planType,
        // Ce que la caisse porte vraiment, comme à l'inscription.
        superagent: upgradeOptionItems.length ? 'on' : 'off',
      },
      client_reference_id: client.id,
    });

    return session.url;
  }

  /**
   * Le portail de facturation Stripe, pour que le client gère SA carte.
   *
   * Le portail est hébergé par Stripe, et c'est tout l'intérêt: changer une
   * carte veut dire saisir un numéro de carte, donc entrer dans le périmètre
   * PCI. En redirigeant vers Stripe, aucun numéro ne touche jamais nos pages
   * ni nos serveurs. Reconstruire un formulaire de carte côté Qwillio serait
   * la seule vraie mauvaise réponse à ce besoin.
   *
   * Renvoie `null` quand le client n'a pas de `stripeCustomerId`: c'est le cas
   * d'un compte créé à la main ou d'un essai jamais passé par Stripe. Il n'y a
   * alors aucun moyen de paiement à gérer, et l'appelant doit le dire plutôt
   * que d'ouvrir un portail vide.
   */
  async createBillingPortalSession(client: { stripeCustomerId: string | null }): Promise<string | null> {
    if (!client.stripeCustomerId) return null;

    /* Même découpe que les autres redirections: `FRONTEND_URL` peut contenir
       plusieurs origines séparées par des virgules, et Stripe refuse une URL
       de retour qui en contiendrait deux. */
    const frontendUrl = env.FRONTEND_URL.split(',')[0].trim();

    /* La configuration n'est envoyée QUE si elle est renseignée. Vide, Stripe
       applique celle par défaut du compte — le comportement historique, qui
       marche dès que le portail est activé. Renseignée, elle épingle celle
       qu'on a réglée, pour qu'une seconde configuration créée plus tard ne
       change pas le portail en silence. */
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard/billing`,
      ...(env.STRIPE_PORTAL_CONFIGURATION_ID
        ? { configuration: env.STRIPE_PORTAL_CONFIGURATION_ID }
        : {}),
    });

    return session.url;
  }

  /**
   * Résilier l'abonnement, CHEZ STRIPE.
   *
   * `POST /my-dashboard/cancel` ne faisait que basculer `subscriptionStatus`
   * en base. Le client lisait « Résilié », et Stripe continuait de prélever le
   * mois suivant: la pire panne possible, parce qu'elle est invisible des deux
   * côtés jusqu'au relevé bancaire, et qu'elle se termine en litige.
   *
   * `cancel_at_period_end` et non une suppression immédiate: le mois est payé,
   * il est dû. Le client garde sa réceptionniste jusqu'au terme, ce que dit
   * d'ailleurs la page de facturation.
   *
   * `immediately` existe pour un seul appelant, la suppression de compte: on
   * ne peut pas laisser courir un abonnement dont plus personne ne possède le
   * compte.
   *
   * Renvoie la date de fin quand Stripe la donne, `null` quand il n'y a rien à
   * résilier (compte créé à la main, essai jamais passé par Stripe). L'appelant
   * doit savoir faire la différence entre « annulé » et « il n'y avait rien ».
   */
  async cancelSubscription(
    client: { id: string; stripeSubscriptionId: string | null },
    opts: { immediately?: boolean } = {},
  ): Promise<{ cancelled: boolean; endsAt: Date | null }> {
    if (!client.stripeSubscriptionId) return { cancelled: false, endsAt: null };

    try {
      const sub = opts.immediately
        ? await stripe.subscriptions.cancel(client.stripeSubscriptionId)
        : await stripe.subscriptions.update(client.stripeSubscriptionId, { cancel_at_period_end: true });

      /* `current_period_end` est en secondes. Absent sur un abonnement déjà
         terminé, d'où le repli sur `null` plutôt qu'une date de 1970. */
      const end = (sub as any).current_period_end;
      return { cancelled: true, endsAt: end ? new Date(end * 1000) : null };
    } catch (error: any) {
      /* Un abonnement déjà annulé chez Stripe n'est pas une erreur pour nous:
         l'état voulu est atteint. Tout le reste remonte, parce qu'une
         résiliation qu'on croit faite et qui ne l'est pas est exactement le
         défaut qu'on corrige ici. */
      if (error?.code === 'resource_missing') {
        logger.warn(`[CANCEL] Abonnement ${client.stripeSubscriptionId} introuvable chez Stripe`);
        return { cancelled: false, endsAt: null };
      }
      throw error;
    }
  }

  /**
   * L'adresse de la facture hébergée par Stripe, pour un paiement donné.
   *
   * Le portail proposait un lien « PDF » vers `/api/invoices/:id/pdf`, une route
   * qui n'existe pas: chaque ligne de l'historique portait donc un 404. Stripe
   * héberge déjà la facture et son PDF, et c'est la seule version qui fasse foi
   * comptablement; on renvoie donc la sienne plutôt que d'en imprimer une.
   */
  async getInvoiceUrl(stripeInvoiceId: string): Promise<string | null> {
    const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
    return invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null;
  }

  // Optional manual override per plan (kept for backward compat). When set, it
  // wins over auto-provisioning so the founder can still pin a specific Price.
  /* Prix VÉRIFIÉS pendant la vie du processus: une fois par identifiant suffit,
     un prix Stripe ne change pas sous nos pieds. */
  private verifiedPrices = new Set<string>();

  /**
   * Le prix facturé doit être celui que le site annonce.
   *
   * Ce sont DEUX objets sans lien: `config/plans.ts` décide de ce qui s'affiche,
   * un objet Price chez Stripe décide de ce qui est prélevé. Rien ne les tenait
   * ensemble, et `STRIPE_PRICE_<PLAN>_MONTHLY` court-circuite même le tarif du
   * code sans rien vérifier. Le 09/09, la caisse annonçait « Qwillio Pro,
   * 1297,00 € par mois » sous une page qui affichait 599 €: la variable
   * d'environnement pointait un prix d'une tarification précédente.
   *
   * Un client aurait signé pour 599 et payé 1297. Ce n'est pas un défaut
   * d'affichage, c'est le mauvais montant sur une vraie carte, et personne ne
   * l'aurait vu avant le premier relevé.
   *
   * On REFUSE donc d'ouvrir la caisse plutôt que de facturer un montant que la
   * page n'a pas annoncé. Une inscription bloquée se répare en une minute
   * (corriger la variable), un prélèvement de trop se répare en remboursement,
   * en excuse, et en confiance perdue.
   */
  private async assertPriceMatchesPlan(
    priceId: string,
    plan: Plan,
    period: BillingPeriod,
  ): Promise<void> {
    if (this.verifiedPrices.has(priceId)) return;

    const attendu = Math.round((period === 'annual' ? annualPriceEur(plan) : plan.monthlyPriceEur) * 100);
    const intervalleAttendu = period === 'annual' ? 'year' : 'month';

    const price = await stripe.prices.retrieve(priceId);
    const ecarts: string[] = [];
    if (price.unit_amount !== attendu) {
      ecarts.push(`montant ${(price.unit_amount ?? 0) / 100} € au lieu de ${attendu / 100} €`);
    }
    if (price.currency !== 'eur') {
      ecarts.push(`devise ${price.currency} au lieu de eur`);
    }
    if (price.recurring?.interval !== intervalleAttendu) {
      ecarts.push(`période ${price.recurring?.interval ?? 'aucune'} au lieu de ${intervalleAttendu}`);
    }

    if (!ecarts.length) {
      this.verifiedPrices.add(priceId);
      return;
    }

    const message =
      `Le prix Stripe ${priceId} ne correspond pas au plan ${plan.id} (${period}): ${ecarts.join(', ')}.`;
    logger.error(`[Stripe] ${message}`);
    await discordService.notify(
      `🚨 TARIF INCOHÉRENT\n\n${message}\n\n` +
        `La caisse est REFUSÉE tant que ce n'est pas corrigé: un client paierait un montant ` +
        `que la page ne lui a pas annoncé.\n` +
        `Corriger \`${plan.stripePriceEnv}\` sur Render, ou la retirer pour que le prix soit ` +
        `créé depuis config/plans.ts.`,
    );
    throw new Error(message);
  }

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
    return this.resolvePriceId(planType, 'monthly');
  }

  /**
   * Same, for either period.
   *
   * The annual Price is created with the SAME mechanism as the monthly one,
   * from `config/plans.ts`: 12 × monthly × 0.8, charged once a year. Before
   * this, the pricing page offered an annual toggle that no Stripe Price
   * backed, so picking "annual" silently subscribed the customer monthly at
   * full rate. The env override only ever covered the monthly price, so it is
   * deliberately ignored for the annual one rather than mapped to a monthly
   * Price id, which would re-create exactly that bug.
   */
  private async resolvePriceId(planType: string, period: BillingPeriod): Promise<string> {
    const plan = getPlan(planType);
    const planId = plan.id;

    if (period === 'monthly') {
      const override = this.envPriceOverride(planId);
      if (override) return override;
    }

    const cacheKey = `${planId}_${period}`;
    const cached = this.priceIdCache.get(cacheKey);
    if (cached) return cached;

    const lookupKey = `qwillio_${planId}_${period}_eur`;

    // 1. Reuse an existing Price with our lookup key (created on a prior boot).
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (existing.data[0]?.id) {
      this.priceIdCache.set(cacheKey, existing.data[0].id);
      return existing.data[0].id;
    }

    // 2. Otherwise create it from the plan definition (EUR).
    const amountEur = period === 'annual' ? annualPriceEur(plan) : plan.monthlyPriceEur;
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(amountEur * 100),
      recurring: { interval: period === 'annual' ? 'year' : 'month' },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      product_data: { name: `Qwillio ${plan.name}` },
    });
    this.priceIdCache.set(cacheKey, price.id);
    /* Créé À L'INSTANT depuis `config/plans.ts`: il porte le montant du plan par
       construction. Le relire chez Stripe pour le vérifier ne prouverait rien et
       coûterait un aller-retour. Ce que le garde-fou surveille, c'est l'autre
       chemin: un identifiant posé en variable d'environnement, ou un prix
       retrouvé par clé de recherche et créé sous une tarification précédente. */
    this.verifiedPrices.add(price.id);
    logger.info(
      `Auto-created Stripe Price ${price.id} for plan ${planId} (${amountEur}€/${period === 'annual' ? 'an' : 'mo'})`
    );
    return price.id;
  }
}

export const stripeService = new StripeService();
