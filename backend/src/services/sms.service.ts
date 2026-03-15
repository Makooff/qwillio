import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class SmsService {
  private twilioClient: any = null;

  private getTwilioClient() {
    if (!this.twilioClient && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      } catch (e) {
        logger.warn('Twilio SDK not available, SMS disabled');
      }
    }
    return this.twilioClient;
  }

  /**
   * Send an SMS via Twilio
   */
  async sendSMS(to: string, body: string, metadata?: { messageType?: string; prospectId?: string; clientId?: string }): Promise<{ success: boolean; messageId?: string }> {
    if (!env.SMS_ENABLED) {
      logger.debug('SMS disabled, skipping send');
      return { success: false };
    }

    const client = this.getTwilioClient();
    if (!client || !env.TWILIO_PHONE_NUMBER) {
      logger.warn('Twilio not configured, cannot send SMS');
      return { success: false };
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
      logger.error(`SMS send failed to ${to}:`, error.message);

      // Log failed SMS attempt
      await prisma.smsLog.create({
        data: {
          to,
          body: body.substring(0, 1600),
          messageType: metadata?.messageType || 'unknown',
          status: 'failed',
          errorMsg: error.message,
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

      return { success: false };
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
  }, callOutcome: string, quoteLink?: string): Promise<boolean> {
    if (!prospect.phone || prospect.smsOptedOut) return false;

    let body: string;
    const name = prospect.contactName || 'there';

    switch (callOutcome) {
      case 'qualified':
      case 'interested':
        body = quoteLink
          ? `Hi ${name}! Thanks for chatting with Ashley from Qwillio. Here's your personalized quote for ${prospect.businessName}: ${quoteLink} — Feel free to reply with any questions!`
          : `Hi ${name}! Thanks for chatting with Ashley from Qwillio about ${prospect.businessName}. We'll send your personalized quote shortly. Reply with any questions!`;
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
