import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { brandWrap, brandTitle, brandText, brandList, brandButton, brandSmall } from './email-template';

/**
 * « Une notification à chaque appel pris. »
 *
 * C'était écrit sur la page d'accueil et ce n'était pas vrai: le seul message
 * qui partait après un appel était le SMS de confirmation adressé au CLIENT
 * FINAL lors d'une réservation. Le propriétaire, lui, ne recevait rien tant
 * qu'il n'ouvrait pas son tableau de bord.
 *
 * Ce service comble ce trou. Trois choix structurent le reste:
 *
 *   - le SMS porte l'essentiel (qui, pourquoi, ce qui a été fait) et rien
 *     d'autre. On lit un SMS en marchant, pas un rapport;
 *   - le spam ne notifie jamais. Un bouclier qui réveille le téléphone à
 *     chaque robot n'est pas un bouclier;
 *   - le canal est réglable et bornable. Vingt appels dans la journée font
 *     vingt SMS et vingt fois le prix Twilio: le propriétaire choisit, et un
 *     plafond quotidien protège autant sa tranquillité que la facture.
 */

export type CallNotifyChannel = 'sms' | 'email' | 'both' | 'off';

export interface CallNotifyPrefs {
  channel: CallNotifyChannel;
  /** Ne notifier que les appels qui ont produit quelque chose. */
  leadsAndBookingsOnly: boolean;
  /** Plafond de SMS par jour, garde-fou de facture. */
  dailySmsCap: number;
}

const DEFAULT_PREFS: CallNotifyPrefs = {
  /* Tout actif par défaut (décision utilisateur): le SMS pour lire l'essentiel
     sans rien ouvrir, le courriel pour retrouver le détail ensuite. Chaque
     client reste libre de couper l'un, l'autre ou les deux depuis ses
     paramètres, et le plafond quotidien continue de borner la facture Twilio
     quoi qu'il arrive. */
  channel: 'both',
  leadsAndBookingsOnly: false,
  dailySmsCap: 30,
};

interface NotifiableCall {
  id: string;
  callerNumber: string | null;
  callerName: string | null;
  summary: string | null;
  outcome: string | null;
  sentiment: string | null;
  durationSeconds: number | null;
  isSpam: boolean;
  isLead: boolean;
  bookingRequested: boolean;
  /* Le rendez-vous a-t-il ÉTÉ FIXÉ, et pas seulement demandé. La distinction
     est tout ce qui sépare une bonne nouvelle d'un rappel à passer: un appelant
     qui demande un créneau et repart sans, c'est le client qui doit décrocher
     dans l'heure. La notification disait « Rendez-vous demandé » dans les deux
     cas. */
  bookingConfirmed?: boolean;
}

interface NotifiableClient {
  id: string;
  businessName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  agentLanguage?: string | null;
  country?: string | null;
  vapiConfig?: unknown;
}

export function readPrefs(client: NotifiableClient): CallNotifyPrefs {
  const cfg = client.vapiConfig as {
    callNotify?: Partial<CallNotifyPrefs>;
    notifications?: { notifEmail?: boolean; notifLeads?: boolean };
  } | null | undefined;
  const raw = cfg?.callNotify;

  /* LES INTERRUPTEURS DE LA PAGE COMPTE SONT ENFIN ÉCOUTÉS.
     Ils écrivent depuis toujours dans `vapiConfig.notifications`, alors que ce
     service ne lisait que `vapiConfig.callNotify`, qu'aucune interface
     n'alimente. Un client qui coupait « Notifications email » continuait donc
     de tout recevoir, et rien dans l'écran ne le lui disait: le réglage était
     décoratif.
     `callNotify` garde la priorité quand il existe, parce qu'il est plus fin
     (canal, plafond quotidien) et qu'il sert aux réglages posés à la main. */
  if (!raw) {
    const ui = cfg?.notifications;
    if (ui && (ui.notifEmail !== undefined || ui.notifLeads !== undefined)) {
      return {
        ...DEFAULT_PREFS,
        /* Pas d'interrupteur SMS dans cette page: couper l'email ne doit donc
           pas couper le SMS, qui est le canal de l'urgence. */
        channel: ui.notifEmail === false
          ? (DEFAULT_PREFS.channel === 'both' ? 'sms' : DEFAULT_PREFS.channel === 'email' ? 'off' : DEFAULT_PREFS.channel)
          : DEFAULT_PREFS.channel,
        /* « Nouveaux leads » décoché veut dire « ne me préviens que pour ce qui
           compte », pas « ne me préviens jamais »: le filtre reste sur les
           leads et les rendez-vous. */
        leadsAndBookingsOnly: ui.notifLeads === false ? true : DEFAULT_PREFS.leadsAndBookingsOnly,
      };
    }
    return DEFAULT_PREFS;
  }
  const channel: CallNotifyChannel =
    raw.channel === 'off' || raw.channel === 'email' || raw.channel === 'both' || raw.channel === 'sms'
      ? raw.channel
      : DEFAULT_PREFS.channel;
  return {
    channel,
    leadsAndBookingsOnly: raw.leadsAndBookingsOnly === true,
    dailySmsCap:
      typeof raw.dailySmsCap === 'number' && raw.dailySmsCap >= 0 ? raw.dailySmsCap : DEFAULT_PREFS.dailySmsCap,
  };
}

/* L'alphabet GSM-7, celui qui tient 153 signes par segment. Tout ce qui en
   sort, un « ô », un « ç », un point médian, fait basculer le message entier en
   UCS-2 et divise la capacité par plus de deux. */
const GSM7 =
  /^[@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\n\r^{}\\[~\]|€]*$/;

/**
 * Coupe le résumé pour que le SMS ENTIER tienne dans son plafond de segments.
 *
 * Le budget portait sur le seul résumé et ignorait le nom du commerce, celui de
 * l'appelant, la durée, l'issue et le lien: un message annoncé « sous deux
 * segments » en coûtait cinq, mesuré par le test qui accompagne cette fonction.
 *
 * La limite dépend de l'alphabet, et l'alphabet dépend du texte: un résumé
 * français contient presque toujours un signe absent du GSM-7 (« contrôle »,
 * « ça »), donc 67 caractères par segment est le cas courant, pas l'exception.
 *
 * Le plafond dépend donc de l'alphabet, lui aussi: DEUX segments quand le texte
 * tient en GSM-7, TROIS quand un accent le pousse en UCS-2. Ce n'est pas une
 * faveur accordée au second cas, c'est une mesure: l'en-tête seul, nom du
 * commerce, appelant, durée, issue et lien, pèse environ 150 signes, soit plus
 * de deux segments UCS-2. Viser deux partout aurait voulu dire ne plus envoyer
 * de résumé dès qu'un « ô » apparaît.
 */
function fitSummary(prefix: string, summary: string, suffix: string): string {
  const limitFor = (text: string) => (GSM7.test(text) ? 2 * 153 : 3 * 67);
  const fixed = prefix.length + suffix.length;
  let budget = limitFor(prefix + summary + suffix) - fixed;
  if (summary.length <= budget) return summary;
  /* Couper peut retirer le caractère qui imposait UCS-2, ce qui rouvre du
     budget: on recalcule une fois, jamais en boucle. */
  let short = `${summary.slice(0, Math.max(0, budget - 3))}...`;
  budget = limitFor(prefix + short + suffix) - fixed;
  if (summary.length <= budget) return summary;
  short = `${summary.slice(0, Math.max(0, budget - 3))}...`;
  return short;
}

function lang(client: NotifiableClient): 'fr' | 'en' {
  if (client.agentLanguage === 'fr') return 'fr';
  if (client.agentLanguage === 'en') return 'en';
  return ['FR', 'BE', 'LU', 'MC', 'CH'].includes((client.country || '').toUpperCase()) ? 'fr' : 'en';
}

/** « 2 min 14 » plutôt que « 134 s ». */
function duration(seconds: number | null, fr: boolean): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return fr ? `${m} min ${String(rest).padStart(2, '0')}` : `${m}m ${String(rest).padStart(2, '0')}s`;
}

function outcomeLabel(outcome: string | null, fr: boolean): string {
  switch (outcome) {
    case 'lead_captured': return fr ? 'Coordonnées prises' : 'Details taken';
    case 'transferred': return fr ? 'Transféré' : 'Transferred';
    case 'booking': return fr ? 'Rendez-vous pris' : 'Appointment booked';
    case 'info': return fr ? 'Renseignement' : 'Information';
    default: return fr ? 'Appel traité' : 'Call handled';
  }
}

class CallNotificationService {
  /**
   * Prévenir le propriétaire d'un appel qui vient de se terminer.
   *
   * Jamais await par l'appelant: la fin d'appel ne doit pas attendre Twilio.
   * Toute erreur est absorbée, un SMS raté ne fait pas perdre l'appel.
   */
  async notify(client: NotifiableClient, call: NotifiableCall): Promise<{ sms: boolean; email: boolean }> {
    const none = { sms: false, email: false };

    // Le spam ne réveille personne. C'est la raison d'être du bouclier.
    if (call.isSpam) return none;

    const prefs = readPrefs(client);
    if (prefs.channel === 'off') return none;
    if (prefs.leadsAndBookingsOnly && !call.isLead && !call.bookingRequested) return none;

    const fr = lang(client) === 'fr';
    const link = `${env.FRONTEND_URL?.split(',')[0] || 'https://qwillio.com'}/dashboard/calls`;
    const wantsSms = prefs.channel === 'sms' || prefs.channel === 'both';
    const wantsEmail = prefs.channel === 'email' || prefs.channel === 'both';

    const sms = wantsSms ? await this.sendSms(client, call, prefs, fr, link) : false;
    const email = wantsEmail ? await this.sendEmail(client, call, fr, link) : false;
    return { sms, email };
  }

  private async sendSms(
    client: NotifiableClient,
    call: NotifiableCall,
    prefs: CallNotifyPrefs,
    fr: boolean,
    link: string,
  ): Promise<boolean> {
    if (!client.contactPhone) return false;

    /* Plafond quotidien: compté sur les SMS RÉELLEMENT envoyés de ce type, pas
       sur les appels reçus. Un jour d'affluence coûterait sinon autant en
       Twilio qu'en minutes de voix. */
    if (prefs.dailySmsCap > 0) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const sentToday = await prisma.smsLog.count({
        where: { clientId: client.id, messageType: 'call_notification', status: 'sent', createdAt: { gte: since } },
      }).catch(() => 0);
      if (sentToday >= prefs.dailySmsCap) {
        logger.info(`[CallNotify] plafond quotidien atteint pour ${client.businessName} (${sentToday})`);
        return false;
      }
    }

    const who = call.callerName || call.callerNumber || (fr ? 'Numéro masqué' : 'Unknown number');
    const summary = (call.summary || '').replace(/\s+/g, ' ').trim();

    /* La ligne qui appelle une action passe EN TÊTE du SMS: un rendez-vous
       demandé et non fixé se lit sur l'écran verrouillé, sans ouvrir le
       message, ce qui est le seul endroit où il sera vu à temps. */
    /* Les accents sont RENDUS: « é », « è », « à » appartiennent à l'alphabet
       GSM-7, contrairement au pictogramme et au tiret cadratin qui, eux, sont
       partis. Les retirer ne faisait donc rien gagner et donnait un français
       fautif au client. */
    const alert = call.bookingRequested && !call.bookingConfirmed
      ? (fr ? 'RDV demandé, non fixé : à rappeler\n' : 'Appointment requested, not booked: call back\n')
      : '';

    /* Le séparateur est un TIRET, plus le point médian: U+00B7 n'appartient pas
       à l'alphabet GSM-7, et un seul caractère hors alphabet bascule TOUT le
       message en UCS-2, où un segment ne porte plus que 67 signes au lieu de
       153. Trois points médians par SMS suffisaient à faire payer le double. */
    const sep = ' - ';
    const line2 = `${who}${sep}${duration(call.durationSeconds, fr)}${sep}${outcomeLabel(call.outcome, fr)}`;
    const prefix = `Qwillio${sep}${client.businessName}\n${alert}${line2}\n`;
    const suffix = `\n${link}`;
    const body = prefix + fitSummary(prefix, summary, suffix) + suffix;

    try {
      const r = await smsService.sendSMS(client.contactPhone, body, {
        messageType: 'call_notification',
        clientId: client.id,
      });
      return r.success;
    } catch (error) {
      logger.warn(`[CallNotify] SMS à ${client.contactPhone} échoué:`, error);
      return false;
    }
  }

  private async sendEmail(
    client: NotifiableClient,
    call: NotifiableCall,
    fr: boolean,
    link: string,
  ): Promise<boolean> {
    if (!client.contactEmail) return false;

    const who = call.callerName || call.callerNumber || (fr ? 'Numéro masqué' : 'Unknown number');
    const facts = [
      `${fr ? 'Appelant' : 'Caller'} : <strong>${who}</strong>`,
      `${fr ? 'Durée' : 'Duration'} : ${duration(call.durationSeconds, fr)}`,
      `${fr ? 'Issue' : 'Outcome'} : ${outcomeLabel(call.outcome, fr)}`,
    ];
    if (call.bookingRequested) {
      facts.push(
        call.bookingConfirmed
          ? (fr ? '<strong>Rendez-vous fixé</strong>' : '<strong>Appointment booked</strong>')
          : (fr
            ? '<strong>Rendez-vous demandé, NON fixé</strong> : à rappeler'
            : '<strong>Appointment requested, NOT booked</strong>: needs a call back'),
      );
    }
    if (call.isLead) facts.push(fr ? '<strong>Lead qualifié</strong>' : '<strong>Qualified lead</strong>');

    const html = brandWrap({
      title: fr ? `Appel pris · ${client.businessName}` : `Call handled · ${client.businessName}`,
      preheader: (call.summary || '').slice(0, 140),
      body: [
        brandTitle(fr ? 'Un appel vient d’être pris' : 'A call was just handled'),
        brandText(call.summary || (fr ? 'Pas de résumé disponible.' : 'No summary available.')),
        brandList(facts),
        brandButton(fr ? 'Écouter et lire le transcript' : 'Listen and read the transcript', link),
        brandSmall(fr ? '— Qwillio' : '— Qwillio'),
      ].join(''),
    });

    try {
      await emailService.send({
        to: client.contactEmail,
        subject: fr
          ? `${who} vient d’appeler ${client.businessName}`
          : `${who} just called ${client.businessName}`,
        html,
        tags: [{ name: 'campaign', value: 'call_notification' }],
      });
      return true;
    } catch (error) {
      logger.warn(`[CallNotify] courriel à ${client.contactEmail} échoué:`, error);
      return false;
    }
  }
}

export const callNotificationService = new CallNotificationService();
