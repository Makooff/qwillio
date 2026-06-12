import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { smsTemplates } from './sms-templates';
import { detectLanguage, getAgentName } from '../config/vapi-templates';

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

    const lang = detectLanguage(prospect.phone);
    const firstName = (prospect.contactName?.split(' ')[0]) || (lang === 'fr' ? 'à vous' : 'there');
    const agentName = getAgentName(lang);
    const registrationLink = registrationUrl || 'https://qwillio.com/register';

    let body: string;
    switch (callOutcome) {
      case 'qualified':
      case 'interested':
        body = smsTemplates.interested({ firstName, agentName, registrationLink, lang });
        break;
      case 'callback_later':
        body = smsTemplates.callback({ firstName, agentName, lang });
        break;
      case 'voicemail':
      case 'no-answer':
        body = smsTemplates.noanswer({ firstName, agentName, businessName: prospect.businessName, lang });
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

    const lang = detectLanguage(prospect.phone);
    const firstName = (prospect.contactName?.split(' ')[0]) || (lang === 'fr' ? 'à vous' : 'there');
    const agentName = getAgentName(lang);
    const body = reason === 'bounce'
      ? smsTemplates.emailBounce({ firstName, agentName, businessName: prospect.businessName, lang })
      : smsTemplates.emailNoOpen({ firstName, agentName, businessName: prospect.businessName, lang });

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

    const lang = detectLanguage(prospect.phone);
    const firstName = (prospect.contactName?.split(' ')[0]) || (lang === 'fr' ? 'à vous' : 'there');
    const body = smsTemplates.exhausted({ firstName, agentName: getAgentName(lang), businessName: prospect.businessName, lang });

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

    const lang = detectLanguage(booking.customerPhone);
    const firstName = (booking.customerName?.split(' ')[0]) || (lang === 'fr' ? 'à vous' : 'there');

    const body = smsTemplates.bookingConfirm({
      firstName,
      businessName: booking.businessName,
      date: booking.bookingDate,
      time: booking.bookingTime,
      service: booking.serviceType,
      lang,
    });

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

    const lang = detectLanguage(booking.customerPhone);
    const firstName = (booking.customerName?.split(' ')[0]) || (lang === 'fr' ? 'à vous' : 'there');

    const body = smsTemplates.bookingReminder({
      firstName,
      businessName: booking.businessName,
      time: booking.bookingTime,
      service: booking.serviceType,
      lang,
    });

    const result = await this.sendSMS(booking.customerPhone, body);
    if (result.success) {
      logger.info(`Booking reminder SMS sent to ${booking.customerPhone} for ${booking.businessName}`);
    }
    return result.success;
  }
}

export const smsService = new SmsService();
