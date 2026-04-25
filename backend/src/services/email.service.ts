import { resend } from '../config/resend';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { PACKAGES } from '../types';
import { formatDate } from '../utils/helpers';
import { brandWrap, brandTitle, brandText, brandButton, brandList, brandSmall } from './email-template';

/** Highlight block on the light translucent card — used for phone numbers, prices, dates. */
function brandHighlight(label: string, value: string, valueSize = 24): string {
  return `<div style="margin:24px 0;padding:20px 24px;background:rgba(123,92,240,0.06);border:1px solid rgba(123,92,240,0.20);border-radius:12px;text-align:center;">
    <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;color:#86868B;letter-spacing:0.06em;text-transform:uppercase;">${label}</p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:${valueSize}px;font-weight:700;letter-spacing:-0.01em;color:#0B0B0D;font-feature-settings:'tnum';">${value}</p>
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
    const featuresHtml = data.features.map(f => `<li>${f}</li>`).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Qwillio Quote</title>
</head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;background-color:#f4f4f4;margin:0;padding:0;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:40px 30px;text-align:center;">
      <h1 style="margin:0;font-size:28px;">Qwillio</h1>
      <p style="margin:10px 0 0;font-size:16px;opacity:0.9;">Your 24/7 AI Receptionist</p>
    </div>
    <div style="padding:40px 30px;">
      <p style="font-size:18px;">Hi ${data.contactName || 'there'},</p>
      <p>Following our phone conversation, here is your <strong>personalized quote</strong> for <strong>${data.businessName}</strong>.</p>
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px;border-radius:10px;margin:30px 0;text-align:center;">
        <h2 style="margin:0 0 15px;font-size:24px;">${data.packageType.toUpperCase()} PACKAGE</h2>
        <div style="font-size:48px;font-weight:700;margin:15px 0;">$${data.monthlyPrice}<span style="font-size:16px;">/mo</span></div>
        <p style="font-size:16px;opacity:0.9;">One-time setup fee: <strong>$${data.setupPrice}</strong></p>
      </div>
      <div style="background:#f8f9fa;border-left:4px solid #667eea;padding:20px;margin:20px 0;border-radius:5px;">
        <h3 style="margin-top:0;">Features included:</h3>
        <ul style="list-style:none;padding:0;margin:0;">
          ${featuresHtml}
        </ul>
      </div>
      <div style="background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:15px;border-radius:5px;margin:20px 0;text-align:center;font-weight:600;">
        This offer is valid until ${formatDate(data.validUntil)}
      </div>
      <div style="text-align:center;">
        <a href="${data.paymentLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:18px 45px;text-decoration:none;border-radius:30px;font-weight:700;font-size:18px;margin:25px 0;">Complete My Signup</a>
      </div>
      <p style="margin-top:30px;">Our technical team will configure your AI receptionist within <strong>48 hours</strong> after payment confirmation.</p>
      <p>Have questions? Simply reply to this email!</p>
      <div style="margin-top:30px;padding-top:20px;border-top:2px solid #e9ecef;">
        <p style="margin:5px 0;"><strong>Ashley</strong></p>
        <p style="margin:5px 0;color:#666;">Senior Sales Consultant</p>
        <p style="margin:5px 0;color:#667eea;"><strong>Qwillio</strong></p>
      </div>
    </div>
    <div style="background:#f8f9fa;padding:30px;text-align:center;color:#666;font-size:14px;border-top:1px solid #e9ecef;">
      <p style="margin:5px 0;">Qwillio - Your AI Phone Receptionist</p>
    </div>
  </div>
</body>
</html>`;
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
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;">
    <h1 style="margin:0;">Qwillio</h1>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <p>I wanted to make sure you received our proposal for <strong>${data.businessName}</strong>.</p>
    <p><strong>Your offer is still available.</strong></p>
    <div style="background:#f8f9fa;padding:20px;border-radius:10px;margin:20px 0;">
      <p style="margin:0;">${data.packageName} Package: <strong>$${data.monthlyPrice}/mo</strong></p>
      <p style="margin:10px 0 0;">Setup: $${data.setupPrice} (one-time)</p>
    </div>
    <p>Our AI receptionist ensures you never miss a customer call again.</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.paymentLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px 40px;text-decoration:none;border-radius:30px;font-weight:700;font-size:16px;">View My Offer</a>
    </div>
    <p>Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
    }

    if (data.type === 'day3') {
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;">
    <h1 style="margin:0;">Qwillio</h1>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <p>I'm following up on the AI receptionist proposal for <strong>${data.businessName}</strong>.</p>
    <div style="background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:15px;border-radius:5px;margin:20px 0;text-align:center;font-weight:600;">
      Only 4 days left to take advantage of this offer!
    </div>
    <p><strong>What our clients are saying:</strong></p>
    <ul>
      <li>95% customer satisfaction rate</li>
      <li>An average of 40 missed calls saved per month</li>
      <li>Positive ROI within the 2nd month</li>
    </ul>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.paymentLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px 40px;text-decoration:none;border-radius:30px;font-weight:700;font-size:16px;">Complete My Signup</a>
    </div>
    <p>Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
    }

    // day7
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;">
    <h1 style="margin:0;">Qwillio</h1>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <div style="background:#f8d7da;border:1px solid #dc3545;color:#721c24;padding:15px;border-radius:5px;margin:20px 0;text-align:center;font-weight:600;">
      LAST CHANCE - Your offer expires today!
    </div>
    <p>This is the final day to claim your personalized offer for <strong>${data.businessName}</strong>.</p>
    <p>Our clients see an average <strong>25% increase in bookings</strong> with our AI receptionist.</p>
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:25px;border-radius:10px;text-align:center;margin:25px 0;">
      <h2 style="margin:0 0 15px;">${data.packageName} Package</h2>
      <p style="font-size:36px;font-weight:700;margin:0;">$${data.monthlyPrice}<span style="font-size:16px;">/mo</span></p>
      <p style="margin:10px 0 0;">Setup: $${data.setupPrice}</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.paymentLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px 40px;text-decoration:none;border-radius:30px;font-weight:700;font-size:16px;">Claim My Offer Now</a>
    </div>
    <p style="color:#dc3545;font-weight:600;">This offer will no longer be available after today.</p>
    <p>Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
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
        brandTitle('Your AI receptionist is live'),
        brandText(`Hi ${data.contactName}, your AI receptionist for <strong>${data.businessName}</strong> is now answering calls 24/7.`),
        brandHighlight('Your AI phone number', data.vapiPhoneNumber, 22),
        brandText('Three quick steps to make the most of it:'),
        brandList([
          `<strong>Test it.</strong> Call ${data.vapiPhoneNumber} and hear your AI in action.`,
          `<strong>Customize it.</strong> Open the dashboard to set hours, FAQ and pricing.`,
          `<strong>Forward your calls.</strong> Redirect your main line to ${data.vapiPhoneNumber} when you're ready.`,
        ]),
        brandButton('Open dashboard', data.dashboardUrl),
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
    const urgencyColor = data.daysLeft <= 1 ? '#dc3545' : '#f59e0b';
    const urgencyBg = data.daysLeft <= 1 ? '#f8d7da' : '#fff3cd';

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;">
    <h1 style="margin:0;">Qwillio</h1>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <div style="background:${urgencyBg};border:1px solid ${urgencyColor};color:#333;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
      <p style="font-size:24px;font-weight:700;margin:0;color:${urgencyColor};">Only ${data.daysLeft} day${data.daysLeft > 1 ? 's' : ''} left</p>
      <p style="margin:10px 0 0;">Your free trial ends on <strong>${formatDate(data.trialEndDate)}</strong></p>
    </div>
    <p>Your AI receptionist for <strong>${data.businessName}</strong> has already been working for you.</p>
    <p><strong>To keep enjoying it after your trial:</strong></p>
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:25px;border-radius:10px;text-align:center;margin:25px 0;">
      <p style="margin:0 0 5px;font-size:14px;opacity:0.9;">${data.packageType.toUpperCase()} Package</p>
      <p style="font-size:36px;font-weight:700;margin:0;">$${data.monthlyPrice}<span style="font-size:16px;">/mo</span></p>
      <p style="margin:10px 0 0;opacity:0.9;">No commitment - Cancel anytime</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.paymentLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:18px 45px;text-decoration:none;border-radius:30px;font-weight:700;font-size:18px;">Continue with Qwillio</a>
    </div>
    <p style="color:#666;font-size:14px;">If you don't subscribe, your AI receptionist will be deactivated at the end of the trial.</p>
    <p>Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
  }

  private renderTrialExpiredTemplate(data: {
    contactName: string;
    businessName: string;
    packageType: string;
    paymentLink: string;
    monthlyPrice: number;
  }): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#dc3545,#c82333);color:#fff;padding:40px 30px;text-align:center;">
    <h1 style="margin:0;font-size:28px;">Your Free Trial Has Ended</h1>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <p>Your free trial period for <strong>${data.businessName}</strong> has just ended.</p>
    <p>Your AI receptionist has been <strong>paused</strong>. Incoming calls will no longer be handled automatically.</p>
    <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:20px;margin:25px 0;border-radius:5px;">
      <h3 style="margin:0 0 10px;color:#059669;">Reactivate your assistant in 2 minutes!</h3>
      <p style="margin:0;">Subscribe to the ${data.packageType.toUpperCase()} package for just <strong>$${data.monthlyPrice}/mo</strong> and get your AI receptionist back instantly.</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.paymentLink}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:18px 45px;text-decoration:none;border-radius:30px;font-weight:700;font-size:18px;">Reactivate My AI Assistant</a>
    </div>
    <p style="color:#666;font-size:14px;">Your configuration is saved for 30 days. After that, it will be permanently deleted.</p>
    <p>Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
  }

  private renderCallback3MonthsTemplate(data: {
    contactName: string;
    businessName: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;">
    <h1 style="margin:0;">Qwillio</h1>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <p>We spoke about 3 months ago about an AI receptionist solution for <strong>${data.businessName}</strong>.</p>
    <p>I wanted to check in and see if your situation has changed and whether you'd still be interested in a free demo?</p>
    <p><strong>A few updates since we last spoke:</strong></p>
    <ul>
      <li>New automatic SMS reminder system</li>
      <li>Direct Google Calendar integration</li>
      <li>Mobile app to track your calls in real time</li>
    </ul>
    <div style="text-align:center;margin:30px 0;">
      <a href="mailto:${env.RESEND_REPLY_TO}?subject=Follow-up%20${encodeURIComponent(data.businessName)}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px 40px;text-decoration:none;border-radius:30px;font-weight:700;font-size:16px;">Yes, I'm Interested</a>
    </div>
    <p>If not, no worries! Feel free to reach out anytime.</p>
    <p>Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
  <div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:40px 30px;text-align:center;">
    <h1 style="margin:0;font-size:26px;">Welcome to Qwillio! 🎉</h1>
    <p style="margin:10px 0 0;opacity:0.9;">Let's set up your AI receptionist</p>
  </div>
  <div style="padding:40px 30px;">
    <p style="font-size:18px;">Hi ${data.contactName},</p>
    <p>Your ${data.isTrial ? '30-day free trial' : `${pkg.name} plan`} for <strong>${data.businessName}</strong> is now active!</p>
    <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:20px;margin:25px 0;">
      <h3 style="margin:0 0 10px;color:#059669;">📞 Your AI Phone Number</h3>
      <p style="font-size:28px;font-weight:700;color:#10b981;margin:0;">${data.vapiPhoneNumber}</p>
      <p style="margin:10px 0 0;color:#666;font-size:14px;">Already active and answering calls 24/7</p>
    </div>
    <h3>🚀 3 Quick Steps:</h3>
    <div style="background:#f8f9ff;border-radius:10px;padding:20px;margin:15px 0;">
      <p style="margin:0 0 5px;"><strong>Step 1:</strong> Complete your setup form (5 min)</p>
      <p style="margin:0;color:#666;font-size:14px;">Tell us about your business so your AI can answer accurately.</p>
      <div style="text-align:center;margin:15px 0;">
        <a href="${data.formUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:14px 35px;text-decoration:none;border-radius:25px;font-weight:700;">Complete Setup Form →</a>
      </div>
    </div>
    <div style="background:#f8f9ff;border-radius:10px;padding:20px;margin:15px 0;">
      <p style="margin:0 0 5px;"><strong>Step 2:</strong> Test your receptionist</p>
      <p style="margin:0;color:#666;font-size:14px;">Call ${data.vapiPhoneNumber} to hear your AI in action!</p>
    </div>
    <div style="background:#f8f9ff;border-radius:10px;padding:20px;margin:15px 0;">
      <p style="margin:0 0 5px;"><strong>Step 3:</strong> Access your dashboard</p>
      <div style="text-align:center;margin:15px 0;">
        <a href="${data.dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:14px 35px;text-decoration:none;border-radius:25px;font-weight:700;">Open My Dashboard →</a>
      </div>
    </div>
    ${data.isTrial && data.trialEndDate ? `<div style="background:#fff3cd;border:1px solid #ffc107;padding:15px;border-radius:8px;margin:25px 0;text-align:center;"><p style="margin:0;color:#92400e;"><strong>Free trial ends on ${formatDate(data.trialEndDate)}</strong><br>No payment until then.</p></div>` : ''}
    <p style="color:#666;font-size:14px;">After setup, we'll send you a personalized walkthrough video.</p>
    <p><strong>The Qwillio Team</strong></p>
  </div>
</div></body></html>`;
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: `🎉 Welcome! Let's set up your AI receptionist - ${data.businessName}`,
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
        brandText("A teammate is recording a personalized walkthrough video — you'll receive it within 24 hours."),
        brandText('Your AI now knows:'),
        brandList([
          'Business hours & location',
          'Services, pricing and FAQ',
          'Booking protocols',
          'Urgent call handling',
          'Industry-specific knowledge',
        ]),
        brandButton('Open dashboard', data.dashboardUrl),
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:35px 30px;text-align:center;">
    <h1 style="margin:0;">Your Trial Results 📊</h1>
    <p style="margin:10px 0 0;opacity:0.9;">${data.businessName}</p>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <p>Your 30-day trial has ended. Here's what your AI accomplished:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;text-align:center;">
      <tr>
        <td style="padding:15px;background:#f0fdf4;border-radius:8px;"><p style="font-size:32px;font-weight:700;color:#10b981;margin:0;">${data.trialStats.totalCalls}</p><p style="margin:5px 0 0;color:#666;font-size:13px;">Calls</p></td>
        <td style="padding:15px;background:#f0f0ff;border-radius:8px;"><p style="font-size:32px;font-weight:700;color:#667eea;margin:0;">${data.trialStats.totalBookings}</p><p style="margin:5px 0 0;color:#666;font-size:13px;">Bookings</p></td>
        <td style="padding:15px;background:#fef3c7;border-radius:8px;"><p style="font-size:32px;font-weight:700;color:#f59e0b;margin:0;">${data.trialStats.totalLeads}</p><p style="margin:5px 0 0;color:#666;font-size:13px;">Leads</p></td>
      </tr>
    </table>
    <div style="background:#f8f9fa;border:2px solid #e9ecef;border-radius:10px;padding:25px;margin:25px 0;">
      <h3 style="margin:0 0 15px;">📄 Invoice - ${data.packageName}</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">Monthly subscription</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;"><strong>$${data.monthlyPrice}/mo</strong></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">One-time setup fee</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #eee;">$${data.setupPrice}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">First payment</td><td style="text-align:right;font-weight:700;font-size:18px;color:#667eea;">$${data.monthlyPrice + data.setupPrice}</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.paymentLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:18px 50px;text-decoration:none;border-radius:30px;font-weight:700;font-size:18px;">Subscribe & Keep My AI →</a>
    </div>
    <div style="background:#fef2f2;border:1px solid #dc3545;padding:15px;border-radius:8px;">
      <p style="margin:0;color:#dc2626;font-size:14px;"><strong>⚠️</strong> Without payment within 7 days, your AI receptionist and dashboard access will be deactivated.</p>
    </div>
    <p style="margin-top:25px;">Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL, to: data.to,
        subject: `📊 Trial results + invoice - ${data.businessName}`,
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#dc3545,#c82333);color:#fff;padding:35px 30px;text-align:center;">
    <h1 style="margin:0;">Account Deactivated</h1>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <p>Your Qwillio AI receptionist for <strong>${data.businessName}</strong> has been deactivated due to non-payment.</p>
    <ul><li>❌ AI receptionist stopped</li><li>❌ Dashboard access revoked</li><li>❌ Reminders & analytics paused</li></ul>
    <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:20px;margin:25px 0;">
      <h3 style="margin:0 0 10px;color:#059669;">Want to reactivate?</h3>
      <p style="margin:0;">Your config is saved for 30 days. Contact <a href="mailto:${env.RESEND_REPLY_TO}">${env.RESEND_REPLY_TO}</a> to reactivate.</p>
    </div>
    <p>Ashley<br>Qwillio</p>
  </div>
</div></body></html>`;
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;line-height:1.6;color:#333;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:35px 30px;text-align:center;">
    <h1 style="margin:0;font-size:24px;">Contract Signed!</h1>
    <p style="margin:10px 0 0;opacity:0.9;">One last step to activate your AI receptionist</p>
  </div>
  <div style="padding:40px 30px;">
    <p>Hi ${data.contactName},</p>
    <p>Great news! Your service agreement for <strong>${data.businessName}</strong> has been signed successfully.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:8px;margin:25px 0;">
      <p style="margin:0;color:#16a34a;"><strong>Your contract is confirmed.</strong> Complete your payment below to activate your AI receptionist immediately.</p>
    </div>
    <div style="background:#f8f9ff;padding:20px;border-radius:8px;margin:25px 0;">
      <p style="margin:5px 0;"><strong>Plan:</strong> ${data.packageType.toUpperCase()}</p>
      <p style="margin:5px 0;"><strong>Setup fee:</strong> $${data.setupFee.toLocaleString()}</p>
      <p style="margin:5px 0;"><strong>Monthly:</strong> $${data.monthlyFee}/mo</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="${data.paymentLink}" style="display:inline-block;background:#4f46e5;color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:18px;">Complete Payment</a>
    </div>
    <p style="font-size:13px;color:#888;">Once payment is complete, we'll set up your AI receptionist and you'll receive your onboarding details within minutes.</p>
    <p>The Qwillio Team</p>
  </div>
</div></body></html>`;
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
        brandText('Your AI receptionist is still active, but we need you to update your payment method to avoid any service interruption.'),
        data.paymentLink
          ? brandButton('Update payment method', data.paymentLink)
          : brandText('Stripe will automatically retry the payment in a few days. If you\'d like to update your card now, reply to this email and we\'ll send a secure link.'),
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
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;">
    <h1 style="margin:0;font-size:22px;">📅 Appointment Reminder</h1>
    <p style="margin:10px 0 0;opacity:0.9;">${data.businessName}</p>
  </div>
  <div style="padding:30px;color:#333;">
    <p>Hi ${data.customerName},</p>
    <p>This is a friendly reminder about your upcoming appointment:</p>
    <div style="background:#f8f9ff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #667eea;">
      <p style="margin:5px 0;"><strong>📅 Date:</strong> ${dateStr}</p>
      ${data.bookingTime ? `<p style="margin:5px 0;"><strong>🕐 Time:</strong> ${data.bookingTime}</p>` : ''}
      <p style="margin:5px 0;"><strong>🏢 Where:</strong> ${data.businessName}</p>
      <p style="margin:5px 0;"><strong>📋 Service:</strong> ${data.serviceType}</p>
      ${data.specialRequests ? `<p style="margin:5px 0;"><strong>📝 Notes:</strong> ${data.specialRequests}</p>` : ''}
    </div>
    ${data.businessPhone ? `<div style="text-align:center;margin:20px 0;"><a href="tel:${data.businessPhone}" style="display:inline-block;background:#667eea;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">📞 Call to Reschedule</a></div>
    <p style="text-align:center;color:#666;font-size:13px;">Need to reschedule or cancel? Call <strong>${data.businessPhone}</strong></p>` : '<p>If you need to reschedule, please contact us directly.</p>'}
    <p>We look forward to seeing you!</p>
    <p style="color:#888;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:15px;">This reminder was sent by ${data.businessName}'s AI receptionist powered by Qwillio.</p>
  </div>
</div></body></html>`;
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
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;padding:30px;text-align:center;">
    <h1 style="margin:0;font-size:22px;">We Missed You!</h1>
    <p style="margin:10px 0 0;opacity:0.9;">${data.businessName}</p>
  </div>
  <div style="padding:30px;color:#333;">
    <p>Hi ${data.customerName},</p>
    <p>We noticed you weren't able to make your appointment on <strong>${dateStr}</strong>. No worries at all — things happen!</p>
    <p>We'd love to reschedule at a time that works better for you.</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="tel:${data.businessPhone}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px 40px;text-decoration:none;border-radius:30px;font-weight:700;font-size:16px;">📞 Call to Reschedule</a>
    </div>
    <p>Or simply call us at <strong>${data.businessPhone}</strong> anytime. Our AI receptionist is available 24/7 to help you find a new time.</p>
    <p>See you soon!</p>
    <p style="color:#888;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:15px;">This message was sent by ${data.businessName}'s AI receptionist powered by Qwillio.</p>
  </div>
</div></body></html>`;
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
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f7f8;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px;text-align:center;color:#fff;">
    <h1 style="margin:0;font-size:22px;">Thanks for chatting with Ashley!</h1>
    <p style="margin:10px 0 0;opacity:0.9;">Qwillio</p>
  </div>
  <div style="padding:30px;color:#333;">
    <p>Hi ${data.contactName || 'there'},</p>
    <p>Great talking with you about <strong>${data.businessName}</strong>! As promised, here's a quick 2-minute demo of your AI receptionist in action:</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${env.FRONTEND_URL}/demo.html" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:16px 40px;text-decoration:none;border-radius:30px;font-weight:700;font-size:16px;">Watch the Demo</a>
    </div>
    <p>This email also confirms we have the right address for you. No action needed — we'll follow up with more details soon.</p>
    <p>Talk soon!<br><strong>Ashley from Qwillio</strong></p>
    <p style="color:#888;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:15px;">You're receiving this because you spoke with Ashley from Qwillio about ${data.businessName}.</p>
  </div>
</div></body></html>`;

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
    try {
      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        subject: `\u{1F4EC} ${data.businessName} \u2014 Daily Email Digest`,
        html: `
          <h2>Bonjour ${data.contactName},</h2>
          <p>Voici le r\u00E9sum\u00E9 de vos emails des derni\u00E8res 24h :</p>
          <ul>
            <li><strong>${data.totalEmails}</strong> emails re\u00E7us</li>
            <li><strong>${data.urgent}</strong> urgents</li>
            <li><strong>${data.appointment}</strong> rendez-vous</li>
            <li><strong>${data.payment}</strong> paiements</li>
            <li><strong>${data.autoReplied}</strong> trait\u00E9s automatiquement</li>
            <li><strong>${data.needsReview}</strong> en attente de votre revue</li>
          </ul>
          <p><a href="${env.FRONTEND_URL?.split(',')[0]}/dashboard/agent/email">Voir dans votre dashboard \u2192</a></p>
          <p>\u2014 Qwillio AI</p>
        `,
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

      await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: data.to,
        replyTo: env.RESEND_REPLY_TO,
        subject: `${data.contactName}, your AI receptionist is ready — 30 days free`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <img src="https://qwillio.com/favicon.svg" alt="Qwillio" width="40" height="40" style="margin-bottom: 24px;" />
            <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">Hi ${data.contactName},</h1>
            <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
              Great speaking with you! As discussed, Qwillio can handle your incoming calls 24/7 —
              answering questions, booking appointments, and qualifying leads while you focus on your business.
            </p>
            <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
              We recommend the <strong>${planName}</strong> plan for ${data.businessName}.
              Your <strong>first 30 days are completely free</strong> — no commitment, cancel anytime.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.registrationUrl}"
                 style="display: inline-block; background: #7B5CF0; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 16px; font-weight: 600;">
                Start your free trial →
              </a>
            </div>
            <p style="font-size: 14px; color: #8b8ba7; line-height: 1.6;">
              Setup takes less than 5 minutes. No credit card required to start.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 32px 0;" />
            <p style="font-size: 13px; color: #8b8ba7;">
              Questions? Reply to this email or call us anytime.<br />
              — Ashley, Qwillio AI
            </p>
          </div>
        `,
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
