import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { KNOWN_TOOLS, type KnownTool } from './voice-tools';

/**
 * Le banc d'essai des réceptionnistes.
 *
 * Il existe parce que régler une voix demandait jusqu'ici trois choses qui ne
 * vont pas ensemble: poser une variable sur Render, attendre un redéploiement,
 * puis se souvenir de ce qu'on avait entendu un quart d'heure plus tôt. On ne
 * compare pas deux moteurs comme ça, on compare deux souvenirs.
 *
 * Deux règles le gouvernent, et elles sont en tension:
 *
 *  1. **Il teste le VRAI assistant.** La configuration est assemblée par
 *     `buildSpeech` et `buildRealtimePlans`, les mêmes fonctions que l'appel
 *     entrant réel. Un banc d'essai qui monterait sa propre chaîne testerait
 *     autre chose, et c'est précisément le piège qu'on vient de retirer deux
 *     fois de l'aperçu du sélecteur de voix.
 *
 *  2. **Il ne touche RIEN.** Aucun réglage n'est enregistré sur un client,
 *     aucun rendez-vous n'est pris, aucun message n'est envoyé. Les essais du
 *     gérant ne doivent pas se retrouver dans la boîte SMS d'un vrai client ni
 *     dans son agenda. Ce qui AURAIT eu lieu est décrit, à la place.
 *
 * La session vit en mémoire, dix minutes. C'est un banc d'essai: perdre la
 * trace d'un essai coûte de le refaire, jamais une donnée.
 */

/** Ce qu'un outil aurait fait, ou a fait, pendant un essai. */
export interface LabEvent {
  at: string;
  /** `tool` = l'agent a agi; `call` = un jalon de l'appel lui-même. */
  kind: 'tool' | 'call';
  name: string;
  /** `réel` pour une lecture, `simulé` pour tout ce qui écrirait ou enverrait. */
  mode: 'real' | 'simulated';
  /** Une phrase en français: ce qui se serait passé sur un vrai appel. */
  wouldHave: string;
  /** Les arguments du modèle, pour comprendre POURQUOI il a agi ainsi. */
  args?: Record<string, unknown>;
}

export interface LabSession {
  id: string;
  clientId: string;
  createdAt: number;
  events: LabEvent[];
}

const TTL_MS = 10 * 60 * 1000;
const MAX_EVENTS = 200;
const sessions = new Map<string, LabSession>();

/**
 * Les outils qui ÉCRIVENT ou ENVOIENT, donc ceux qu'on n'exécute jamais ici.
 *
 * La frontière n'est pas « dangereux / inoffensif », elle est « laisse une
 * trace chez quelqu'un d'autre ». Lire un agenda ne coûte rien à personne et
 * rend l'essai réaliste; y écrire met un faux rendez-vous devant un vrai
 * client, et c'est exactement ce dont on ne veut pas pour tester une voix.
 */
const WRITING_TOOLS: readonly KnownTool[] = ['bookAppointment', 'captureLead'];

export function isWritingTool(name: string): boolean {
  return (WRITING_TOOLS as readonly string[]).includes(name);
}

/**
 * Ce que l'outil aurait produit, dit en français.
 *
 * Écrit ici plutôt qu'à l'écran: c'est le serveur qui sait ce que chaque outil
 * déclenche réellement (le SMS de confirmation, l'entrée CRM, la synchro
 * d'agenda), et un écran qui le devinerait mentirait dès qu'un service
 * changerait de comportement.
 */
export function describeEffect(name: string, args: Record<string, unknown>): string {
  const when = [args.date, args.time].filter(Boolean).join(' à ') || 'le créneau demandé';
  const who = String(args.name || args.customerName || 'l\'appelant');

  switch (name) {
    case 'bookAppointment':
      return `Rendez-vous créé pour ${who}, ${when}. Sur un vrai appel: écriture en base, `
        + 'synchronisation Google Agenda, SMS de confirmation à l\'appelant et notification au gérant.';
    case 'captureLead':
      return `Fiche contact créée pour ${who}. Sur un vrai appel: enregistrement dans le CRM, `
        + 'et notification au gérant selon son canal (SMS ou WhatsApp).';
    case 'checkAvailability':
      return 'Créneaux lus dans l\'agenda réel du client. Aucune écriture.';
    case 'lookupBooking':
      return 'Rendez-vous existant recherché dans l\'agenda réel. Aucune écriture.';
    case 'lookupKnowledge':
      return 'Base de connaissances interrogée. Aucune écriture.';
    default:
      return 'Outil inconnu: aucun effet.';
  }
}

/**
 * Ce que l'agent S'ENTEND RÉPONDRE quand l'outil est simulé.
 *
 * Il faut que ça ressemble à un succès, sinon l'agent s'excuse et la
 * conversation part sur un incident au lieu de continuer: on testerait alors sa
 * façon de gérer une panne, pas sa façon de prendre un rendez-vous.
 */
export function simulatedResult(name: string, args: Record<string, unknown>): string {
  const when = [args.date, args.time].filter(Boolean).join(' at ') || 'the requested slot';
  switch (name) {
    case 'bookAppointment':
      return `Booked for ${when}. Confirmation will be sent.`;
    case 'captureLead':
      return 'Contact saved.';
    default:
      return 'Done.';
  }
}

class VoiceLabService {
  /** Ouvre une session d'essai. Rien n'est écrit en base. */
  open(clientId: string): LabSession {
    this.sweep();
    const session: LabSession = { id: randomUUID(), clientId, createdAt: Date.now(), events: [] };
    sessions.set(session.id, session);
    return session;
  }

  get(id: string): LabSession | null {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.createdAt > TTL_MS) {
      sessions.delete(id);
      return null;
    }
    return s;
  }

  record(id: string, event: Omit<LabEvent, 'at'>): void {
    const s = this.get(id);
    if (!s) return;
    s.events.push({ ...event, at: new Date().toISOString() });
    // Un essai qui déborde est un essai qui boucle: on garde la fin, qui est
    // l'endroit où ça a dérapé.
    if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
  }

  /** Les sessions expirées, retirées à l'ouverture plutôt que par un minuteur. */
  private sweep(): void {
    const now = Date.now();
    for (const [id, s] of sessions) if (now - s.createdAt > TTL_MS) sessions.delete(id);
  }

  /**
   * L'adresse que Vapi rappellera pour les appels d'outils de CETTE session.
   *
   * L'appel de test du tableau de bord, lui, n'en a pas: son assistant est
   * transient et sans `serverUrl`, donc aucun outil ne revient jamais jusqu'à
   * nous et le gérant ne voit pas ce que l'agent a fait. C'est précisément ce
   * que ce banc corrige.
   */
  webhookUrl(sessionId: string): string {
    return `${env.API_BASE_URL}/api/webhooks/lab/${sessionId}`;
  }
}

export const voiceLabService = new VoiceLabService();

/** Exporté pour que l'écran puisse dire ce qu'il propose sans le redéclarer. */
export const LAB_TOOLS = KNOWN_TOOLS;

export function labToolMode(name: string): 'real' | 'simulated' {
  return isWritingTool(name) ? 'simulated' : 'real';
}

export function logLabBoot(): void {
  logger.info('[VoiceLab] banc d\'essai actif (aucune écriture, aucun envoi)');
}
