import { resend } from '../config/resend';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { PACKAGES } from '../types';
import { formatDate } from '../utils/helpers';
import { brandWrap, brandTitle, brandText, brandButton, brandList, brandSmall, brandLink } from './email-template';
import {
  brandHighlight,
  renderQuoteTemplate, renderFollowUpTemplate, renderWelcomeTemplate,
  renderTrialWelcomeTemplate, renderTrialEndingTemplate, renderTrialExpiredTemplate,
  renderCallback3MonthsTemplate, renderBookingReminderTemplate, renderRescheduleTemplate,
  renderPasswordResetTemplate,
  type Lang,
} from './email-renderers';

/** Default to French — the Quebec-first launch audience. */
function L(lang?: Lang): Lang {
  return lang === 'en' ? 'en' : 'fr';
}

export class EmailService {
  /**
   * Generate unsubscribe link for a given email address
   */
  private getUnsubscribeUrl(email: string): string {
    const token = Buffer.from(email).toString('base64url');
    return `${env.API_BASE_URL}/api/unsubscribe/${token}`;
  }

  /**
   * Inject unsubscribe link into rendered HTML (before closing </body>)
   */
  private injectUnsubscribeLink(html: string, email: string): string {
    const url = this.getUnsubscribeUrl(email);
    const footer = `<div style="text-align:center;padding:10px 0;"><a href="${url}" style="color:#999;font-size:11px;text-decoration:underline;">Unsubscribe</a></div>`;
    return html.replace('</body>', `${footer}</body>`);
  }

  async sendQuoteEmail(data: {
    to: string;
    contactName: string;
    businessName: string;
    packageType: string;
    setupPrice: number;
    monthlyPrice: number;
    features: string[];
    validUntil: Date;
    paymentLink: string;
    quoteId: string;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const rawHtml = renderQuoteTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? `Votre devis Qwillio - ${data.businessName}` : `Your Qwillio Quote - ${data.businessName}`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        headers: { 'List-Unsubscribe': `<${this.getUnsubscribeUrl(data.to)}>` },
        tags: [
          { name: 'campaign', value: 'quote' },
          { name: 'package', value: data.packageType },
        ],
      });

      logger.info(`Quote email sent to ${data.to} (ID: ${result.data?.id})`);
      return result;
    } catch (error) {
      logger.error('Failed to send quote email:', error);
      throw error;
    }
  }

  async sendFollowUpEmail(data: {
    to: string;
    contactName: string;
    businessName: string;
    packageName: string;
    monthlyPrice: number;
    setupPrice: number;
    paymentLink: string;
    type: 'day1' | 'day3' | 'day7';
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const rawHtml = renderFollowUpTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);
    const subjects: Record<string, string> = lang === 'fr'
      ? {
          day1: `${data.contactName}, votre proposition est toujours disponible`,
          day3: `Plus que 4 jours pour votre offre Qwillio - ${data.businessName}`,
          day7: `DERNIÈRE CHANCE - Votre offre expire aujourd'hui !`,
        }
      : {
          day1: `${data.contactName}, your proposal is still available`,
          day3: `Only 4 days left for your Qwillio offer - ${data.businessName}`,
          day7: `LAST CHANCE - Your offer expires today!`,
        };

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: subjects[data.type],
        html,
        replyTo: env.RESEND_REPLY_TO,
        headers: { 'List-Unsubscribe': `<${this.getUnsubscribeUrl(data.to)}>` },
        tags: [
          { name: 'campaign', value: `followup_${data.type}` },
        ],
      });

      logger.info(`Follow-up ${data.type} email sent to ${data.to}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send follow-up ${data.type} email:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(data: {
    to: string;
    contactName: string;
    businessName: string;
    planType: string;
    vapiPhoneNumber: string;
    dashboardUrl: string;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const rawHtml = renderWelcomeTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? `Bienvenue chez Qwillio - ${data.businessName} !` : `Welcome to Qwillio - ${data.businessName}!`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'welcome' }],
      });

      logger.info(`Welcome email sent to ${data.to}`);
      return result;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  async sendTrialWelcomeEmail(data: {
    to: string;
    contactName: string;
    businessName: string;
    packageType: string;
    trialEndDate: Date;
    trialCallsQuota: number;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const rawHtml = renderTrialWelcomeTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? `Votre essai gratuit Qwillio est actif - ${data.businessName} !` : `Your free Qwillio trial is active - ${data.businessName}!`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [
          { name: 'campaign', value: 'trial_welcome' },
          { name: 'package', value: data.packageType },
        ],
      });

      logger.info(`Trial welcome email sent to ${data.to} (ID: ${result.data?.id})`);
      return result;
    } catch (error) {
      logger.error('Failed to send trial welcome email:', error);
      throw error;
    }
  }

  async sendTrialEndingEmail(data: {
    to: string;
    contactName: string;
    businessName: string;
    packageType: string;
    daysLeft: number;
    trialEndDate: Date;
    paymentLink: string;
    monthlyPrice: number;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const rawHtml = renderTrialEndingTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);
    const subjects: Record<number, string> = lang === 'fr'
      ? {
          7: `${data.contactName}, plus que 7 jours d'essai gratuit !`,
          1: `DEMAIN votre essai gratuit se termine - ${data.businessName}`,
        }
      : {
          7: `${data.contactName}, only 7 days left in your free trial!`,
          1: `TOMORROW your free trial ends - ${data.businessName}`,
        };

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: subjects[data.daysLeft] || (lang === 'fr' ? `Votre essai gratuit se termine bientôt` : `Your free trial is ending soon`),
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [
          { name: 'campaign', value: `trial_ending_${data.daysLeft}d` },
        ],
      });

      logger.info(`Trial ending (${data.daysLeft}d) email sent to ${data.to}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send trial ending email:`, error);
      throw error;
    }
  }

  async sendTrialExpiredEmail(data: {
    to: string;
    contactName: string;
    businessName: string;
    packageType: string;
    paymentLink: string;
    monthlyPrice: number;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const rawHtml = renderTrialExpiredTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? `Votre essai gratuit est terminé - ${data.businessName}` : `Your free trial has ended - ${data.businessName}`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [
          { name: 'campaign', value: 'trial_expired' },
        ],
      });

      logger.info(`Trial expired email sent to ${data.to}`);
      return result;
    } catch (error) {
      logger.error('Failed to send trial expired email:', error);
      throw error;
    }
  }

  async sendCallback3MonthsEmail(data: {
    to: string;
    contactName: string;
    businessName: string;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const rawHtml = renderCallback3MonthsTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? `${data.contactName}, ça fait un moment ! Des nouvelles de Qwillio` : `${data.contactName}, it's been a while! News from Qwillio`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'callback_3months' }],
      });

      logger.info(`3-month callback email sent to ${data.to}`);
      return result;
    } catch (error) {
      logger.error('Failed to send 3-month callback email:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ONBOARDING EMAIL - Welcome + form link + dashboard link
  // ═══════════════════════════════════════════════════════════
  async sendOnboardingEmail(data: {
    to: string; contactName: string; businessName: string; businessType: string;
    planType: string; isTrial: boolean; trialEndDate: Date | null;
    formUrl: string; dashboardUrl: string; vapiPhoneNumber: string;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const pkg = PACKAGES[data.planType] || PACKAGES.basic;
    const html = lang === 'fr'
      ? (() => {
          const planLabel = data.isTrial ? 'essai gratuit de 30 jours' : `forfait ${pkg.name}`;
          return brandWrap({
            title: 'Configurez votre réceptionniste IA',
            preheader: `Votre ${planLabel} pour ${data.businessName} est maintenant actif.`,
            body: [
              brandTitle('Bienvenue chez Qwillio'),
              brandText(`Bonjour ${data.contactName}, votre <strong>${planLabel}</strong> pour <strong>${data.businessName}</strong> est maintenant actif.`),
              brandHighlight('Votre numéro IA', data.vapiPhoneNumber, 22),
              brandText('Trois étapes rapides :'),
              brandList([
                '<strong>Complétez votre formulaire de configuration</strong> (5 min) pour que votre IA réponde avec précision.',
                `<strong>Testez-la.</strong> Appelez le ${data.vapiPhoneNumber} pour écouter votre IA en action.`,
                `<strong>Ouvrez votre tableau de bord</strong> sur ${brandLink('votre tableau de bord', data.dashboardUrl)} pour suivre vos appels et ajuster les réglages.`,
              ]),
              brandButton('Compléter le formulaire', data.formUrl),
              data.isTrial && data.trialEndDate
                ? brandSmall(`Votre essai gratuit se termine le <strong>${formatDate(data.trialEndDate, 'fr')}</strong>. Aucun paiement avant.`)
                : '',
              brandSmall('Après la configuration, vous recevrez une vidéo de présentation personnalisée. — L\'équipe Qwillio'),
            ].join(''),
          });
        })()
      : (() => {
          const planLabel = data.isTrial ? '30-day free trial' : `${pkg.name} plan`;
          return brandWrap({
            title: 'Set up your AI receptionist',
            preheader: `Your ${planLabel} for ${data.businessName} is now active.`,
            body: [
              brandTitle('Welcome to Qwillio'),
              brandText(`Hi ${data.contactName}, your <strong>${planLabel}</strong> for <strong>${data.businessName}</strong> is now active.`),
              brandHighlight('Your AI phone number', data.vapiPhoneNumber, 22),
              brandText('Three quick steps:'),
              brandList([
                '<strong>Complete your setup form</strong> (5 min) so your AI can answer accurately.',
                `<strong>Test it.</strong> Call ${data.vapiPhoneNumber} to hear your AI in action.`,
                `<strong>Open your dashboard</strong> at ${brandLink('your dashboard', data.dashboardUrl)} to track calls and tweak settings.`,
              ]),
              brandButton('Complete setup form', data.formUrl),
              data.isTrial && data.trialEndDate
                ? brandSmall(`Your free trial ends on <strong>${formatDate(data.trialEndDate, 'en')}</strong>. No payment until then.`)
                : '',
              brandSmall('After setup, you will receive a personalized walkthrough video. — The Qwillio Team'),
            ].join(''),
          });
        })();
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: lang === 'fr'
          ? `Bienvenue chez Qwillio - configurons votre réceptionniste IA pour ${data.businessName}`
          : `Welcome to Qwillio - let's set up your AI receptionist for ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'onboarding_welcome' }],
      });
      logger.info(`Onboarding email sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send onboarding email:', error); throw error; }
  }

  // ═══════════════════════════════════════════════════════════
  // LOOM VIDEO EMAIL - After onboarding form completed
  // ═══════════════════════════════════════════════════════════
  async sendLoomVideoEmail(data: { to: string; contactName: string; businessName: string; dashboardUrl: string; lang?: Lang; }) {
    const lang = L(data.lang);
    const html = lang === 'fr'
      ? brandWrap({
          title: 'Votre configuration est terminée',
          preheader: 'Votre réceptionniste IA est entièrement personnalisée.',
          body: [
            brandTitle('Votre configuration est terminée'),
            brandText(`Bonjour ${data.contactName}, votre réceptionniste IA pour <strong>${data.businessName}</strong> est maintenant entièrement configurée avec les informations de votre entreprise.`),
            brandButton('Ouvrir mon tableau de bord', data.dashboardUrl),
            brandText("Un membre de l'équipe enregistre une vidéo de présentation personnalisée — vous la recevrez sous 24 heures."),
            brandText('Votre IA connaît désormais :'),
            brandList([
              'Vos horaires et votre emplacement',
              'Vos services, tarifs et FAQ',
              'Vos protocoles de réservation',
              'La gestion des appels urgents',
              'Les spécificités de votre secteur',
            ]),
            brandSmall('— L\'équipe Qwillio'),
          ].join(''),
        })
      : brandWrap({
          title: 'Your setup is complete',
          preheader: 'Your AI receptionist is fully personalized.',
          body: [
            brandTitle('Your setup is complete'),
            brandText(`Hi ${data.contactName}, your AI receptionist for <strong>${data.businessName}</strong> is now fully configured with your business information.`),
            brandButton('Open my dashboard', data.dashboardUrl),
            brandText("A teammate is recording a personalized walkthrough video — you'll receive it within 24 hours."),
            brandText('Your AI now knows:'),
            brandList([
              'Business hours & location',
              'Services, pricing and FAQ',
              'Booking protocols',
              'Urgent call handling',
              'Industry-specific knowledge',
            ]),
            brandSmall('— The Qwillio Team'),
          ].join(''),
        });
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: lang === 'fr' ? `Votre réceptionniste IA est prête - ${data.businessName}` : `Your AI receptionist is ready - ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'loom_video' }],
      });
      logger.info(`Loom video email sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send Loom video email:', error); }
  }

  // ═══════════════════════════════════════════════════════════
  // TRIAL END INVOICE - Stats + invoice + payment link
  // ═══════════════════════════════════════════════════════════
  async sendTrialEndInvoiceEmail(data: {
    to: string; contactName: string; businessName: string; planType: string;
    packageName: string; monthlyPrice: number; setupPrice: number;
    paymentLink: string; dashboardUrl: string;
    trialStats: { totalCalls: number; totalBookings: number; totalLeads: number };
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const total = data.monthlyPrice + data.setupPrice;
    const html = lang === 'fr'
      ? brandWrap({
          title: 'Vos résultats d\'essai et votre facture',
          preheader: `Bilan de 30 jours pour ${data.businessName} + premier paiement.`,
          body: [
            brandTitle('Vos résultats d\'essai'),
            brandText(`Bonjour ${data.contactName}, votre essai de 30 jours pour <strong>${data.businessName}</strong> est terminé. Voici ce que votre IA a accompli :`),
            brandList([
              `<strong>${data.trialStats.totalCalls}</strong> appels traités`,
              `<strong>${data.trialStats.totalBookings}</strong> rendez-vous créés`,
              `<strong>${data.trialStats.totalLeads}</strong> leads captés`,
            ]),
            brandText(`Facture pour le forfait <strong>${data.packageName}</strong> :`),
            brandList([
              `Abonnement mensuel — <strong>${data.monthlyPrice} $/mois</strong>`,
              `Frais d'installation unique — <strong>${data.setupPrice} $</strong>`,
            ]),
            brandHighlight('Premier paiement', `${total} $`, 28),
            brandButton('M\'abonner et garder mon IA', data.paymentLink),
            brandSmall('Sans paiement sous 7 jours, votre réceptionniste IA et l\'accès au tableau de bord seront désactivés. — Marie, Qwillio'),
          ].join(''),
        })
      : brandWrap({
          title: 'Your trial results & invoice',
          preheader: `30-day recap for ${data.businessName} + first payment.`,
          body: [
            brandTitle('Your trial results'),
            brandText(`Hi ${data.contactName}, your 30-day trial for <strong>${data.businessName}</strong> has ended. Here is what your AI accomplished:`),
            brandList([
              `<strong>${data.trialStats.totalCalls}</strong> calls handled`,
              `<strong>${data.trialStats.totalBookings}</strong> bookings created`,
              `<strong>${data.trialStats.totalLeads}</strong> leads captured`,
            ]),
            brandText(`Invoice for the <strong>${data.packageName}</strong> plan:`),
            brandList([
              `Monthly subscription — <strong>$${data.monthlyPrice}/mo</strong>`,
              `One-time setup fee — <strong>$${data.setupPrice}</strong>`,
            ]),
            brandHighlight('First payment', `$${total}`, 28),
            brandButton('Subscribe & keep my AI', data.paymentLink),
            brandSmall('Without payment within 7 days, your AI receptionist and dashboard access will be deactivated. — Ashley, Qwillio'),
          ].join(''),
        });
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: lang === 'fr' ? `Résultats d'essai + facture - ${data.businessName}` : `Trial results + invoice - ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'trial_end_invoice' }],
      });
      logger.info(`Trial end invoice sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send trial end invoice:', error); throw error; }
  }

  // ═══════════════════════════════════════════════════════════
  // ACCOUNT DEACTIVATED EMAIL - 7 days no payment
  // ═══════════════════════════════════════════════════════════
  async sendAccountDeactivatedEmail(data: { to: string; contactName: string; businessName: string; lang?: Lang; }) {
    const lang = L(data.lang);
    const reactivateMail = `mailto:${env.RESEND_REPLY_TO}?subject=${lang === 'fr' ? 'Reactivation' : 'Reactivate'}%20${encodeURIComponent(data.businessName)}`;
    const html = lang === 'fr'
      ? brandWrap({
          title: 'Compte désactivé',
          preheader: `Votre compte Qwillio pour ${data.businessName} a été désactivé.`,
          body: [
            brandTitle('Compte désactivé'),
            brandText(`Bonjour ${data.contactName}, votre réceptionniste IA Qwillio pour <strong>${data.businessName}</strong> a été désactivée pour défaut de paiement.`),
            brandText('Ce que cela signifie :'),
            brandList([
              'Réceptionniste IA arrêtée',
              'Accès au tableau de bord révoqué',
              'Rappels et analyses en pause',
            ]),
            brandButton('Nous contacter pour réactiver', reactivateMail),
            brandSmall('Votre configuration est conservée 30 jours, puis supprimée définitivement. — Marie, Qwillio'),
          ].join(''),
        })
      : brandWrap({
          title: 'Account deactivated',
          preheader: `Your Qwillio account for ${data.businessName} has been deactivated.`,
          body: [
            brandTitle('Account deactivated'),
            brandText(`Hi ${data.contactName}, your Qwillio AI receptionist for <strong>${data.businessName}</strong> has been deactivated due to non-payment.`),
            brandText('What this means:'),
            brandList([
              'AI receptionist stopped',
              'Dashboard access revoked',
              'Reminders & analytics paused',
            ]),
            brandButton('Contact us to reactivate', reactivateMail),
            brandSmall('Your configuration is saved for 30 days, then permanently deleted. — Ashley, Qwillio'),
          ].join(''),
        });
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: lang === 'fr' ? `Compte désactivé - ${data.businessName}` : `Account deactivated - ${data.businessName}`,
        html, tags: [{ name: 'campaign', value: 'account_deactivated' }],
      });
    } catch (error) { logger.error('Failed to send deactivation email:', error); }
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT LINK AFTER CONTRACT SIGNATURE
  // ═══════════════════════════════════════════════════════════
  async sendPaymentLinkAfterSignature(data: {
    to: string;
    contactName: string;
    businessName: string;
    packageType: string;
    setupFee: number;
    monthlyFee: number;
    paymentLink: string;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const total = data.setupFee + data.monthlyFee;
    const html = lang === 'fr'
      ? brandWrap({
          title: 'Contrat signé',
          preheader: `Une dernière étape pour activer ${data.businessName}.`,
          body: [
            brandTitle('Contrat signé'),
            brandText(`Bonjour ${data.contactName}, votre entente de service pour <strong>${data.businessName}</strong> a été signée. Une dernière étape — complétez le paiement pour activer votre réceptionniste IA immédiatement.`),
            brandText('Votre forfait :'),
            brandList([
              `Forfait <strong>${data.packageType.toUpperCase()}</strong>`,
              `Frais d'installation — <strong>${data.setupFee.toLocaleString()} $</strong>`,
              `Mensuel — <strong>${data.monthlyFee} $/mois</strong>`,
            ]),
            brandHighlight('Premier paiement', `${total.toLocaleString()} $`, 28),
            brandButton('Compléter le paiement', data.paymentLink),
            brandSmall("Dès réception du paiement, nous configurons votre réceptionniste IA et vous envoyons vos détails d'intégration en quelques minutes. — L'équipe Qwillio"),
          ].join(''),
        })
      : brandWrap({
          title: 'Contract signed',
          preheader: `One last step to activate ${data.businessName}.`,
          body: [
            brandTitle('Contract signed'),
            brandText(`Hi ${data.contactName}, your service agreement for <strong>${data.businessName}</strong> has been signed. One last step — complete payment to activate your AI receptionist immediately.`),
            brandText('Your plan:'),
            brandList([
              `<strong>${data.packageType.toUpperCase()}</strong> package`,
              `Setup fee — <strong>$${data.setupFee.toLocaleString()}</strong>`,
              `Monthly — <strong>$${data.monthlyFee}/mo</strong>`,
            ]),
            brandHighlight('First payment', `$${total.toLocaleString()}`, 28),
            brandButton('Complete payment', data.paymentLink),
            brandSmall("Once payment clears, we'll set up your AI receptionist and email your onboarding details within minutes. — The Qwillio Team"),
          ].join(''),
        });
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: lang === 'fr' ? `Contrat signé — complétez votre configuration pour ${data.businessName}` : `Contract signed — complete your setup for ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'contract_signed_payment' }],
      });
      logger.info(`Payment link after signature email sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send payment link after signature email:', error); }
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT FAILED EMAIL - Notify client to update payment
  // ═══════════════════════════════════════════════════════════
  async sendPaymentFailedEmail(data: { to: string; contactName: string; businessName: string; amount: number; paymentLink?: string | null; lang?: Lang; }) {
    const lang = L(data.lang);
    const html = lang === 'fr'
      ? brandWrap({
          title: 'Problème de paiement',
          preheader: `Mettez à jour votre moyen de paiement pour garder ${data.businessName} actif.`,
          body: [
            brandTitle('Problème de paiement'),
            brandText(`Bonjour ${data.contactName}, nous n'avons pas pu traiter votre paiement de <strong>${data.amount} $</strong> pour ${data.businessName}.`),
            data.paymentLink ? brandButton('Mettre à jour le paiement', data.paymentLink) : '',
            brandText('Votre réceptionniste IA est encore active, mais nous avons besoin que vous mettiez à jour votre moyen de paiement pour éviter toute interruption de service.'),
            !data.paymentLink
              ? brandText('Stripe réessaiera automatiquement le paiement dans quelques jours. Pour mettre à jour votre carte maintenant, répondez à ce courriel et nous vous enverrons un lien sécurisé.')
              : '',
            brandText('Raisons fréquentes d\'un paiement refusé :'),
            brandList(['Carte expirée', 'Fonds insuffisants', 'Carte bloquée par votre banque', 'Adresse de facturation périmée']),
            brandSmall('— L\'équipe Qwillio'),
          ].join(''),
        })
      : brandWrap({
          title: 'Payment issue',
          preheader: `Update your payment method to keep ${data.businessName} active.`,
          body: [
            brandTitle('Payment issue'),
            brandText(`Hi ${data.contactName}, we were unable to process your payment of <strong>$${data.amount}</strong> for ${data.businessName}.`),
            data.paymentLink
              ? brandButton('Update payment method', data.paymentLink)
              : '',
            brandText('Your AI receptionist is still active, but we need you to update your payment method to avoid any service interruption.'),
            !data.paymentLink
              ? brandText('Stripe will automatically retry the payment in a few days. If you\'d like to update your card now, reply to this email and we\'ll send a secure link.')
              : '',
            brandText('Common reasons for failed payments:'),
            brandList(['Expired credit card', 'Insufficient funds', 'Card blocked by your bank', 'Outdated billing address']),
            brandSmall('— The Qwillio Team'),
          ].join(''),
        });
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: lang === 'fr' ? `Paiement refusé - ${data.businessName}` : `Payment failed - ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'payment_failed' }],
      });
      logger.info(`Payment failed email sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send payment failed email:', error); }
  }

  // ═══════════════════════════════════════════════════════════
  // BOOKING REMINDER EMAIL - Sent 24h before appointment
  // (For the client's customers, not for our prospects)
  // ═══════════════════════════════════════════════════════════
  async sendBookingReminderEmail(data: {
    to: string;
    customerName: string;
    businessName: string;
    bookingDate: Date;
    bookingTime: string;
    serviceType: string;
    specialRequests: string | null;
    businessPhone: string;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const html = renderBookingReminderTemplate(data);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? `Rappel : votre rendez-vous chez ${data.businessName} demain` : `Reminder: Your appointment at ${data.businessName} tomorrow`,
        html,
        tags: [{ name: 'campaign', value: 'booking_reminder' }],
      });
      logger.info(`Booking reminder email sent to ${data.to}`);
    } catch (error) {
      logger.error(`Failed to send booking reminder to ${data.to}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RESCHEDULE EMAIL - Sent when a customer no-shows
  // ═══════════════════════════════════════════════════════════
  async sendRescheduleEmail(data: {
    to: string;
    customerName: string;
    businessName: string;
    originalDate: Date;
    businessPhone: string;
    lang?: Lang;
  }) {
    const lang = L(data.lang);
    const html = renderRescheduleTemplate(data);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? `On vous a manqué chez ${data.businessName} - Reprenons rendez-vous !` : `We missed you at ${data.businessName} - Let's reschedule!`,
        html,
        tags: [{ name: 'campaign', value: 'reschedule' }],
      });
      logger.info(`Reschedule email sent to ${data.to}`);
    } catch (error) {
      logger.error(`Failed to send reschedule email to ${data.to}:`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EMAIL CONFIRMATION — Sent 30s after call to verify address
  // ═══════════════════════════════════════════════════════════
  async sendEmailConfirmation(data: {
    to: string;
    contactName: string;
    businessName: string;
    prospectId: string;
    lang?: Lang;
  }): Promise<{ success: boolean; emailId?: string }> {
    const lang = L(data.lang);
    const demoUrl = `${env.FRONTEND_URL?.split(',')[0] || 'https://qwillio.com'}/demo.html`;
    const html = lang === 'fr'
      ? brandWrap({
          title: 'Merci pour votre échange avec Marie',
          preheader: `Votre démo Qwillio de 2 minutes pour ${data.businessName}.`,
          body: [
            brandTitle('Merci pour votre échange'),
            brandText(`Bonjour ${data.contactName || 'à vous'}, ravie d'avoir discuté de <strong>${data.businessName}</strong>. Comme promis, voici une courte démo de 2 minutes de votre réceptionniste IA en action.`),
            brandButton('Voir la démo', demoUrl),
            brandSmall(`Ceci confirme aussi que nous avons la bonne adresse — aucune action requise. Nous reviendrons vers vous bientôt avec plus de détails. — Marie, Qwillio`),
          ].join(''),
        })
      : brandWrap({
          title: 'Thanks for chatting with Ashley',
          preheader: `Your 2-minute Qwillio demo for ${data.businessName}.`,
          body: [
            brandTitle('Thanks for chatting'),
            brandText(`Hi ${data.contactName || 'there'}, great talking with you about <strong>${data.businessName}</strong>. As promised, here is a quick 2-minute demo of your AI receptionist in action.`),
            brandButton('Watch the demo', demoUrl),
            brandSmall(`This also confirms we have the right address for you — no action needed. We'll follow up with more details soon. — Ashley, Qwillio`),
          ].join(''),
        });

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr'
          ? `Merci pour votre échange, ${data.contactName || ''} ! Voici votre démo`
          : `Thanks for chatting, ${data.contactName || 'there'}! Here's your demo`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [
          { name: 'campaign', value: 'email_confirmation' },
          { name: 'prospect_id', value: data.prospectId },
        ],
      });

      logger.info(`Confirmation email sent to ${data.to} (ID: ${result.data?.id})`);
      return { success: true, emailId: result.data?.id || undefined };
    } catch (error) {
      logger.error('Failed to send confirmation email:', error);
      return { success: false };
    }
  }
  // ═══════════════════════════════════════════════════════════
  // ACCOUNT CONFIRMATION — Sent on signup to verify email
  // ═══════════════════════════════════════════════════════════
  async sendPasswordResetEmail(data: {
    to: string;
    name: string;
    resetUrl: string;
    lang?: Lang;
  }): Promise<{ success: boolean }> {
    const lang = L(data.lang);
    const firstName = (data.name || '').split(' ')[0] || data.name;
    const html = renderPasswordResetTemplate({ firstName, resetUrl: data.resetUrl, lang });
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? 'Réinitialisez votre mot de passe Qwillio' : 'Reset your Qwillio password',
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'password_reset' }],
      });
      logger.info(`Password reset email sent to ${data.to}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      return { success: false };
    }
  }

  async sendConfirmationEmail(data: {
    to: string;
    name: string;
    confirmUrl: string;
    lang?: Lang;
  }): Promise<{ success: boolean; emailId?: string }> {
    const lang = L(data.lang);
    const firstName = data.name.split(' ')[0] || data.name;

    const html = lang === 'fr'
      ? brandWrap({
          title: 'Confirmez votre compte Qwillio',
          preheader: 'Un clic pour activer votre essai gratuit.',
          body: [
            brandTitle('Confirmez votre courriel'),
            brandText(`Bonjour ${firstName}, merci de votre inscription à Qwillio. Confirmez votre courriel pour activer votre compte et démarrer votre essai gratuit.`),
            brandButton('Confirmer mon courriel', data.confirmUrl),
            brandSmall(`Ou collez ce lien dans votre navigateur :<br><span style="word-break:break-all;color:#A855F7;">${data.confirmUrl}</span>`),
            brandSmall("Si vous n'êtes pas à l'origine de ce compte, vous pouvez ignorer ce courriel."),
          ].join(''),
        })
      : brandWrap({
          title: 'Confirm your Qwillio account',
          preheader: 'One click to activate your free trial.',
          body: [
            brandTitle('Confirm your email'),
            brandText(`Hi ${firstName}, thanks for signing up for Qwillio. Confirm your email to activate your account and start your free trial.`),
            brandButton('Confirm my email', data.confirmUrl),
            brandSmall(`Or paste this link into your browser:<br><span style="word-break:break-all;color:#A855F7;">${data.confirmUrl}</span>`),
            brandSmall("If you didn't create this account, you can safely ignore this email."),
          ].join(''),
        });

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: lang === 'fr' ? 'Confirmez votre compte Qwillio' : 'Confirm your Qwillio account',
        html,
        replyTo: env.RESEND_REPLY_TO,
        tags: [
          { name: 'campaign', value: 'account_confirmation' },
        ],
      });

      logger.info(`Account confirmation email sent to ${data.to} (ID: ${result.data?.id})`);
      return { success: true, emailId: result.data?.id || undefined };
    } catch (error) {
      logger.error('Failed to send account confirmation email:', error);
      return { success: false };
    }
  }
  async sendDigestEmail(data: { to: string; contactName: string; businessName: string; totalEmails: number; urgent: number; appointment: number; payment: number; autoReplied: number; needsReview: number }) {
    const dashboardUrl = `${env.FRONTEND_URL?.split(',')[0] || 'https://qwillio.com'}/dashboard/agent/email`;
    const rawHtml = brandWrap({
      title: `${data.businessName} — Daily Email Digest`,
      preheader: `Résumé des dernières 24h pour ${data.businessName}.`,
      body: [
        brandTitle('Récap des dernières 24h'),
        brandText(`Bonjour ${data.contactName}, voici le résumé de vos emails pour <strong>${data.businessName}</strong>.`),
        brandHighlight('Emails reçus', String(data.totalEmails), 32),
        brandList([
          `<strong>${data.urgent}</strong> urgents`,
          `<strong>${data.appointment}</strong> rendez-vous`,
          `<strong>${data.payment}</strong> paiements`,
          `<strong>${data.autoReplied}</strong> traités automatiquement`,
          `<strong>${data.needsReview}</strong> en attente de votre revue`,
        ]),
        brandButton('Voir dans le dashboard', dashboardUrl),
        brandSmall('— Qwillio AI'),
      ].join(''),
    });
    const html = this.injectUnsubscribeLink(rawHtml, data.to);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `${data.businessName} — Daily Email Digest`,
        html,
        replyTo: env.RESEND_REPLY_TO,
        headers: { 'List-Unsubscribe': `<${this.getUnsubscribeUrl(data.to)}>` },
        tags: [{ name: 'campaign', value: 'digest' }],
      });
      return { success: true };
    } catch (error) {
      logger.error('Failed to send digest email:', error);
      return { success: false };
    }
  }
  async sendRegistrationInvite(data: { to: string; contactName: string; businessName: string; registrationUrl: string; recommendedPlan: string; lang?: Lang }) {
    try {
      const lang = L(data.lang);
      const planNames: Record<string, string> = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
      const planName = planNames[data.recommendedPlan] || 'Pro';
      const rawHtml = lang === 'fr'
        ? brandWrap({
            title: 'Votre réceptionniste IA est prête',
            preheader: `30 jours gratuits pour ${data.businessName} — sans carte de crédit.`,
            body: [
              brandTitle('Votre IA est prête'),
              brandText(`Bonjour ${data.contactName}, ravie de notre échange. Qwillio gère vos appels entrants 24 h/24 — répond aux questions, prend les rendez-vous et qualifie les leads pendant que vous vous concentrez sur votre entreprise.`),
              brandText(`Nous recommandons le forfait <strong>${planName}</strong> pour <strong>${data.businessName}</strong>. Vos 30 premiers jours sont entièrement gratuits — sans engagement, annulable à tout moment.`),
              brandHighlight('Essai gratuit', '30 jours', 28),
              brandButton('Démarrer mon essai gratuit', data.registrationUrl),
              brandSmall('La configuration prend moins de 5 minutes. Sans carte de crédit. — Marie, Qwillio IA'),
            ].join(''),
          })
        : brandWrap({
            title: 'Your AI receptionist is ready',
            preheader: `30 days free for ${data.businessName} — no card required.`,
            body: [
              brandTitle('Your AI is ready'),
              brandText(`Hi ${data.contactName}, great speaking with you. Qwillio handles your incoming calls 24/7 — answering questions, booking appointments and qualifying leads while you focus on your business.`),
              brandText(`We recommend the <strong>${planName}</strong> plan for <strong>${data.businessName}</strong>. Your first 30 days are completely free — no commitment, cancel anytime.`),
              brandHighlight('Free trial', '30 days', 28),
              brandButton('Start your free trial', data.registrationUrl),
              brandSmall('Setup takes less than 5 minutes. No credit card required. — Ashley, Qwillio AI'),
            ].join(''),
          });
      const html = this.injectUnsubscribeLink(rawHtml, data.to);

      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        replyTo: env.RESEND_REPLY_TO,
        subject: lang === 'fr'
          ? `${data.contactName}, votre réceptionniste IA est prête — 30 jours gratuits`
          : `${data.contactName}, your AI receptionist is ready — 30 days free`,
        html,
        headers: { 'List-Unsubscribe': `<${this.getUnsubscribeUrl(data.to)}>` },
        tags: [{ name: 'campaign', value: 'registration_invite' }],
      });
      logger.info(`Registration invite sent to ${data.to}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to send registration invite:', error);
      return { success: false };
    }
  }
}

export const emailService = new EmailService();
