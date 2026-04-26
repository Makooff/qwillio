import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class SmsService {
  private twilioClient: any = null;

  private getTwilioClient() {
    if (this.twilioClient) return this.twilioClient;
    try {
      const twilio = require('twilio');
      // Primary auth: Account SID + Auth Token
      if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
        this.twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
        return this.twilioClient;
      }
      // Fallback: API Key (SK…) + Secret. Twilio's Node SDK still needs
      // the Account SID for the request URL — derive it from any AC…
      // value present in the env (some deployments mis-name vars).
      if (env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET) {
        const possibleAcSid =
          env.TWILIO_ACCOUNT_SID ||
          Object.values(process.env).find(v => typeof v === 'string' && /^AC[a-f0-9]{32}$/.test(v));
        if (possibleAcSid) {
          this.twilioClient = twilio(env.TWILIO_API_KEY_SID, env.TWILIO_API_KEY_SECRET, { accountSid: possibleAcSid });
          return this.twilioClient;
        }
        logger.warn('[SMS] TWILIO_API_KEY_SID/SECRET set but no TWILIO_ACCOUNT_SID found — cannot init Twilio client');
      } else {
        logger.warn('[SMS] Twilio not configured (need TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN, or TWILIO_API_KEY_SID + SECRET + accountSid)');
      }
    } catch (e: any) {
      logger.warn('Twilio SDK init failed, SMS disabled:', e?.message);
    }
    return this.twilioClient;
  }

  /**
   * Send an SMS via Twilio
   */
  async sendSMS(to: string, body: string, metadata?: { messageType?: string; prospectId?: string; clientId?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!env.SMS_ENABLED) {
      logger.debug('SMS disabled, skipping send');
      return { success: false, error: 'SMS_ENABLED=false' };
    }

    const client = this.getTwilioClient();
    if (!client) {
      const msg = 'Twilio client not initialized — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN';
      logger.warn(`[SMS] ${msg}`);
      return { success: false, error: msg };
    }
    if (!env.TWILIO_PHONE_NUMBER) {
      return { success: false, error: 'TWILIO_PHONE_NUMBER not set' };
    }

    try {
      const message = await client.messages.create({
        body,
        from: env.TWILIO_PHONE_NUMBER,
        to,
      });

      logger.info(`SMS sent to ${to}: ${message.sid}`);

      // Log SMS attempt
      await prisma.smsLog.create({
        data: {
          to,
          body: body.substring(0, 1600),
          messageType: metadata?.messageType || 'unknown',
          twilioSid: message.sid,
          status: 'sent',
          prospectId: metadata?.prospectId || null,
          clientId: metadata?.clientId || null,
        },
      }).catch((err: any) => logger.warn('Failed to log SMS:', err));

      // Track cost in daily analytics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.analyticsDaily.upsert({
        where: { date: today },
        update: {
          smsSent: { increment: 1 },
          costTwilioSms: { increment: 0.0079 }, // ~$0.0079 per SMS in US
        },
        create: {
          date: today,
          smsSent: 1,
          costTwilioSms: 0.0079,
        },
      });

      return { success: true, messageId: message.sid };
    } catch (error: any) {
      // Surface the actual Twilio error so debug is fast.
      // Common ones:
      //   21408 — "Permission to send an SMS has not been enabled for the region indicated by the 'To' number"
      //   21211 — Invalid 'To' phone number
      //   21606 — 'From' number is not a valid, SMS-capable Twilio phone number
      //   21610 — STOP from recipient
      //   20003 — Authentication Error (bad SID / token)
      const code = error?.code ? ` [Twilio ${error.code}]` : '';
      const msg = `${error?.message || 'Twilio error'}${code}`;
      logger.error(`SMS send failed to ${to}: ${msg}`);

      // Log failed SMS attempt
      await prisma.smsLog.create({
        data: {
          to,
          body: body.substring(0, 1600),
          messageType: metadata?.messageType || 'unknown',
          status: 'failed',
          errorMsg: msg.slice(0, 500),
          prospectId: metadata?.prospectId || null,
          clientId: metadata?.clientId || null,
        },
      }).catch((err: any) => logger.warn('Failed to log SMS error:', err));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.analyticsDaily.upsert({
        where: { date: today },
        update: { smsFailed: { increment: 1 } },
        create: { date: today, smsFailed: 1 },
      });

      return { success: false, error: msg };
    }
  }

  /**
   * Send post-call SMS based on outcome
   */
  async sendPostCallSMS(prospect: {
    phone: string | null;
    businessName: string;
    contactName: string | null;
    smsOptedOut?: boolean;
  }, callOutcome: string, registrationUrl?: string): Promise<boolean> {
    if (!prospect.phone || prospect.smsOptedOut) return false;

    let body: string;
    const name = prospect.contactName || 'there';
    const regLink = registrationUrl || 'https://qwillio.com/register';

    switch (callOutcome) {
      case 'qualified':
      case 'interested':
        body = `Hi ${name}! Thanks for chatting with Ashley from Qwillio. Start your free 30-day trial here: ${regLink} — No commitment, cancel anytime.`;
        break;
      case 'callback_later':
        body = `Hi ${name}! Ashley from Qwillio here. Sorry we couldn't connect fully today. We'll follow up soon. In the meantime, learn more at qwillio.com`;
        break;
      case 'voicemail':
      case 'no-answer':
        body = `Hi ${name}! Ashley from Qwillio tried to reach you about ${prospect.businessName}. We help businesses never miss a call with AI. Learn more: qwillio.com`;
        break;
      default:
        return false; // Don't SMS for not_interested, wrong_number, etc.
    }

    const result = await this.sendSMS(prospect.phone, body);
    return result.success;
  }

  /**
   * Send SMS fallback when email bounces or no open after 24h.
   * Asks the prospect to reply with their correct email address.
   */
  async sendEmailFallbackSMS(prospect: {
    phone: string | null;
    businessName: string;
    contactName: string | null;
    smsOptedOut?: boolean;
  }, reason: 'bounce' | 'no_open'): Promise<boolean> {
    if (!prospect.phone || prospect.smsOptedOut) return false;

    const name = prospect.contactName || 'there';
    const body = reason === 'bounce'
      ? `Hi ${name}! Ashley from Qwillio here. I tried sending you the demo video for ${prospect.businessName} but the email bounced. Could you reply with your correct email? Thanks!`
      : `Hi ${name}! Ashley from Qwillio — I sent you a demo video for ${prospect.businessName} yesterday but it looks like it might have gone to spam. Could you reply with your email and I'll resend it? Thanks!`;

    const result = await this.sendSMS(prospect.phone, body);
    return result.success;
  }

  /**
   * Send final SMS to exhausted prospects (max call attempts reached, no answer)
   * Gives them a way to engage on their own terms.
   */
  async sendExhaustedSMS(prospect: {
    phone: string | null;
    businessName: string;
    contactName: string | null;
    smsOptedOut?: boolean;
  }): Promise<boolean> {
    if (!prospect.phone || prospect.smsOptedOut) return false;

    const name = prospect.contactName || 'there';
    const body = `Hi ${name}! Ashley from Qwillio here — I tried reaching you a couple times about ${prospect.businessName}. No worries at all! If you're ever curious how AI can help you never miss a call again, here's a quick 2-min video: qwillio.com/demo. Have a great day!`;

    const result = await this.sendSMS(prospect.phone, body);
    return result.success;
  }
  /**
   * Send booking confirmation SMS to customer right after appointment is booked.
   */
  async sendBookingConfirmationSMS(booking: {
    customerPhone: string;
    customerName: string;
    businessName: string;
    bookingDate: string;
    bookingTime: string | null;
    serviceType: string | null;
  }): Promise<boolean> {
    if (!booking.customerPhone) return false;

    const name = booking.customerName || 'there';
    const date = new Date(booking.bookingDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const time = booking.bookingTime ? ` at ${booking.bookingTime}` : '';
    const service = booking.serviceType ? ` (${booking.serviceType})` : '';

    const body = `Hi ${name}! Your appointment at ${booking.businessName} is confirmed for ${date}${time}${service}. To reschedule or cancel, please contact ${booking.businessName} directly. — Powered by Qwillio`;

    const result = await this.sendSMS(booking.customerPhone, body);
    if (result.success) {
      logger.info(`Booking confirmation SMS sent to ${booking.customerPhone} for ${booking.businessName}`);
    }
    return result.success;
  }

  /**
   * Send booking reminder SMS 24h before appointment.
   */
  async sendBookingReminderSMS(booking: {
    customerPhone: string;
    customerName: string;
    businessName: string;
    bookingDate: string;
    bookingTime: string | null;
    serviceType: string | null;
  }): Promise<boolean> {
    if (!booking.customerPhone) return false;

    const name = booking.customerName || 'there';
    const time = booking.bookingTime ? ` at ${booking.bookingTime}` : ' tomorrow';
    const service = booking.serviceType ? ` for your ${booking.serviceType}` : '';

    const body = `Reminder: Hi ${name}! Your appointment at ${booking.businessName} is${time}${service}. See you soon! — Powered by Qwillio`;

    const result = await this.sendSMS(booking.customerPhone, body);
    if (result.success) {
      logger.info(`Booking reminder SMS sent to ${booking.customerPhone} for ${booking.businessName}`);
    }
    return result.success;
  }
}

export const smsService = new SmsService();
