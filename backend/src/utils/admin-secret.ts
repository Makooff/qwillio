import crypto from 'crypto';
import type { Request } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * La porte de service opérateur: `x-admin-secret` vaut rôle admin, sans JWT.
 *
 * Elle existait en trois copies (`authMiddleware`, `adminMiddleware`,
 * `requireAdmin`) avec trois comportements légèrement différents, comparées au
 * `===` et surtout **sans laisser la moindre trace**. Un passe-partout muet est
 * un passe-partout dont on ne saura jamais s'il a servi, ni à qui: c'est ce
 * point-là que l'audit classait « sécurité critique », pas l'existence de la
 * porte.
 *
 * Ce module ne supprime pas la porte — l'outillage d'exploitation s'en sert —
 * mais il la rend défendable:
 *
 *  1. **comparaison à temps constant**, comme pour le secret Vapi;
 *  2. **longueur minimale imposée**: un secret court est une clé maîtresse
 *     énumérable. En dessous du seuil il est ignoré, et l'appel retombe sur le
 *     JWT — refuser vaut mieux qu'accepter un secret faible;
 *  3. **journalisation de chaque usage**, avec la route et l'IP, pour qu'un
 *     usage inattendu soit visible dans les logs au lieu d'être invisible.
 *
 * État final souhaitable, hors périmètre ici parce qu'il demande de savoir quels
 * scripts d'exploitation en dépendent: supprimer la porte et n'émettre que des
 * JWT de service à durée limitée.
 */

/** 32 caractères: au-delà du domaine où l'énumération hors-ligne a un sens. */
export const MIN_ADMIN_SECRET_LENGTH = 32;

let warnedAboutWeakSecret = false;

/**
 * Le secret est-il utilisable ? Un secret vide désactive la porte (comportement
 * historique); un secret trop court la désactive AUSSI, en le disant une fois.
 */
function usableSecret(): string | null {
  const secret = env.ADMIN_SECRET;
  if (!secret) return null;
  if (secret.length < MIN_ADMIN_SECRET_LENGTH) {
    if (!warnedAboutWeakSecret) {
      warnedAboutWeakSecret = true;
      logger.error(
        `[Admin] ADMIN_SECRET fait ${secret.length} caractères, minimum ${MIN_ADMIN_SECRET_LENGTH}. ` +
        'La porte de service est DÉSACTIVÉE tant qu il n est pas rallongé: un secret court ' +
        'accorderait un accès administrateur total à qui l énumère.',
      );
    }
    return null;
  }
  return secret;
}

/**
 * `true` si la requête porte le secret opérateur valide.
 *
 * `scope` sert uniquement à la trace: il dit quelle porte a été franchie.
 */
export function isAdminSecretAuthorized(req: Request, scope: string): boolean {
  const expected = usableSecret();
  if (!expected) return false;

  const provided = req.headers['x-admin-secret'];
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    return false;
  }
  if (!crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return false;
  }

  /* La trace est le cœur du correctif. Elle part en `warn` et non en `info`:
     un accès administrateur sans compte est un événement, pas une routine. */
  logger.warn(
    `[Admin] accès par secret opérateur (${scope}) — ${req.method} ${req.originalUrl || req.url} ` +
    `depuis ${req.ip || 'ip inconnue'}`,
  );
  return true;
}

/** Réinitialise l'avertissement « secret trop court » (tests uniquement). */
export function __resetAdminSecretWarning(): void {
  warnedAboutWeakSecret = false;
}
