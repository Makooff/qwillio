/**
 * Follow-Up Sequences Service — Part 6 of the prospecting spec
 * Handles:
 *   - Post-call SMS (score >= 5, immediately after call)
 *   - Post-voicemail SMS (2h after attempt 3)
 *   - Follow-up email sequence (score >= 5, day 0 / day 3 / day 7)
 *
 * Niche-specific send times:
 *   Plumber/HVAC: 8am | Dental: 9am | Salon: 10am | Restaurant: 2pm
 *   Law firm: 11am | Garage: 8am | Hotel: 2pm
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { smsService } from './sms.service';
import { emailService } from './email.service';
import { discordService } from './discord.service';

// ─── Niche → preferred send hour (local time) ─────────────
const NICHE_SEND_HOUR: Record<string, number> = {
  home_services: 8,
  plumber: 8,
  hvac: 8,
  electrician: 8,
  dental: 9,
  dentist: 9,
  hair_salon: 10,
  salon: 10,
  restaurant: 14,
  law_firm: 11,
  lawyer: 11,
  auto_garage: 8,
  garage: 8,
  hotel: 14,
  boutique_hotel: 14,
};

// ─── Email sequence subjects ───────────────────────────────
const EMAIL_SEQUENCE: Array<{ dayOffset: number; subject: string; bodyKey: string }> = [
  { dayOffset: 0, subject: 'Your AI receptionist demo — Qwillio', bodyKey: 'demo' },
  { dayOffset: 3, subject: 'How {{niche}} businesses like yours use Qwillio', bodyKey: 'case_study' },
  { dayOffset: 7, subject: 'Last chance: free month for {{business_name}}', bodyKey: 'last_chance' },
];

export class FollowUpSequencesService {
  /** Called immediately after a completed call with interest score */
  async triggerPostCallSequence(
    prospectId: string,
    interestScore: number,
    attemptNumber: number,
    detectionResult: string,
  ): Promise<void> {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        businessName: true,
        phone: true,
        email: true,
        contactName: true,
        niche: true,
        businessType: true,
        city: true,
        timezone: true,
        language: true,
        smsOptedOut: true,
        emailUnsubscribed: true,
      },
    });

    if (!prospect) return;

    const niche = prospect.niche ?? prospect.businessType ?? 'home_services';
    const lang = (prospect.language ?? 'en') as 'en' | 'fr';
    const demoLink = lang === 'fr' ? env.DEMO_LINK_FR : env.DEMO_LINK_EN;
    const firstName = prospect.contactName?.split(' ')[0] ?? 'there';
    const agentName = lang === 'fr' ? 'Marie' : 'Ashley';

    // ─── Post-call SMS (score >= 5) ───────────────────────
    if (interestScore >= 5 && prospect.phone && !prospect.smsOptedOut) {
      const smsBody = lang === 'fr'
        ? `Bonjour ${firstName}, c'est ${agentName} de Qwillio. Sympa d'avoir échangé ! Voici une démo rapide de comment on gère les appels pour les ${niche} : ${demoLink}. Premier mois offert. Répondez STOP pour vous désinscrire.`
        : `Hi ${firstName}, it's ${agentName} from Qwillio. Great speaking with you! Here's a quick 2-min demo of how we handle calls for ${niche} businesses like yours: ${demoLink}. First month free — happy to set it up this week. Reply STOP to opt out.`;

      await this.scheduleOrSend('sms', prospect.id, 1, new Date(), smsBody, prospect.phone);
    }

    // ─── Post-voicemail SMS (attempt 3, 2h delay) ─────────
    if (
      attemptNumber === 3 &&
      detectionResult === 'voicemail' &&
      prospect.phone &&
      !prospect.smsOptedOut
    ) {
      const smsBody = lang === 'fr'
        ? `Bonjour, j'ai laissé un message vocal concernant Qwillio — réceptionniste IA pour les ${niche}. Premier mois offert. Voir la démo : ${demoLink}. Répondez STOP pour vous désinscrire.`
        : `Hi, I left you a voicemail about Qwillio — AI receptionist for ${niche} businesses. Never miss a customer call again. First month free. See how it works: ${demoLink}. Reply STOP to opt out.`;

      const sendAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await this.scheduleOrSend('sms_voicemail', prospect.id, 3, sendAt, smsBody, prospect.phone);
    }

    // ─── Email sequence (score >= 5) ──────────────────────
    if (interestScore >= 5 && prospect.email && !prospect.emailUnsubscribed) {
      const tz = prospect.timezone ?? 'America/Chicago';
      const sendHour = NICHE_SEND_HOUR[niche] ?? 9;

      for (const seq of EMAIL_SEQUENCE) {
        const scheduledAt = this.buildSendTime(seq.dayOffset, sendHour, tz);
        await this.scheduleOrSend('email', prospect.id, seq.dayOffset + 1, scheduledAt, seq.subject, prospect.email);
      }
    }
  }

  /** Process all pending follow-ups that are due */
  async processDue(): Promise<number> {
    const now = new Date();
    const due = await prisma.followUpSequence.findMany({
      where: {
        sentAt: null,
        scheduledAt: { lte: now },
      },
      include: {
        prospect: {
          select: {
            id: true,
            businessName: true,
            phone: true,
            email: true,
            contactName: true,
            niche: true,
            businessType: true,
            city: true,
            language: true,
            smsOptedOut: true,
            emailUnsubscribed: true,
          },
        },
      },
      take: 50,
    });

    let sent = 0;

    for (const item of due) {
      const p = item.prospect;
      const niche = p.niche ?? p.businessType ?? 'home_services';
      const lang = (p.language ?? 'en') as 'en' | 'fr';
      const demoLink = lang === 'fr' ? env.DEMO_LINK_FR : env.DEMO_LINK_EN;
      const firstName = p.contactName?.split(' ')[0] ?? 'there';
      const agentName = lang === 'fr' ? 'Marie' : 'Ashley';

      try {
        let success = false;

        if ((item.type === 'sms' || item.type === 'sms_voicemail') && p.phone && !p.smsOptedOut) {
          const body = item.type === 'sms_voicemail'
            ? (lang === 'fr'
              ? `Bonjour, j'ai laissé un message vocal concernant Qwillio — réceptionniste IA pour les ${niche}. Premier mois offert. Voir la démo : ${demoLink}. Répondez STOP.`
              : `Hi, I left you a voicemail about Qwillio — AI receptionist for ${niche} businesses. First month free. See how: ${demoLink}. Reply STOP to opt out.`)
            : (lang === 'fr'
              ? `Bonjour ${firstName}, c'est ${agentName} de Qwillio. Démo rapide : ${demoLink}. Premier mois offert. Répondez STOP pour vous désinscrire.`
              : `Hi ${firstName}, it's ${agentName} from Qwillio. Quick demo: ${demoLink}. First month free. Reply STOP to opt out.`);

          const result = await smsService.sendSMS(p.phone, body, {
            messageType: item.type,
            prospectId: p.id,
          });
          success = result.success;
        } else if (item.type === 'email' && p.email && !p.emailUnsubscribed) {
          // Determine which email step this is
          const emailSubject = item.type === 'email' ? this.buildEmailSubject(item.step, p.businessName, niche, lang) : '';
          const emailBody = this.buildEmailBody(item.step, p.businessName, niche, lang, demoLink, firstName, agentName);

          try {
            await emailService.sendFollowUpEmail(p.id, p.email, emailSubject, emailBody);
            success = true;
          } catch {
            success = false;
          }
        }

        if (success) {
          await prisma.followUpSequence.update({
            where: { id: item.id },
            data: { sentAt: new Date() },
          });
          sent++;
        }
      } catch (err) {
        logger.error(`[FollowUp] Failed to send follow-up ${item.id}:`, err);
      }
    }

    if (sent > 0) {
      logger.info(`[FollowUp] Sent ${sent} follow-up(s)`);
    }

    return sent;
  }

  /** Schedule or immediately send a follow-up */
  private async scheduleOrSend(
    type: string,
    prospectId: string,
    step: number,
    scheduledAt: Date,
    content: string,
    recipient: string,
  ): Promise<void> {
    // Avoid duplicate steps
    const existing = await prisma.followUpSequence.findFirst({
      where: { prospectId, type, step },
    });
    if (existing) return;

    await prisma.followUpSequence.create({
      data: { prospectId, type, step, scheduledAt },
    });
  }

  /** Compute send time: N days from now at the given local hour */
  private buildSendTime(dayOffset: number, localHour: number, timezone: string): Date {
    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + dayOffset);

    // Set local hour in prospect timezone
    const tzOffset = this.getTimezoneOffsetHours(timezone);
    target.setUTCHours(localHour - tzOffset, 0, 0, 0);

    // If dayOffset is 0 and the time has passed, send in 15 min
    if (dayOffset === 0 && target <= now) {
      return new Date(Date.now() + 15 * 60 * 1000);
    }

    return target;
  }

  private getTimezoneOffsetHours(timezone: string): number {
    const offsets: Record<string, number> = {
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Los_Angeles': -8,
      'America/Phoenix': -7,
      'America/Anchorage': -9,
      'Pacific/Honolulu': -10,
    };
    return offsets[timezone] ?? -6;
  }

  private buildEmailSubject(step: number, businessName: string, niche: string, lang: 'en' | 'fr'): string {
    const subjects: Record<number, Record<'en' | 'fr', string>> = {
      1: { en: 'Your AI receptionist demo — Qwillio', fr: 'Votre démo réceptionniste IA — Qwillio' },
      2: { en: `How ${niche} businesses use Qwillio`, fr: `Comment les ${niche} utilisent Qwillio` },
      3: { en: `Last chance: free month for ${businessName}`, fr: `Dernière chance : mois offert pour ${businessName}` },
    };
    return subjects[step]?.[lang] ?? subjects[1][lang];
  }

  private buildEmailBody(
    step: number,
    businessName: string,
    niche: string,
    lang: 'en' | 'fr',
    demoLink: string,
    firstName: string,
    agentName: string,
  ): string {
    if (lang === 'fr') {
      if (step === 1) return `Bonjour ${firstName},\n\nComme promis, voici la démo de Qwillio pour les ${niche} :\n${demoLink}\n\nPremier mois offert — aucun frais de setup.\n\n${agentName}, Qwillio`;
      if (step === 2) return `Bonjour ${firstName},\n\nVoici comment des ${niche} comme vous utilisent Qwillio pour ne plus jamais manquer un appel client.\n\nDémo : ${demoLink}\n\n${agentName}, Qwillio`;
      return `Bonjour ${firstName},\n\nDernière chance d'activer votre mois gratuit pour ${businessName}.\n\nDémo : ${demoLink}\n\n${agentName}, Qwillio`;
    }

    if (step === 1) return `Hi ${firstName},\n\nAs promised, here's the Qwillio demo for ${niche} businesses:\n${demoLink}\n\nFirst month completely free — no setup fee.\n\n${agentName}, Qwillio`;
    if (step === 2) return `Hi ${firstName},\n\nHere's how ${niche} businesses like yours are using Qwillio to never miss a customer call.\n\nDemo: ${demoLink}\n\n${agentName}, Qwillio`;
    return `Hi ${firstName},\n\nLast chance to activate your free month for ${businessName}.\n\nDemo: ${demoLink}\n\n${agentName}, Qwillio`;
  }
}

export const followUpSequencesService = new FollowUpSequencesService();
