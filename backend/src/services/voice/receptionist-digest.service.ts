import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { emailService } from '../email.service';
import { smsService } from '../sms.service';
import { smsTemplates } from '../sms-templates';
import { brandWrap, brandTitle, brandText, brandList, brandButton, brandSmall } from '../email-template';
import type { Finding, LearningReport } from './receptionist-learning.service';

/**
 * The client-facing half of `receptionist-learning`.
 *
 * The learning service writes for whoever operates the platform: its findings
 * name env vars, latency stages and cache behaviour. Until now that was the
 * only outlet, so "chaque semaine, elle vous dit ce qui coince" was a promise
 * nothing in the code kept. This module keeps it: it drops everything the
 * client cannot act on, says the rest in their language, and sends it to the
 * two places a small business owner actually looks, their inbox and their
 * phone.
 *
 * Findings about our own plumbing (latency attribution, prompt cache, a tool
 * that is not the calendar) stay where they belong, in the logs and Discord.
 */

type Lang = 'fr' | 'en';

/** A finding rewritten for the person who owns the business. */
interface ClientLine {
  fr: string;
  en: string;
}

export interface DigestClient {
  id: string;
  businessName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  agentLanguage?: string | null;
  country?: string | null;
  vapiConfig?: unknown;
}

export interface DigestResult {
  /** Client-actionable findings kept out of the raw report. */
  items: number;
  email: boolean;
  sms: boolean;
  skipped?: 'no_items' | 'already_sent';
}

interface DigestState {
  /** ISO week the client was last told about, e.g. 2026-W32. */
  week: string;
  sentAt: string;
}

/** Tools whose failure the client, and only the client, can repair. */
const CALENDAR_TOOLS = ['checkAvailability', 'bookAppointment'];

/**
 * Only these codes reach the client. A finding absent here is not less
 * important, it is simply ours to fix rather than theirs.
 */
function clientLine(finding: Finding): ClientLine | null {
  switch (finding.code) {
    case 'verbose_agent':
      return {
        fr: 'Ses réponses sont trop longues : les appelants la coupent en pleine phrase.',
        en: 'Her answers run too long: callers cut in mid-sentence.',
      };
    case 'knowledge_gaps':
      return {
        fr: 'Des questions reviennent sans réponse dans sa base de connaissances.',
        en: 'Questions keep coming back that her knowledge base cannot answer.',
      };
    case 'upset_callers':
      return {
        fr: 'Des appelants arrivent déjà agacés : ce qui coince se passe avant l\'appel (attente, ligne non répondue, relance restée sans suite).',
        en: 'Callers arrive already annoyed: what goes wrong happens before the call (hold times, an unanswered line, a follow-up that never landed).',
      };
    case 'tool_failures':
      // A failing calendar is the one tool failure the client owns: the Google
      // token is theirs to reconnect. Any other failing tool is our bug and
      // telling them about it would only be noise.
      if (!finding.subject || !CALENDAR_TOOLS.includes(finding.subject)) return null;
      return {
        fr: 'Votre agenda ne répond plus : sur certains appels, elle n\'a pas pu proposer de créneau. Reconnectez Google Agenda.',
        en: 'Your calendar stopped responding: on some calls she could not offer a slot. Reconnect Google Calendar.',
      };
    default:
      return null;
  }
}

/** ISO-8601 week in UTC. The Sunday 2am run lands on the week that just ended. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

class ReceptionistDigestService {
  /**
   * Tell one client what their receptionist did badly this week.
   *
   * Both channels are attempted independently: a bounced email must not cost
   * them the SMS, and vice versa.
   */
  async send(client: DigestClient, report: LearningReport, now: Date = new Date()): Promise<DigestResult> {
    const lang = this.clientLanguage(client);
    const lines = report.findings
      .map(clientLine)
      .filter((l): l is ClientLine => l !== null)
      .map(l => l[lang]);

    if (!lines.length) return { items: 0, email: false, sms: false, skipped: 'no_items' };

    const week = isoWeekKey(now);
    const state = (client.vapiConfig as { weeklyDigest?: DigestState } | null | undefined)?.weeklyDigest;
    if (state?.week === week) {
      return { items: lines.length, email: false, sms: false, skipped: 'already_sent' };
    }

    const link = `${env.FRONTEND_URL?.split(',')[0] || 'https://qwillio.com'}/dashboard/receptionist`;
    const email = await this.sendEmail(client, lines, lang, link);
    const sms = await this.sendSms(client, lines.length, lang, link);

    // Only claim the week once something actually left the building. A Resend
    // or Twilio outage otherwise costs the client that week silently, and the
    // next run would consider it delivered.
    if (email || sms) await this.markSent(client.id, week, now);

    logger.info(
      `[ReceptionistDigest] ${client.businessName}: ${lines.length} item(s), email=${email}, sms=${sms}`
    );
    return { items: lines.length, email, sms };
  }

  private async sendEmail(client: DigestClient, lines: string[], lang: Lang, link: string): Promise<boolean> {
    if (!client.contactEmail) return false;

    const name = client.contactName?.split(' ')[0] || (lang === 'fr' ? 'bonjour' : 'there');
    const isFr = lang === 'fr';
    const html = brandWrap({
      title: isFr ? 'Le point de la semaine' : 'This week on your receptionist',
      preheader: isFr
        ? `Ce qui a coincé chez ${client.businessName} cette semaine.`
        : `What went wrong at ${client.businessName} this week.`,
      body: [
        brandTitle(isFr ? 'Ce qui coince cette semaine' : 'What is off this week'),
        brandText(
          isFr
            ? `Bonjour ${name}, nous avons écouté les appels de <strong>${client.businessName}</strong> des sept derniers jours. Voici ce qui mérite une correction :`
            : `Hi ${name}, we went through the calls at <strong>${client.businessName}</strong> over the last seven days. Here is what deserves a fix:`
        ),
        brandList(lines),
        brandText(
          isFr
            ? 'Chaque point se règle dans le chat de configuration, en une phrase. Elle ne se réécrit pas toute seule : vous décidez.'
            : 'Each one is fixed in the setup chat, in one sentence. She does not rewrite herself: you decide.'
        ),
        brandButton(isFr ? 'Corriger dans le chat' : 'Fix it in the chat', link),
        brandSmall(isFr ? '— L\'équipe Qwillio' : '— The Qwillio team'),
      ].join(''),
    });

    try {
      await emailService.send({
        to: client.contactEmail,
        subject: isFr
          ? `${client.businessName} : le point de la semaine sur votre réceptionniste`
          : `${client.businessName}: this week on your receptionist`,
        html,
        tags: [{ name: 'campaign', value: 'receptionist_digest' }],
      });
      return true;
    } catch (error) {
      logger.error(`[ReceptionistDigest] email to ${client.contactEmail} failed:`, error);
      return false;
    }
  }

  private async sendSms(client: DigestClient, count: number, lang: Lang, link: string): Promise<boolean> {
    if (!client.contactPhone) return false;

    const body = smsTemplates.weeklyInsights({
      businessName: client.businessName,
      count,
      link,
      lang,
    });

    try {
      const result = await smsService.sendSMS(client.contactPhone, body, {
        messageType: 'receptionist_digest',
        clientId: client.id,
      });
      return result.success;
    } catch (error) {
      logger.error(`[ReceptionistDigest] SMS to ${client.contactPhone} failed:`, error);
      return false;
    }
  }

  /**
   * Remember the week inside vapiConfig rather than a new table: the report
   * itself is not worth persisting, only the fact that we already spoke.
   * Re-read immediately before writing so a concurrent update to the same JSON
   * column is not clobbered (same reason as quota-alert).
   */
  private async markSent(clientId: string, week: string, now: Date): Promise<void> {
    try {
      const fresh = await prisma.client.findUnique({ where: { id: clientId }, select: { vapiConfig: true } });
      const config = (fresh?.vapiConfig as Record<string, unknown> | null) || {};
      await prisma.client.update({
        where: { id: clientId },
        data: { vapiConfig: { ...config, weeklyDigest: { week, sentAt: now.toISOString() } } },
      });
    } catch (error) {
      logger.warn(`[ReceptionistDigest] could not record the digest week for ${clientId}:`, error);
    }
  }

  /** Their agent language first, then the country default, same rule as quota-alert. */
  private clientLanguage(client: DigestClient): Lang {
    if (client.agentLanguage === 'fr') return 'fr';
    if (client.agentLanguage === 'en') return 'en';
    return ['FR', 'BE', 'LU', 'MC', 'CH'].includes((client.country || '').toUpperCase()) ? 'fr' : 'en';
  }
}

export const receptionistDigestService = new ReceptionistDigestService();
