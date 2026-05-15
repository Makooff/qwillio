import { logger } from '../config/logger';
import { env } from '../config/env';
import { prisma } from '../config/database';

// Twilio WhatsApp uses same credentials as SMS but different number prefix.
// Outgoing number: 'whatsapp:+14155238886' (sandbox) or real WA business number.
// Recipient: 'whatsapp:+1xxxxxxxxxx'

interface WhatsAppMessage {
  to: string;
  body: string;
  prospectId?: string;
  messageType?: string;
}

const WA_TEMPLATES = {
  // After no answer / voicemail
  voicemail_followup: (name: string, niche: string) =>
    `Bonjour ${name} 👋 Je viens de vous laisser un message. Qwillio aide les ${niche} à obtenir plus de clients grâce à l'IA. Intéressé(e) ? Répondez ici ou rappellez-moi 📲`,

  // After interest detected in call
  interest_followup: (name: string) =>
    `Bonjour ${name}, merci pour notre échange ! Comme promis, voici le lien pour choisir un créneau de démo : https://qwillio.com/book — À très vite ! 🚀`,

  // Booking confirmation
  booking_confirmed: (name: string, slot: string) =>
    `✅ Confirmé ! Notre équipe vous appellera ${slot}. En cas de changement : https://qwillio.com/book\n— Équipe Qwillio`,

  // 48h re-engagement (no response to SMS)
  reengagement: (name: string) =>
    `Bonjour ${name} ! Juste un petit rappel 🙂 Qwillio automatise votre prospection avec l'IA. On peut vous trouver 3-5 clients/mois. Toujours intéressé(e) ?`,
};

export class WhatsAppService {
  private readonly fromNumber: string;
  private readonly enabled: boolean;

  constructor() {
    this.fromNumber = env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    this.enabled = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_NUMBER);
    if (!this.enabled) {
      logger.warn('[WhatsApp] Disabled — set TWILIO_WHATSAPP_NUMBER to enable');
    }
  }

  async sendMessage({ to, body, prospectId, messageType }: WhatsAppMessage): Promise<boolean> {
    if (!this.enabled) return false;

    const waTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    try {
      const accountSid = env.TWILIO_ACCOUNT_SID;
      const authToken = env.TWILIO_AUTH_TOKEN;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: this.fromNumber,
            To: waTo,
            Body: body,
          }).toString(),
        }
      );

      const data = await res.json() as { sid?: string; error_code?: number; message?: string };

      if (!res.ok) {
        logger.error(`[WhatsApp] Send failed: ${data.error_code} — ${data.message}`);
        return false;
      }

      // Log to SmsLog table (reuse existing table, add wa_ prefix to messageType)
      if (prospectId) {
        await prisma.smsLog.create({
          data: {
            to,
            body,
            messageType: `wa_${messageType ?? 'general'}`,
            status: 'sent',
            twilioSid: data.sid ?? null,
            prospectId,
          },
        }).catch(() => {}); // Non-blocking
      }

      logger.info(`[WhatsApp] Sent to ${to}: ${body.slice(0, 50)}...`);
      return true;
    } catch (err) {
      logger.error(`[WhatsApp] Error sending to ${to}:`, err);
      return false;
    }
  }

  getTemplate(type: keyof typeof WA_TEMPLATES, ...args: string[]): string {
    const fn = WA_TEMPLATES[type] as (...a: string[]) => string;
    return fn(...args);
  }

  async sendVoicemailFollowup(prospect: {
    id: string;
    phone: string;
    businessName: string;
    niche: string | null;
  }): Promise<boolean> {
    const body = this.getTemplate('voicemail_followup', prospect.businessName, prospect.niche ?? 'entreprises');
    return this.sendMessage({ to: prospect.phone, body, prospectId: prospect.id, messageType: 'voicemail_followup' });
  }

  async sendInterestFollowup(prospect: {
    id: string;
    phone: string;
    businessName: string;
  }): Promise<boolean> {
    const body = this.getTemplate('interest_followup', prospect.businessName);
    return this.sendMessage({ to: prospect.phone, body, prospectId: prospect.id, messageType: 'interest_followup' });
  }

  async sendReengagement(prospect: {
    id: string;
    phone: string;
    businessName: string;
  }): Promise<boolean> {
    const body = this.getTemplate('reengagement', prospect.businessName);
    return this.sendMessage({ to: prospect.phone, body, prospectId: prospect.id, messageType: 'reengagement' });
  }

  /**
   * Process batch of prospects that:
   * - Had a voicemail call 24h ago
   * - Haven't received a WA message yet
   * - Have a valid phone number
   */
  async processVoicemailFollowups(): Promise<number> {
    if (!this.enabled) return 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find prospects that got a voicemail call 24-48h ago and no WA sent yet.
    // Prospect schema uses lastCallDate (not lastCallAt).
    const prospects = await prisma.prospect.findMany({
      where: {
        phone: { not: null },
        status: { in: ['contacted', 'voicemail'] },
        lastCallDate: { gte: twoDaysAgo, lte: oneDayAgo },
        smsLogs: {
          none: {
            messageType: { startsWith: 'wa_' },
            createdAt: { gte: twoDaysAgo },
          },
        },
      },
      take: 20,
      select: { id: true, phone: true, businessName: true, niche: true },
    });

    let sent = 0;
    for (const p of prospects) {
      if (!p.phone) continue;
      const ok = await this.sendVoicemailFollowup({ ...p, phone: p.phone });
      if (ok) sent++;
      await new Promise(r => setTimeout(r, 500)); // Rate limit: 2/sec
    }

    if (sent > 0) logger.info(`[WhatsApp] Voicemail followups sent: ${sent}`);
    return sent;
  }

  /**
   * Process re-engagement: prospects interested 3+ days ago, no response.
   */
  async processReengagement(): Promise<number> {
    if (!this.enabled) return 0;

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const prospects = await prisma.prospect.findMany({
      where: {
        phone: { not: null },
        status: 'interested',
        lastCallDate: { gte: sevenDaysAgo, lte: threeDaysAgo },
        smsLogs: {
          none: {
            messageType: 'wa_reengagement',
            createdAt: { gte: sevenDaysAgo },
          },
        },
      },
      take: 15,
      select: { id: true, phone: true, businessName: true },
    });

    let sent = 0;
    for (const p of prospects) {
      if (!p.phone) continue;
      const ok = await this.sendReengagement({ ...p, phone: p.phone });
      if (ok) sent++;
      await new Promise(r => setTimeout(r, 500));
    }

    if (sent > 0) logger.info(`[WhatsApp] Re-engagement sent: ${sent}`);
    return sent;
  }
}

export const whatsAppService = new WhatsAppService();
