import { logger } from '../../config/logger';

/**
 * Pourquoi l'appel, ou le transfert, s'est terminé (REL-7).
 *
 * Le défaut réparé ici n'est pas subtil : `logTransfer` écrivait
 * `failedReason: 'No answer'` en dur dès qu'aucune erreur n'était jointe. Un
 * transfert vers un numéro occupé, un numéro refusé, un numéro faux et une
 * boîte vocale produisaient donc tous la même phrase, et cette phrase était
 * fausse dans trois cas sur quatre. Or c'est précisément la distinction qui
 * décide de la suite : « il était occupé » se rappelle dans dix minutes,
 * « le numéro est faux » se corrige dans les réglages du client, et personne
 * ne peut agir sur « No answer ».
 *
 * ## Le code SIP est un ÉQUIVALENT, pas une lecture
 *
 * Vapi ne nous transmet aucun code de cause SIP : le leg téléphonique lui
 * appartient. Ce qu'il transmet est `endedReason`, une énumération fermée. La
 * correspondance posée ici traduit ces libellés vers le code SIP que
 * l'opérateur a très probablement émis, parce que 486 et 408 se lisent d'un
 * coup d'œil par qui connaît la téléphonie, là où
 * `call.in-progress.error-providerfault-outbound-sip-503-service-unavailable`
 * ne se lit pas du tout.
 *
 * Ne jamais présenter ce nombre comme relevé sur le fil. Un test l'exige.
 *
 * Les libellés viennent de la spécification OpenAPI de Vapi (`Call.endedReason`),
 * pas d'une observation : les inventer aurait produit une table qui ne matche
 * jamais et un tableau de bord qui affiche « inconnu » pour toujours.
 */

export type OutcomeCause =
  /** Le transfert a abouti, ou l'appel s'est terminé normalement. */
  | 'completed'
  /** Le poste sonnait occupé. Rappeler plus tard a du sens. */
  | 'busy'
  /** Ça a sonné dans le vide. */
  | 'no_answer'
  /** L'opérateur a dit indisponible: hors ligne, hors couverture. */
  | 'unavailable'
  /** Le réseau a refusé: interdit, mauvaise authentification, rejeté. */
  | 'rejected'
  /** Une boîte vocale a décroché. L'urgence y est morte. */
  | 'voicemail'
  /** Le numéro n'existe pas ou est mal composé. À corriger dans les réglages. */
  | 'misdialed'
  /** L'APPELANT a raccroché. Ni le destinataire ni le réseau ne sont en cause. */
  | 'caller_hung_up'
  /** Panne franche du pont, sans cause téléphonique lisible. */
  | 'failed'
  /** Fin d'appel ordinaire, sans rapport avec un transfert. */
  | 'other';

export interface OutcomeReading {
  cause: OutcomeCause;
  /**
   * Le code SIP ÉQUIVALENT, ou `null`. Voir l'avertissement en tête de
   * fichier: il est déduit du libellé Vapi, jamais lu sur le fil.
   */
  sipEquivalent: number | null;
  /** Une phrase pour un humain, en français, à écrire dans `failedReason`. */
  label: string;
  /** Vrai quand la cause désigne un transfert raté, donc un rappel à faire. */
  transferFailed: boolean;
}

const NO_CAUSE: OutcomeReading = {
  cause: 'other',
  sipEquivalent: null,
  label: 'fin d\'appel ordinaire',
  transferFailed: false,
};

/**
 * `endedReason` Vapi → cause. Les clés sont celles de la spécification.
 *
 * Ce qui n'est PAS ici est délibéré: les dizaines de libellés qui décrivent la
 * fin normale d'un appel (`customer-ended-call`, `assistant-ended-call`, …)
 * retombent sur `other`, parce que les énumérer produirait une table à
 * maintenir sans rien apprendre.
 */
const CAUSES: Record<string, Omit<OutcomeReading, 'transferFailed'>> = {
  // ── Le pont a abouti ──
  'assistant-forwarded-call': { cause: 'completed', sipEquivalent: 200, label: 'transfert abouti' },

  // ── Le destinataire n'a pas pris l'appel ──
  'call.forwarding.operator-busy': { cause: 'busy', sipEquivalent: 486, label: 'le poste sonnait occupé' },
  'customer-busy': { cause: 'busy', sipEquivalent: 486, label: 'le poste sonnait occupé' },
  'call.forwarding.no-answer': { cause: 'no_answer', sipEquivalent: 408, label: 'ça a sonné sans réponse' },
  'customer-did-not-answer': { cause: 'no_answer', sipEquivalent: 408, label: 'ça a sonné sans réponse' },
  voicemail: { cause: 'voicemail', sipEquivalent: 200, label: 'une boîte vocale a décroché' },

  // ── Le réseau a dit non ──
  'call.in-progress.error-providerfault-outbound-sip-480-temporarily-unavailable': {
    cause: 'unavailable',
    sipEquivalent: 480,
    label: 'poste temporairement indisponible',
  },
  'call.in-progress.error-providerfault-outbound-sip-503-service-unavailable': {
    cause: 'unavailable',
    sipEquivalent: 503,
    label: 'service opérateur indisponible',
  },
  'call.in-progress.error-providerfault-outbound-sip-408-request-timeout': {
    cause: 'no_answer',
    sipEquivalent: 408,
    label: 'délai dépassé sans réponse',
  },
  'call.in-progress.error-providerfault-outbound-sip-403-forbidden': {
    cause: 'rejected',
    sipEquivalent: 403,
    label: 'appel refusé par l\'opérateur',
  },
  'call.in-progress.error-providerfault-outbound-sip-407-proxy-authentication-required': {
    cause: 'rejected',
    sipEquivalent: 407,
    label: 'authentification refusée par l\'opérateur',
  },
  'vonage-rejected': { cause: 'rejected', sipEquivalent: 603, label: 'appel rejeté' },
  'twilio-reported-customer-misdialed': {
    cause: 'misdialed',
    sipEquivalent: 404,
    label: 'numéro inexistant ou mal composé',
  },

  // ── Le pont lui-même a cassé ──
  'call.in-progress.error-transfer-failed': { cause: 'failed', sipEquivalent: null, label: 'le transfert a échoué' },
  'twilio-failed-to-connect-call': { cause: 'failed', sipEquivalent: null, label: 'l\'appel n\'a pas pu être établi' },
  'call.in-progress.error-sip-outbound-call-failed-to-connect': {
    cause: 'failed',
    sipEquivalent: null,
    label: 'la jambe sortante n\'a pas abouti',
  },

  /* ── L'APPELANT a raccroché pendant le pont ──
     Distinct d'un échec, et la distinction compte: rappeler quelqu'un qui
     vient de raccrocher de lui-même est au mieux inutile, au pire agaçant. */
  'customer-ended-call-before-warm-transfer': {
    cause: 'caller_hung_up',
    sipEquivalent: null,
    label: 'l\'appelant a raccroché avant le pont',
  },
  'customer-ended-call-after-warm-transfer-attempt': {
    cause: 'caller_hung_up',
    sipEquivalent: null,
    label: 'l\'appelant a raccroché après la tentative de pont',
  },
  'customer-ended-call-during-transfer': {
    cause: 'caller_hung_up',
    sipEquivalent: null,
    label: 'l\'appelant a raccroché pendant le transfert',
  },
};

/** Les causes qui valent un rappel: le destinataire n'a pas eu l'appelant. */
const FAILED_CAUSES = new Set<OutcomeCause>([
  'busy',
  'no_answer',
  'unavailable',
  'rejected',
  'voicemail',
  'misdialed',
  'failed',
]);

/**
 * Lire un `endedReason` Vapi. Rend toujours une lecture, jamais `null`:
 * l'appelant est en fin d'appel, il n'a rien à décider sur une absence.
 */
export function readEndedReason(reason: string | null | undefined): OutcomeReading {
  const key = typeof reason === 'string' ? reason.trim() : '';
  if (!key) return NO_CAUSE;

  const hit = CAUSES[key];
  if (!hit) {
    /* Un libellé inconnu est signalé UNE fois et rangé en `other`, jamais
       deviné: Vapi ajoute des valeurs à cette énumération, et une heuristique
       sur le texte du libellé rangerait un jour un succès parmi les échecs. */
    if (key.includes('transfer') || key.startsWith('call.forwarding.')) {
      logger.warn(`[CallOutcome] endedReason de transfert non répertorié: ${key}`);
    }
    return { ...NO_CAUSE, label: key };
  }
  return { ...hit, transferFailed: FAILED_CAUSES.has(hit.cause) };
}

/**
 * L'entonnoir des transferts: tenté → sonné → décroché → abouti.
 *
 * Compteurs de processus, remis à zéro au redémarrage. C'est une mesure
 * d'exploitation, pas une donnée: la persister demanderait une écriture sur le
 * chemin d'un appel, et les lignes `CallTransfer` portent déjà l'historique.
 */
export interface TransferFunnel {
  attempted: number;
  ringing: number;
  answered: number;
  completed: number;
  byCause: Record<string, number>;
}

class TransferFunnelCounter {
  private funnel: TransferFunnel = { attempted: 0, ringing: 0, answered: 0, completed: 0, byCause: {} };

  /** Une tentative part. Comptée avant tout, même si elle casse aussitôt. */
  attempt(): void {
    this.funnel.attempted++;
  }

  /**
   * Une tentative se conclut, avec sa cause.
   *
   * `ringing` compte tout ce qui a au moins fait sonner: occupé et sans-réponse
   * en font partie, un numéro inexistant non. C'est ce qui sépare « le numéro
   * marche mais personne ne décroche » de « le numéro est faux », la seule
   * distinction que l'entonnoir doit rendre lisible.
   */
  settle(reading: OutcomeReading): void {
    const { cause } = reading;
    this.funnel.byCause[cause] = (this.funnel.byCause[cause] ?? 0) + 1;
    if (cause === 'misdialed' || cause === 'rejected' || cause === 'failed') return;
    this.funnel.ringing++;
    if (cause === 'busy' || cause === 'no_answer' || cause === 'unavailable') return;
    this.funnel.answered++;
    // Une boîte vocale décroche, elle n'aboutit pas: l'urgence y est morte.
    if (cause === 'completed') this.funnel.completed++;
  }

  summary(): TransferFunnel {
    return { ...this.funnel, byCause: { ...this.funnel.byCause } };
  }

  /** Test seam. */
  reset(): void {
    this.funnel = { attempted: 0, ringing: 0, answered: 0, completed: 0, byCause: {} };
  }
}

export const transferFunnel = new TransferFunnelCounter();
