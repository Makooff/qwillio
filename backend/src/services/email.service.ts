import { resend } from '../config/resend';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { PACKAGES } from '../types';
import { formatDate } from '../utils/helpers';
import { brandWrap, brandTitle, brandText, brandButton, brandList, brandSmall, brandLink } from './email-template';

/** Highlight block — used for phone numbers, prices, dates (light violet card on white). */
function brandHighlight(label: string, value: string, valueSize = 24): string {
  return `<div style="margin:16px 0 32px 0;padding:24px 24px;background:rgba(123,92,240,0.08);border:1px solid rgba(123,92,240,0.18);border-radius:12px;text-align:center;">
    <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(92,60,224,0.70);letter-spacing:0.06em;text-transform:uppercase;">${label}</p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:${valueSize}px;font-weight:700;letter-spacing:-0.01em;color:#5C3CE0;font-feature-settings:'tnum';">${value}</p>
  </div>`;
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
  }) {
    const rawHtml = this.renderQuoteTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `Your Qwillio Quote - ${data.businessName}`,
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
  }) {
    const rawHtml = this.renderFollowUpTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);
    const subjects: Record<string, string> = {
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
  }) {
    const rawHtml = this.renderWelcomeTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `Welcome to Qwillio - ${data.businessName}!`,
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
  }) {
    const rawHtml = this.renderTrialWelcomeTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `Your free Qwillio trial is active - ${data.businessName}!`,
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
  }) {
    const rawHtml = this.renderTrialEndingTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);
    const subjects: Record<number, string> = {
      7: `${data.contactName}, only 7 days left in your free trial!`,
      1: `TOMORROW your free trial ends - ${data.businessName}`,
    };

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: subjects[data.daysLeft] || `Your free trial is ending soon`,
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
  }) {
    const rawHtml = this.renderTrialExpiredTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `Your free trial has ended - ${data.businessName}`,
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
  }) {
    const rawHtml = this.renderCallback3MonthsTemplate(data);
    const html = this.injectUnsubscribeLink(rawHtml, data.to);

    try {
      const result = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `${data.contactName}, it's been a while! News from Qwillio`,
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

  private renderQuoteTemplate(data: {
    contactName: string;
    businessName: string;
    packageType: string;
    setupPrice: number;
    monthlyPrice: number;
    features: string[];
    validUntil: Date;
    paymentLink: string;
  }): string {
    return brandWrap({
      title: 'Your Qwillio quote',
      preheader: `Personalized quote for ${data.businessName}.`,
      body: [
        brandTitle('Your personalized quote'),
        brandText(`Hi ${data.contactName || 'there'}, following our conversation, here is your quote for <strong>${data.businessName}</strong>.`),
        brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
        brandText(`One-time setup fee: <strong>$${data.setupPrice}</strong>`),
        brandText("What's included:"),
        brandList(data.features),
        brandHighlight('Offer valid until', formatDate(data.validUntil), 18),
        brandButton('Complete my signup', data.paymentLink),
        brandSmall('Setup completed within 48 hours of payment. Reply to this email if you have questions. — Ashley, Qwillio'),
      ].join(''),
    });
  }

  private renderFollowUpTemplate(data: {
    contactName: string;
    businessName: string;
    packageName: string;
    monthlyPrice: number;
    setupPrice: number;
    paymentLink: string;
    type: 'day1' | 'day3' | 'day7';
  }): string {
    if (data.type === 'day1') {
      return brandWrap({
        title: 'Your offer is still available',
        preheader: `Quick follow-up on your Qwillio proposal for ${data.businessName}.`,
        body: [
          brandTitle('Still here for you'),
          brandText(`Hi ${data.contactName}, just making sure you saw our proposal for <strong>${data.businessName}</strong>.`),
          brandHighlight(`${data.packageName} package`, `$${data.monthlyPrice}/mo`, 28),
          brandText(`One-time setup: $${data.setupPrice}. Our AI ensures you never miss a customer call again.`),
          brandButton('View my offer', data.paymentLink),
          brandSmall('— Ashley, Qwillio'),
        ].join(''),
      });
    }

    if (data.type === 'day3') {
      return brandWrap({
        title: '4 days left',
        preheader: `Your Qwillio offer for ${data.businessName} closes soon.`,
        body: [
          brandTitle('Only 4 days left'),
          brandText(`Hi ${data.contactName}, your personalized offer for <strong>${data.businessName}</strong> closes in 4 days.`),
          brandText('What our clients say:'),
          brandList([
            '95% customer satisfaction rate',
            '40 missed calls saved per month on average',
            'Positive ROI within the 2nd month',
          ]),
          brandButton('Complete my signup', data.paymentLink),
          brandSmall('— Ashley, Qwillio'),
        ].join(''),
      });
    }

    return brandWrap({
      title: 'Last chance',
      preheader: `Your Qwillio offer for ${data.businessName} expires today.`,
      body: [
        brandTitle('Last chance'),
        brandText(`Hi ${data.contactName}, today is the final day to claim your personalized offer for <strong>${data.businessName}</strong>.`),
        brandText('Our clients see an average <strong>25% increase in bookings</strong> with our AI receptionist.'),
        brandHighlight(`${data.packageName} package`, `$${data.monthlyPrice}/mo`, 28),
        brandText(`One-time setup: $${data.setupPrice}.`),
        brandButton('Claim my offer now', data.paymentLink),
        brandSmall('This offer will no longer be available after today. — Ashley, Qwillio'),
      ].join(''),
    });
  }

  private renderWelcomeTemplate(data: {
    contactName: string;
    businessName: string;
    planType: string;
    vapiPhoneNumber: string;
    dashboardUrl: string;
  }): string {
    return brandWrap({
      title: 'Welcome to Qwillio',
      preheader: `Your AI receptionist for ${data.businessName} is live.`,
      body: [
        brandTitle('Your AI is live'),
        brandText(`Hi ${data.contactName}, your AI receptionist for <strong>${data.businessName}</strong> is now answering calls 24/7.`),
        brandButton('Open my dashboard', data.dashboardUrl),
        brandHighlight('Your AI phone number', data.vapiPhoneNumber, 22),
        brandText('Next step on your dashboard:'),
        brandList([
          `<strong>Test it.</strong> Call ${data.vapiPhoneNumber} and hear your AI in action.`,
          `<strong>Customize it.</strong> Open the dashboard to set hours, FAQ and pricing.`,
          `<strong>Forward your calls.</strong> Redirect your main line to ${data.vapiPhoneNumber} when you're ready.`,
        ]),
        brandSmall('Tip — during the first 7 days, keep your current phone system running in parallel for a smooth transition.'),
      ].join(''),
    });
  }

  private renderTrialWelcomeTemplate(data: {
    contactName: string;
    businessName: string;
    packageType: string;
    trialEndDate: Date;
    trialCallsQuota: number;
  }): string {
    return brandWrap({
      title: 'Your free trial is active',
      preheader: `30 days to test Qwillio for ${data.businessName}.`,
      body: [
        brandTitle('Your free trial is active'),
        brandText(`Hi ${data.contactName}, your <strong>30-day free trial</strong> for <strong>${data.businessName}</strong> has just been activated. No commitment, no card required.`),
        brandText("What's included in your trial:"),
        brandList([
          'AI receptionist available 24/7',
          `${data.trialCallsQuota} calls during the trial period`,
          'Automatic booking & reservations',
          'Real-time tracking dashboard',
          'Email technical support',
        ]),
        brandHighlight('Trial ends on', formatDate(data.trialEndDate), 18),
        brandText('Next steps: our team will set up your AI assistant in the next 24–48 hours and email you the AI phone number. From there, just test and enjoy.'),
        brandSmall('Questions? Reply to this email and Ashley will jump in. — The Qwillio Team'),
      ].join(''),
    });
  }

  private renderTrialEndingTemplate(data: {
    contactName: string;
    businessName: string;
    packageType: string;
    daysLeft: number;
    trialEndDate: Date;
    paymentLink: string;
    monthlyPrice: number;
  }): string {
    const dayWord = data.daysLeft > 1 ? 'days' : 'day';
    return brandWrap({
      title: 'Your trial is ending',
      preheader: `Your free trial for ${data.businessName} ends ${formatDate(data.trialEndDate)}.`,
      body: [
        brandTitle(`Only ${data.daysLeft} ${dayWord} left`),
        brandText(`Hi ${data.contactName}, your free trial for <strong>${data.businessName}</strong> ends on <strong>${formatDate(data.trialEndDate)}</strong>.`),
        brandText('Your AI receptionist has already been working for you. Keep it on after the trial:'),
        brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
        brandText('No commitment. Cancel anytime.'),
        brandButton('Continue with Qwillio', data.paymentLink),
        brandSmall("Without a subscription, your AI receptionist will be deactivated at the end of the trial. — Ashley, Qwillio"),
      ].join(''),
    });
  }

  private renderTrialExpiredTemplate(data: {
    contactName: string;
    businessName: string;
    packageType: string;
    paymentLink: string;
    monthlyPrice: number;
  }): string {
    return brandWrap({
      title: 'Your free trial has ended',
      preheader: `Reactivate your AI receptionist for ${data.businessName} in 2 minutes.`,
      body: [
        brandTitle('Your trial has ended'),
        brandText(`Hi ${data.contactName}, your free trial for <strong>${data.businessName}</strong> has just ended. Your AI receptionist is now paused — incoming calls are no longer handled.`),
        brandText('Subscribe to bring it back in two minutes:'),
        brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
        brandButton('Reactivate my AI assistant', data.paymentLink),
        brandSmall('Your configuration is saved for 30 days, then permanently deleted. — Ashley, Qwillio'),
      ].join(''),
    });
  }

  private renderCallback3MonthsTemplate(data: {
    contactName: string;
    businessName: string;
  }): string {
    const replyMail = `mailto:${env.RESEND_REPLY_TO}?subject=Follow-up%20${encodeURIComponent(data.businessName)}`;
    return brandWrap({
      title: 'News from Qwillio',
      preheader: `Quick check-in for ${data.businessName} — a few new things since we last spoke.`,
      body: [
        brandTitle('News from Qwillio'),
        brandText(`Hi ${data.contactName}, we spoke 3 months ago about an AI receptionist for <strong>${data.businessName}</strong>. Has your situation changed?`),
        brandText('A few updates since we last spoke:'),
        brandList([
          'Automatic SMS reminder system',
          'Direct Google Calendar integration',
          'Mobile app to track your calls in real time',
        ]),
        brandButton("Yes, I'm interested", replyMail),
        brandSmall("If not, no worries — feel free to reach out anytime. — Ashley, Qwillio"),
      ].join(''),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ONBOARDING EMAIL - Welcome + form link + dashboard link
  // ═══════════════════════════════════════════════════════════
  async sendOnboardingEmail(data: {
    to: string; contactName: string; businessName: string; businessType: string;
    planType: string; isTrial: boolean; trialEndDate: Date | null;
    formUrl: string; dashboardUrl: string; vapiPhoneNumber: string;
  }) {
    const pkg = PACKAGES[data.planType] || PACKAGES.basic;
    const planLabel = data.isTrial ? '30-day free trial' : `${pkg.name} plan`;
    const html = brandWrap({
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
          ? brandSmall(`Your free trial ends on <strong>${formatDate(data.trialEndDate)}</strong>. No payment until then.`)
          : '',
        brandSmall('After setup, you will receive a personalized walkthrough video. — The Qwillio Team'),
      ].join(''),
    });
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: `Welcome to Qwillio - let's set up your AI receptionist for ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'onboarding_welcome' }],
      });
      logger.info(`Onboarding email sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send onboarding email:', error); throw error; }
  }

  // ═══════════════════════════════════════════════════════════
  // LOOM VIDEO EMAIL - After onboarding form completed
  // ═══════════════════════════════════════════════════════════
  async sendLoomVideoEmail(data: { to: string; contactName: string; businessName: string; dashboardUrl: string; }) {
    const html = brandWrap({
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
        subject: `🎬 Your AI receptionist is ready - ${data.businessName}`,
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
  }) {
    const total = data.monthlyPrice + data.setupPrice;
    const html = brandWrap({
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
        subject: `Trial results + invoice - ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'trial_end_invoice' }],
      });
      logger.info(`Trial end invoice sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send trial end invoice:', error); throw error; }
  }

  // ═══════════════════════════════════════════════════════════
  // ACCOUNT DEACTIVATED EMAIL - 7 days no payment
  // ═══════════════════════════════════════════════════════════
  async sendAccountDeactivatedEmail(data: { to: string; contactName: string; businessName: string; }) {
    const reactivateMail = `mailto:${env.RESEND_REPLY_TO}?subject=Reactivate%20${encodeURIComponent(data.businessName)}`;
    const html = brandWrap({
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
        subject: `Account deactivated - ${data.businessName}`,
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
  }) {
    const total = data.setupFee + data.monthlyFee;
    const html = brandWrap({
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
        subject: `Contract signed — complete your setup for ${data.businessName}`,
        html, replyTo: env.RESEND_REPLY_TO,
        tags: [{ name: 'campaign', value: 'contract_signed_payment' }],
      });
      logger.info(`Payment link after signature email sent to ${data.to}`);
    } catch (error) { logger.error('Failed to send payment link after signature email:', error); }
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT FAILED EMAIL - Notify client to update payment
  // ═══════════════════════════════════════════════════════════
  async sendPaymentFailedEmail(data: { to: string; contactName: string; businessName: string; amount: number; paymentLink?: string | null; }) {
    const html = brandWrap({
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
        subject: `Payment failed - ${data.businessName}`,
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
  }) {
    const html = this.renderBookingReminderTemplate(data);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `Reminder: Your appointment at ${data.businessName} tomorrow`,
        html,
        tags: [{ name: 'campaign', value: 'booking_reminder' }],
      });
      logger.info(`Booking reminder email sent to ${data.to}`);
    } catch (error) {
      logger.error(`Failed to send booking reminder to ${data.to}:`, error);
      throw error;
    }
  }

  private renderBookingReminderTemplate(data: {
    to: string;
    customerName: string;
    businessName: string;
    bookingDate: Date;
    bookingTime: string;
    serviceType: string;
    specialRequests: string | null;
    businessPhone: string;
  }): string {
    const dateStr = data.bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const whenValue = data.bookingTime ? `${dateStr} · ${data.bookingTime}` : dateStr;
    const details: string[] = [
      `<strong>Where</strong> — ${data.businessName}`,
      `<strong>Service</strong> — ${data.serviceType}`,
    ];
    if (data.specialRequests) details.push(`<strong>Notes</strong> — ${data.specialRequests}`);
    return brandWrap({
      title: 'Appointment reminder',
      preheader: `Reminder of your appointment at ${data.businessName}.`,
      body: [
        brandTitle('Appointment reminder'),
        brandText(`Hi ${data.customerName}, this is a friendly reminder about your upcoming appointment at <strong>${data.businessName}</strong>.`),
        brandHighlight('Your appointment', whenValue, 18),
        brandList(details),
        data.businessPhone
          ? brandButton('Call to reschedule', `tel:${data.businessPhone}`)
          : '',
        data.businessPhone
          ? brandSmall(`Need to reschedule or cancel? Call <strong>${data.businessPhone}</strong>.`)
          : brandSmall('If you need to reschedule, please contact us directly.'),
      ].join(''),
    });
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
  }) {
    const html = this.renderRescheduleTemplate(data);
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `We missed you at ${data.businessName} - Let's reschedule!`,
        html,
        tags: [{ name: 'campaign', value: 'reschedule' }],
      });
      logger.info(`Reschedule email sent to ${data.to}`);
    } catch (error) {
      logger.error(`Failed to send reschedule email to ${data.to}:`, error);
    }
  }

  private renderRescheduleTemplate(data: {
    to: string;
    customerName: string;
    businessName: string;
    originalDate: Date;
    businessPhone: string;
  }): string {
    const dateStr = data.originalDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    return brandWrap({
      title: "Let's reschedule",
      preheader: `We missed you at ${data.businessName} — let's find a new time.`,
      body: [
        brandTitle('We missed you'),
        brandText(`Hi ${data.customerName}, we noticed you weren't able to make your appointment on <strong>${dateStr}</strong>. No worries — things happen.`),
        brandText(`We'd love to reschedule at a time that works better for you.`),
        brandButton('Call to reschedule', `tel:${data.businessPhone}`),
        brandSmall(`Or call us at <strong>${data.businessPhone}</strong> anytime — our AI receptionist is available 24/7.`),
      ].join(''),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // EMAIL CONFIRMATION — Sent 30s after call to verify address
  // ═══════════════════════════════════════════════════════════
  async sendEmailConfirmation(data: {
    to: string;
    contactName: string;
    businessName: string;
    prospectId: string;
  }): Promise<{ success: boolean; emailId?: string }> {
    const demoUrl = `${env.FRONTEND_URL?.split(',')[0] || 'https://qwillio.com'}/demo.html`;
    const html = brandWrap({
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
        subject: `Thanks for chatting, ${data.contactName || 'there'}! Here's your demo`,
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
  async sendConfirmationEmail(data: {
    to: string;
    name: string;
    confirmUrl: string;
  }): Promise<{ success: boolean; emailId?: string }> {
    const firstName = data.name.split(' ')[0] || data.name;

    const html = brandWrap({
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
        subject: 'Confirm your Qwillio account',
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
  async sendRegistrationInvite(data: { to: string; contactName: string; businessName: string; registrationUrl: string; recommendedPlan: string }) {
    try {
      const planNames: Record<string, string> = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
      const planName = planNames[data.recommendedPlan] || 'Pro';
      const rawHtml = brandWrap({
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
        subject: `${data.contactName}, your AI receptionist is ready — 30 days free`,
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
