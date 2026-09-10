import { logger } from '../../config/logger';
import { discordService } from '../discord.service';

/**
 * Ce que Vapi a refusé, et si c'est grave pour UN client ou pour TOUS.
 *
 * ## Le silence qu'on répare
 *
 * `syncVapiAssistant` lève, et ses deux appelants attrapent pour écrire un
 * `logger.warn` avant de répondre `success: true`. Concrètement: le client
 * enregistre un réglage, la base est mise à jour, l'interface dit que c'est
 * fait — et l'assistant DISTANT garde son ancienne configuration, pour
 * toujours. Tous les appels suivants passent par un agent périmé, et la seule
 * trace est un avertissement dans un journal que personne ne lit.
 *
 * C'est le mode d'échec qui a coupé la flotte deux fois (`backchannelPlan`,
 * puis `voice.chunkPlan.punctuationBoundaries`). Il n'a jamais été rendu
 * bruyant, seulement documenté après coup.
 *
 * ## Pourquoi la distinction 4xx / 5xx porte tout
 *
 * Un **refus** (4xx) dit que la charge qu'on construit est invalide. Elle est
 * construite par le même code pour tout le monde: le prochain client qui
 * enregistre un réglage échouera pareil, et celui d'après aussi. Un refus est
 * donc un incident de FLOTTE, même s'il se manifeste sur un seul compte.
 *
 * Un **incident passager** (5xx, réseau, 429) ne dit rien sur notre charge. Il
 * se retentera de lui-même au prochain enregistrement. Alerter dessus avec la
 * même force apprendrait à ignorer l'alerte, ce qui coûterait la suivante.
 */

export type VapiFailureKind = 'rejected' | 'transient';

export interface VapiFailure {
  kind: VapiFailureKind;
  /** Le code HTTP quand il est lisible, `null` sur une panne réseau. */
  status: number | null;
  /** Le corps de la réponse: c'est LUI qui nomme le champ fautif. */
  detail: string;
}

/** Le message de `config/vapi.ts`: « VAPI API error (400): {…} ». */
const STATUS = /VAPI API error \((\d{3})\)\s*:?\s*/;

/** Assez pour lire quel champ Vapi refuse, pas assez pour noyer une alerte. */
const MAX_DETAIL = 500;

export function classifyVapiError(error: unknown): VapiFailure {
  const message = error instanceof Error ? error.message : String(error);
  const match = STATUS.exec(message);

  if (!match) {
    // Ni code ni corps: coupure réseau, DNS, délai dépassé. Rien à corriger.
    return { kind: 'transient', status: null, detail: message.slice(0, MAX_DETAIL) };
  }

  const status = Number(match[1]);
  const detail = message.slice(match.index + match[0].length).trim().slice(0, MAX_DETAIL);

  /* 429 est un 4xx qui ne dit RIEN sur la charge: c'est un débit, pas une
     forme. Le ranger avec les refus ferait chercher un champ fautif qui
     n'existe pas. */
  const rejected = status >= 400 && status < 500 && status !== 429;
  return { kind: rejected ? 'rejected' : 'transient', status, detail };
}

/** Une alerte de refus au plus par quart d'heure: une sauvegarde en boucle ne doit pas spammer. */
const COOLDOWN_MS = 15 * 60 * 1000;
let lastAlertAt = 0;

/**
 * Signale l'échec d'une synchronisation d'assistant. Ne lève jamais: elle est
 * appelée depuis un `catch` dont le travail est de laisser passer l'erreur.
 */
export function reportAssistantSyncFailure(input: {
  clientId: string;
  businessName?: string | null;
  assistantId?: string | null;
  error: unknown;
}): VapiFailure {
  const failure = classifyVapiError(input.error);
  const who = input.businessName ? `${input.businessName} (${input.clientId})` : input.clientId;

  if (failure.kind === 'transient') {
    logger.warn(
      `[VapiSync] échec passager pour ${who}` +
        `${failure.status ? ` — HTTP ${failure.status}` : ''}: ${failure.detail}`,
    );
    return failure;
  }

  /* Le corps de la réponse dans le message, et c'est tout l'intérêt: il nomme
     le champ que Vapi refuse, et c'est la seule chose que le code ne pouvait
     pas deviner. Sans lui, l'alerte dirait « ça a raté » et laisserait le
     diagnostic entier à faire. */
  logger.error(
    `[VapiSync] REFUS Vapi pour ${who} — HTTP ${failure.status}: ${failure.detail}. ` +
      `L'assistant distant garde son ANCIENNE configuration. La charge étant construite ` +
      `par le même code pour toute la flotte, le prochain enregistrement échouera pareil.`,
  );

  const now = Date.now();
  if (now - lastAlertAt < COOLDOWN_MS) return failure;
  lastAlertAt = now;

  void discordService
    .notifyAlerts(
      `🔴 Vapi REFUSE l'assistant de ${who}.\n` +
        `HTTP ${failure.status}: ${failure.detail}\n` +
        `L'agent distant garde son ancienne configuration, et le réglage vient d'être ` +
        `annoncé comme enregistré. La charge est la même pour toute la flotte: ` +
        `\`npm run voice:validate\` dit quel champ passe et lequel ne passe pas.`,
    )
    .catch(err => logger.warn(`[VapiSync] alerte non transmise: ${(err as Error).message}`));

  return failure;
}

/**
 * Un webhook REFUSÉ, c'est-à-dire des appels qui disparaissent.
 *
 * ## Ce qui se passe quand le secret ne correspond pas
 *
 * `isVapiWebhookAuthorized` rend `false`, l'endpoint répond 401, et Vapi n'a
 * personne à qui se plaindre. L'appel, lui, s'est très bien déroulé: Vapi tient
 * la conversation avec l'assistant qu'il a déjà, sans avoir besoin de nous.
 * Ce qui tombe est tout le reste — le rapport de fin d'appel, donc AUCUN appel
 * dans le tableau de bord, AUCUNE alerte de lead, AUCUNE mémoire d'appelant,
 * AUCUNE facturation — et les outils, donc aucun transfert.
 *
 * Le client voit un agent qui répond bien et un tableau de bord vide, ce qui
 * ressemble à un produit qui ne compte pas ses appels. La seule trace était un
 * `logger.warn` par requête, dans un journal que personne ne lit.
 *
 * ## Pourquoi une alerte et pas un compteur de plus
 *
 * Le secret ne se règle pas dans ce dépôt: `VAPI_WEBHOOK_SECRET` vit sur Render
 * et son jumeau dans le tableau de bord Vapi. Rien dans le code ne peut le
 * détecter avant qu'un appel réel arrive, et personne ne pense à vérifier une
 * chose qui n'a jamais échoué bruyamment. C'est exactement la forme de panne du
 * point précédent: silencieuse, totale, et invisible depuis le code.
 *
 * ## Ce qui borne l'alerte
 *
 * L'endpoint est public: n'importe qui peut le marteler et provoquer autant de
 * 401 qu'il veut. L'alerte est donc plafonnée à une par heure et porte le
 * NOMBRE de refus accumulés, ce qui distingue au passage les deux causes: une
 * poignée de refus est un scanner, un refus par appel est un secret désaccordé.
 */
const WEBHOOK_ALERT_COOLDOWN_MS = 60 * 60 * 1000;
let rejectedWebhooks = 0;
let lastWebhookAlertAt = 0;

export function reportRejectedWebhook(path: string): void {
  rejectedWebhooks += 1;

  const now = Date.now();
  if (now - lastWebhookAlertAt < WEBHOOK_ALERT_COOLDOWN_MS) return;
  const count = rejectedWebhooks;
  lastWebhookAlertAt = now;
  rejectedWebhooks = 0;

  logger.error(
    `[VapiWebhook] ${count} webhook(s) REFUSÉ(S) (401) depuis la dernière alerte, dernier: ${path}. ` +
      `Si des appels ont eu lieu, ils ne laissent AUCUNE trace: ni appel au tableau de bord, ` +
      `ni alerte de lead, ni facturation.`,
  );

  void discordService
    .notifyAlerts(
      `🔴 ${count} webhook(s) Vapi refusé(s) en 401 (dernier: ${path}).\n` +
        `Le secret \`x-vapi-secret\` envoyé par Vapi ne correspond pas à \`VAPI_WEBHOOK_SECRET\`.\n` +
        `Conséquence: un appel se déroule normalement pour l'appelant et ne laisse RIEN — ` +
        `pas d'appel au tableau de bord, pas d'alerte de lead, pas de transfert, pas de facturation.\n` +
        `Le secret se règle des DEUX côtés: la variable sur Render, et « Server URL Secret » ` +
        `dans le tableau de bord Vapi. \`npm run voice:doctor\` dit combien d'événements sont reçus.`,
    )
    .catch(err => logger.warn(`[VapiWebhook] alerte non transmise: ${(err as Error).message}`));
}

/** Test seam. */
export function resetVapiSyncAlerts(): void {
  lastAlertAt = 0;
  rejectedWebhooks = 0;
  lastWebhookAlertAt = 0;
}
