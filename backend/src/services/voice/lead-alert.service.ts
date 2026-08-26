import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { smsService } from '../sms.service';
import { emailService } from '../email.service';
import type { VoiceLanguage } from './speech-plans';

/**
 * Prévenir le gérant qu'un appel vient de produire un lead.
 *
 * Le trou que ce module bouche est le plus grave qu'on ait trouvé, et il n'est
 * pas subtil: `captureLead` écrivait l'activité CRM, écrivait la mémoire de
 * l'appelant, puis rendait la main **sans prévenir qui que ce soit**. Le champ
 * `urgency` était relevé pendant l'appel et jamais relu nulle part. Le seul
 * message temps réel du chemin vocal partait au TRANSFERT, donc jamais quand
 * l'agent avait fait son travail tout seul.
 *
 * Concrètement, le gérant l'apprenait au digest HEBDOMADAIRE. « L'IA répond
 * quand vous n'êtes pas là » ne vaut rien si vous l'apprenez six jours plus
 * tard, et c'est la promesse de base du produit, pas une option.
 *
 * ── Pourquoi à la FIN de l'appel, et non pendant ────────────────────────────
 *
 * `captureLead` s'exécute pendant que l'appelant attend une réponse: c'est le
 * chemin critique, et y ajouter un envoi de SMS le rallongerait pour tout le
 * monde. Surtout, le lead n'est pas encore complet à cet instant, l'agent
 * continue de le remplir. Et un gérant qui rappellerait dans la seconde
 * tomberait sur un appelant encore en ligne avec l'IA.
 *
 * « Immédiat » veut donc dire quelques secondes après le raccroché, pas
 * pendant. Le rapport de fin d'appel porte un lead complet, et il est hors du
 * chemin critique.
 *
 * ── Ce que ce module ne fait jamais ─────────────────────────────────────────
 *
 * Il ne peut pas faire échouer la fin d'appel. Une alerte est un supplément:
 * perdre un SMS coûte un rappel tardif, perdre le rapport de fin d'appel coûte
 * la transcription, l'analyse, la mémoire et la facturation de l'appel.
 */

export type LeadAlertThreshold = 'all' | 'urgent' | 'none';

export interface LeadForAlert {
  name: string | null;
  email: string | null;
  reason: string;
  urgency: string;
}

/**
 * Faut-il prévenir, à ce seuil, pour ce degré d'urgence.
 *
 * Pure et exportée: c'est la règle que le client règle depuis son portail, et
 * elle doit pouvoir être vérifiée sans monter un appel entier.
 */
export function shouldAlert(threshold: LeadAlertThreshold, urgency: string): boolean {
  if (threshold === 'none') return false;
  if (threshold === 'all') return true;
  return urgency === 'high';
}

/** Le seuil du client, avec son défaut. Voir `client-config.service`. */
export function thresholdOf(config: unknown): LeadAlertThreshold {
  const raw = (config as { leadAlert?: string } | null)?.leadAlert;
  return raw === 'all' || raw === 'none' ? raw : 'urgent';
}

/**
 * Le texte du SMS.
 *
 * Court et dans cet ordre précis: qui, pourquoi, comment rappeler. Un gérant
 * lit cette notification sur un écran verrouillé, entre deux clients, et ce
 * qu'il doit pouvoir faire sans déverrouiller c'est décider si ça attend.
 */
export function buildSms(lead: LeadForAlert, callerNumber: string | null, lang: VoiceLanguage): string {
  const fr = lang === 'fr';
  const urgent = lead.urgency === 'high' ? (fr ? 'URGENT - ' : 'URGENT - ') : '';
  const who = lead.name || (fr ? 'Appelant' : 'Caller');
  const why = lead.reason ? ` : ${lead.reason}` : '';
  const back = callerNumber ? (fr ? `\nRappeler : ${callerNumber}` : `\nCall back: ${callerNumber}`) : '';
  const head = fr ? 'Nouveau contact' : 'New lead';
  /* Borné à 320 caractères, soit deux segments SMS. Au-delà, le motif est
     tronqué plutôt que le numéro de rappel, qui est la seule partie
     inutilisable si elle est coupée. */
  return `${urgent}${head} — ${who}${why}${back}`.slice(0, 320);
}

/**
 * Les appels déjà signalés.
 *
 * Vapi peut délivrer un rapport de fin d'appel plus d'une fois, et deux SMS
 * pour un seul appelant font douter du produit plus qu'ils n'informent. En
 * mémoire, une heure: un doublon arrive dans la minute, pas le lendemain.
 */
const alerted = new Map<string, number>();
const DEDUP_TTL_MS = 60 * 60 * 1000;

function alreadySent(callId: string): boolean {
  const now = Date.now();
  for (const [id, at] of alerted) if (now - at > DEDUP_TTL_MS) alerted.delete(id);
  if (alerted.has(callId)) return true;
  alerted.set(callId, now);
  return false;
}

class LeadAlertService {
  /**
   * Prévient le gérant, sur tous ses canaux à la fois.
   *
   * Trois canaux et non un: le SMS se perd dans une notification balayée,
   * l'email survit à la journée, et le canal d'équipe touche quelqu'un d'autre
   * que le patron. Aucun n'est fiable seul, et aucun ne coûte assez cher pour
   * qu'on choisisse.
   */
  async notify(input: {
    clientId: string;
    vapiCallId: string | null;
    lead: LeadForAlert | null;
    callerNumber: string | null;
  }): Promise<{ sent: boolean; why?: string }> {
    const { clientId, vapiCallId, lead, callerNumber } = input;
    if (!lead) return { sent: false, why: 'no_lead' };
    if (vapiCallId && alreadySent(vapiCallId)) return { sent: false, why: 'duplicate' };

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        businessName: true,
        transferNumber: true,
        contactPhone: true,
        contactEmail: true,
        agentLanguage: true,
        vapiConfig: true,
      },
    });
    if (!client) return { sent: false, why: 'unknown_client' };

    const threshold = thresholdOf(client.vapiConfig);
    if (!shouldAlert(threshold, lead.urgency)) return { sent: false, why: `below_threshold_${threshold}` };

    const lang: VoiceLanguage = client.agentLanguage === 'nl' ? 'nl' : client.agentLanguage === 'en' ? 'en' : 'fr';
    const body = buildSms(lead, callerNumber, lang);

    /* `transferNumber` d'abord: c'est la ligne où un humain décroche, alors que
       `contactPhone` est le contact du COMPTE, qui peut être un comptable. */
    const phone = client.transferNumber || client.contactPhone;

    await Promise.allSettled([
      phone
        ? smsService.sendSMS(phone, body, { clientId, messageType: 'lead_alert' })
        : Promise.resolve(),
      client.contactEmail
        ? emailService.send({
            to: client.contactEmail,
            subject: body.split('\n')[0],
            html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
          })
        : Promise.resolve(),
      this.postToTeamChannel(clientId, body),
    ]);

    logger.info(`[LeadAlert] ${clientId}: ${lead.urgency} — prévenu (seuil ${threshold})`);
    return { sent: true };
  }

  /**
   * Le canal d'équipe, quand le client en a branché un.
   *
   * Réutilise l'intégration Slack déjà connectée plutôt que d'en demander une
   * seconde: le client a collé cette URL une fois, il n'a pas à la recoller
   * pour recevoir la même information plus vite.
   */
  private async postToTeamChannel(clientId: string, text: string): Promise<void> {
    try {
      const integration = await prisma.crmIntegration.findFirst({
        where: { clientId, provider: 'slack', syncStatus: 'connected' },
        select: { config: true },
      });
      const url = (integration?.config as { webhookUrl?: string } | null)?.webhookUrl;
      if (!url) return;

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      // Le canal d'équipe est le moins critique des trois: son échec ne doit
      // pas empêcher de consigner que le SMS et l'email sont partis.
      logger.warn(`[LeadAlert] canal d'équipe injoignable pour ${clientId}: ${(error as Error).message}`);
    }
  }
}

export const leadAlertService = new LeadAlertService();
