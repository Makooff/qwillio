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
  async sendSMS(to: string, body: string): Promise<{ success: boolean; messageId?: string }> {
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
  }, callOutcome: string, quoteLink?: string): Promise<boolean> {
    if (!prospect.phone) return false;

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
}

export const smsService = new SmsService();
