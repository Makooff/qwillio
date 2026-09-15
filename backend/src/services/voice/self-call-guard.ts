import { logger } from '../../config/logger';
import { isOwnLine } from './transfer-loop';

/**
 * Le garde-fou de boucle ENTRANT (15/09/2026).
 *
 * Avec un renvoi conditionnel, le client peut mettre son propre mobile en
 * numéro de transfert: son téléphone sonne d'abord, l'IA n'intervient que s'il
 * ne répond pas. Le transfert vers ce mobile est borné à 20 s, avant le renvoi
 * sur non-réponse à 30 s. Reste le cas « occupé »: le renvoi ramène le
 * transfert chez nous IMMÉDIATEMENT, et l'IA décrocherait sa propre demande
 * de transfert, se présenterait à elle-même, et facturerait les minutes.
 *
 * Ce qui le trahit: l'appelant présenté est NOTRE ligne, celle depuis
 * laquelle Vapi a composé le transfert. Aucun vrai appelant n'appelle depuis
 * la ligne de la plateforme. On ne compare qu'aux lignes de la PLATEFORME,
 * jamais aux numéros déclarés par le client: certains opérateurs présentent
 * la ligne qui renvoie comme appelant sur un appel renvoyé (REL-11), et
 * raccrocher là couperait un vrai client.
 */
export interface PlatformLines {
  /** La ligne dédiée du client, quand il en a une. */
  dedicated?: string | null;
  /** La ligne partagée des essais. */
  shared?: string | null;
}

function callOf(event: any): any {
  return event?.message?.call ?? event?.call ?? null;
}

/** L'appelant tel que PRÉSENTÉ, sans la correction d'identité: c'est la forme brute qui trahit la boucle. */
export function presentedCaller(event: unknown): string | null {
  const call = callOf(event);
  const n = call?.customer?.number;
  return typeof n === 'string' && n.trim() ? n : null;
}

export function isSelfCall(event: unknown, lines: PlatformLines): boolean {
  const presented = presentedCaller(event);
  if (!presented) return false;
  return isOwnLine(presented, {
    vapiPhoneNumber: lines.dedicated ?? null,
    declared: lines.shared ? [{ number: lines.shared }] : [],
  });
}

/** L'adresse de contrôle de l'appel, portée par chaque événement Vapi. */
export function controlUrlOf(event: unknown): string | null {
  const call = callOf(event);
  const url = call?.monitor?.controlUrl;
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

/**
 * Raccroche un appel qui est notre propre transfert revenu. Ne lève jamais:
 * l'événement est traité sans être attendu, et un refus se lit dans les
 * journaux et au docteur, pas dans une pile.
 */
export async function hangUpSelfCall(
  event: unknown,
  clientId: string,
  endCall: (controlUrl: string) => Promise<void>,
): Promise<boolean> {
  const url = controlUrlOf(event);
  const caller = presentedCaller(event);
  if (!url) {
    logger.warn(`[Voice] BOUCLE entrante pour ${clientId} (appelant ${caller}) sans adresse de contrôle: impossible de raccrocher.`);
    return false;
  }
  try {
    await endCall(url);
    logger.warn(`[Voice] BOUCLE entrante raccrochée pour ${clientId}: l'appelant ${caller} est notre propre ligne (transfert revenu par le renvoi du client).`);
    return true;
  } catch (error) {
    logger.warn(`[Voice] BOUCLE entrante pour ${clientId}: raccrochage refusé: ${(error as Error).message}`);
    return false;
  }
}
