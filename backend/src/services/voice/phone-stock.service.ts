import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { vapiClient } from '../../config/vapi';

/**
 * Le stock de numéros belges, et comment on y pioche.
 *
 * ── Pourquoi un stock ───────────────────────────────────────────────────────
 *
 * Les deux chemins précédents mettaient une dépendance externe sur le chemin
 * critique de l'activation. `VAPI_PHONE_NUMBER` n'a qu'UNE ligne pour toute la
 * flotte, donc le deuxième client repart sans numéro. `PHONE_AUTO_PROVISION`
 * achète au moment de l'activation, donc il attend un dossier réglementaire
 * qu'un client ne peut pas fournir et qu'on ne veut de toute façon pas lui
 * demander.
 *
 * Le stock renverse l'ordre: le lot est acheté À L'AVANCE sous le dossier
 * réglementaire de Qwillio (une seule fois, jamais par client), les numéros
 * dorment non attribués, et l'activation ne fait plus que prendre le premier
 * libre. Le client ne fournit rien et n'attend rien.
 *
 * ── Ce qui doit rester vrai ─────────────────────────────────────────────────
 *
 * Un numéro attribué à deux clients, ce sont deux clients injoignables: rien
 * ne distingue plus leurs appels entrants. La prise est donc atomique en base
 * (`FOR UPDATE SKIP LOCKED`), et non pas « lire puis écrire », qui laisse la
 * fenêtre grande ouverte entre les deux.
 *
 * Un numéro pris mais qui ne sonne chez personne est PIRE que pas de numéro:
 * le client le voit actif et découvre la panne par un appelant. Si le
 * rattachement à l'assistant échoue chez Vapi, la prise est donc annulée.
 */

export type StockClaim =
  | { kind: 'claimed'; number: string; vapiNumberId: string | null; reused: boolean }
  | { kind: 'empty' }
  | { kind: 'failed'; reason: string };

interface ClaimedRow {
  id: string;
  number: string;
  vapiNumberId: string | null;
}

/**
 * Prend un numéro pour ce client et le fait sonner chez son assistant.
 *
 * Idempotent: un client qui en tient déjà un le retrouve (`reused: true`) sans
 * en consommer un second. Ce n'est pas un détail de confort — une double
 * activation consommerait un numéro du lot à chaque passage, en silence.
 */
export async function claimNumberForClient(clientId: string, assistantId: string): Promise<StockClaim> {
  const held = await prisma.phoneNumberStock.findFirst({
    where: { clientId, status: 'assigned' },
    select: { id: true, number: true, vapiNumberId: true },
    orderBy: { assignedAt: 'asc' },
  });

  if (held) {
    /* Le rattachement est rejoué: l'assistant a pu être recréé depuis (nouvel
       identifiant Vapi) alors que le numéro, lui, n'a pas bougé. */
    const attached = await attachAssistant(held.vapiNumberId, assistantId);
    if (!attached.ok) return { kind: 'failed', reason: attached.reason };
    return { kind: 'claimed', number: held.number, vapiNumberId: held.vapiNumberId, reused: true };
  }

  /* Une seule instruction SQL: le verrou de ligne et l'écriture sont pris
     ensemble, donc deux activations simultanées ne peuvent pas élire le même
     numéro. `SKIP LOCKED` fait que la seconde prend le suivant plutôt que
     d'attendre la première.

     Le critère est `client_id IS NULL`, et NON `status = 'available'`. C'est
     le propriétaire qui dit si un numéro est libre, le statut n'est qu'une
     étiquette — et les deux peuvent diverger: la suppression d'un client vide
     `client_id` par la contrainte (`ON DELETE SET NULL`) sans toucher au
     statut, laissant un numéro `assigned` que plus personne ne tient. Lire le
     statut ferait sortir cette ligne du lot POUR TOUJOURS, ce qui est
     précisément la fuite que ce module existe pour empêcher. */
  const rows = await prisma.$queryRaw<ClaimedRow[]>`
    UPDATE phone_number_stock
       SET status = 'assigned', client_id = ${clientId}::uuid, assigned_at = NOW(), released_at = NULL
     WHERE id = (
       SELECT id FROM phone_number_stock
        WHERE client_id IS NULL AND status <> 'retired'
        ORDER BY purchased_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id, number, vapi_number_id AS "vapiNumberId"
  `;

  const claimed = rows?.[0];
  if (!claimed) {
    logger.warn('[PhoneStock] stock vide: aucun numéro libre à attribuer.');
    return { kind: 'empty' };
  }

  const attached = await attachAssistant(claimed.vapiNumberId, assistantId);
  if (!attached.ok) {
    /* On rend le numéro plutôt que de laisser un client « actif » sur une
       ligne muette. Le numéro reste acheté et facturé de toute façon; ce qui
       compte est qu'il retourne dans le lot des libres. */
    await prisma.phoneNumberStock.update({
      where: { id: claimed.id },
      data: { status: 'available', clientId: null, assignedAt: null },
    });
    logger.error(`[PhoneStock] ${claimed.number} rendu au stock: ${attached.reason}`);
    return { kind: 'failed', reason: attached.reason };
  }

  logger.info(`[PhoneStock] ${claimed.number} attribué à ${clientId}`);
  await warnIfLow();
  return { kind: 'claimed', number: claimed.number, vapiNumberId: claimed.vapiNumberId, reused: false };
}

/**
 * Rend au stock les numéros d'un client (résiliation, remboursement).
 *
 * Le numéro n'est PAS rendu à Twilio: on le garde, il est déjà payé et déjà
 * couvert par le dossier. Il repart simplement dans le lot des libres. On le
 * détache aussi de l'assistant, sans quoi il continuerait de faire décrocher
 * la réceptionniste d'un client qui n'est plus abonné.
 */
export async function releaseClientNumbers(clientId: string): Promise<number> {
  const held = await prisma.phoneNumberStock.findMany({
    where: { clientId, status: 'assigned' },
    select: { id: true, number: true, vapiNumberId: true },
  });

  for (const line of held) {
    if (!line.vapiNumberId) continue;
    try {
      await vapiClient.updatePhoneNumber(line.vapiNumberId, { assistantId: null });
    } catch (error) {
      /* Le détachement chez Vapi peut échouer sans empêcher la libération en
         base: le numéro doit redevenir attribuable de toute façon, et le
         prochain preneur écrasera l'assistant. */
      logger.warn(`[PhoneStock] détachement Vapi échoué pour ${line.number}: ${(error as Error).message}`);
    }
  }

  const { count } = await prisma.phoneNumberStock.updateMany({
    where: { clientId, status: 'assigned' },
    data: { status: 'available', clientId: null, assignedAt: null, releasedAt: new Date() },
  });

  if (count > 0) logger.info(`[PhoneStock] ${count} numéro(s) rendu(s) au stock par ${clientId}`);
  return count;
}

export interface StockLevel {
  available: number;
  assigned: number;
  low: boolean;
}

/**
 * De quoi répondre « combien nous en reste-t-il » sans ouvrir la console Twilio.
 *
 * Compte sur le PROPRIÉTAIRE, comme la prise, et non sur le statut: un numéro
 * sans propriétaire est attribuable, quelle que soit l'étiquette qu'il porte.
 * Compter autrement afficherait un stock plus bas que la réalité et ferait
 * racheter une fournée pour rien.
 */
export async function stockLevel(): Promise<StockLevel> {
  const [available, assigned] = await Promise.all([
    prisma.phoneNumberStock.count({ where: { clientId: null, status: { not: 'retired' } } }),
    prisma.phoneNumberStock.count({ where: { clientId: { not: null } } }),
  ]);
  return { available, assigned, low: available < env.PHONE_STOCK_LOW_THRESHOLD };
}

/**
 * Signale un stock bas. Ne rachète RIEN: une fournée est une dépense, donc une
 * décision d'exploitation, exactement comme `PHONE_AUTO_PROVISION`.
 */
async function warnIfLow(): Promise<void> {
  try {
    const level = await stockLevel();
    if (level.low) {
      logger.warn(
        `[PhoneStock] stock bas: ${level.available} numéro(s) libre(s) ` +
          `(seuil ${env.PHONE_STOCK_LOW_THRESHOLD}). Racheter une fournée: npm run phone:buy`,
      );
    }
  } catch {
    /* Un compteur indisponible ne doit pas faire échouer une attribution qui,
       elle, a réussi. */
  }
}

/** Rattache le numéro à l'assistant chez Vapi. */
async function attachAssistant(
  vapiNumberId: string | null,
  assistantId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!vapiNumberId) {
    /* Numéro acheté chez Twilio mais jamais importé chez Vapi: il est facturé
       sans être joignable. Le script d'achat pose les deux; une ligne sans
       identifiant Vapi signale que l'import s'est arrêté en route. */
    return { ok: false, reason: "Le numéro n'est pas importé chez Vapi (vapiNumberId absent)." };
  }
  try {
    await vapiClient.updatePhoneNumber(vapiNumberId, { assistantId });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `Rattachement Vapi refusé: ${(error as Error).message}` };
  }
}
