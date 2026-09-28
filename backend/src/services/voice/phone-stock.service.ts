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
 * le client le voit actif et découvre la panne par un appelant. La prise est
 * donc annulée dès que le rattachement échoue.
 *
 * ── CE QUI FAIT SONNER UN NUMÉRO A CHANGÉ (28/09/2026) ──────────────────────
 *
 * Ce module a été écrit quand Vapi décrochait. Il attribuait un numéro, le
 * rattachait à l'assistant Vapi, et c'était tout. Le cœur vocal, lui, ne
 * connaît pas Vapi: au décroché il appelle `/context/by-number`, qui cherche
 * le client dans `client_phone_numbers` (ou dans `clients.vapi_phone_number`).
 *
 * Personne n'écrivait cette ligne. Un client activé recevait donc un numéro
 * attribué en base, branché sur Vapi, et TOTALEMENT INCONNU de la
 * réceptionniste — qui décrochait au nom générique de « Qwillio » chez un
 * client qui paie pour le sien, quand elle décrochait. Le seul client qui
 * fonctionnait devait sa ligne au script de seed, écrite à la main.
 *
 * L'ordre d'importance est donc inversé ici, explicitement:
 *
 *   1. `client_phone_numbers` est BLOQUANT. C'est la seule table que le cœur
 *      vocal lit, donc c'est elle qui décide si le numéro sonne. Si elle
 *      échoue, le numéro repart au stock — la règle du dessus, appliquée à ce
 *      qui tient désormais le rôle.
 *   2. Le rattachement Vapi devient DE CONFORT. Il est rejoué quand la ligne
 *      en porte encore un identifiant, et son échec ne fait plus rien tomber:
 *      Twilio n'envoie l'appel qu'à UN seul destinataire, et ce destinataire
 *      est le trunk SIP dès que le numéro y est rattaché.
 *   3. On refuse la prise si le numéro ne sonne NULLE PART — ni trunk SIP, ni
 *      Vapi. C'est la règle d'origine, rendue à sa forme générale.
 */

export type StockClaim =
  | { kind: 'claimed'; number: string; vapiNumberId: string | null; reused: boolean }
  | { kind: 'empty' }
  | { kind: 'failed'; reason: string };

interface ClaimedRow {
  id: string;
  number: string;
  vapiNumberId: string | null;
  sipTrunkSid: string | null;
}

/**
 * Où ce numéro sonne-t-il, s'il sonne.
 *
 * `voice-core` gagne quand les deux sont posés: Twilio n'achemine un numéro
 * que vers UN destinataire, et un numéro rattaché au trunk SIP part chez
 * LiveKit quoi que Vapi en pense.
 */
function acheminement(ligne: { vapiNumberId: string | null; sipTrunkSid: string | null }):
  | 'voice-core'
  | 'vapi'
  | null {
  if (ligne.sipTrunkSid) return 'voice-core';
  if (ligne.vapiNumberId) return 'vapi';
  return null;
}

/**
 * Inscrit la ligne LÀ OÙ LE CŒUR VOCAL LA LIT.
 *
 * `client_phone_numbers` n'a pas de contrainte d'unicité sur (client, numéro):
 * on lit puis on écrit. La fenêtre est sans danger ici — la prise du stock,
 * elle, est atomique, donc deux activations du même client ne peuvent pas
 * tenir deux numéros différents, et le pire cas est une ligne réactivée deux
 * fois.
 *
 * Une ligne déjà là est RÉACTIVÉE plutôt que dupliquée: deux lignes actives
 * pour le même numéro feraient dépendre la réponse de `findFirst`, c'est-à-dire
 * de l'ordre d'insertion.
 */
async function inscrireLaLigne(
  clientId: string,
  numero: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const existante = await prisma.clientPhoneNumber.findFirst({
      where: { clientId, number: numero },
      select: { id: true, isActive: true },
    });

    if (existante) {
      if (!existante.isActive) {
        await prisma.clientPhoneNumber.update({
          where: { id: existante.id },
          data: { isActive: true },
        });
      }
      return { ok: true };
    }

    await prisma.clientPhoneNumber.create({
      data: { clientId, number: numero, label: 'Ligne principale', isActive: true },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `Inscription de la ligne refusée: ${(error as Error).message}` };
  }
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
    select: { id: true, number: true, vapiNumberId: true, sipTrunkSid: true },
    orderBy: { assignedAt: 'asc' },
  });

  if (held) {
    /* L'INSCRIPTION EST REJOUÉE, ET C'EST TOUT L'INTÉRÊT DE PASSER ICI.
       Les clients activés avant cette correction tiennent un numéro sans ligne
       dans `client_phone_numbers`: ils sont injoignables et rien ne le dit. Une
       réactivation les répare, sans consommer un second numéro. */
    const inscrite = await inscrireLaLigne(clientId, held.number);
    if (!inscrite.ok) return { kind: 'failed', reason: inscrite.reason };
    await rejouerVapi(held, assistantId);
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
    RETURNING id, number, vapi_number_id AS "vapiNumberId", sip_trunk_sid AS "sipTrunkSid"
  `;

  const claimed = rows?.[0];
  if (!claimed) {
    logger.warn('[PhoneStock] stock vide: aucun numéro libre à attribuer.');
    return { kind: 'empty' };
  }

  /* On rend le numéro plutôt que de laisser un client « actif » sur une ligne
     muette. Le numéro reste acheté et facturé de toute façon; ce qui compte
     est qu'il retourne dans le lot des libres. */
  const rendre = async (raison: string): Promise<StockClaim> => {
    await prisma.phoneNumberStock.update({
      where: { id: claimed.id },
      data: { status: 'available', clientId: null, assignedAt: null },
    });
    logger.error(`[PhoneStock] ${claimed.number} rendu au stock: ${raison}`);
    return { kind: 'failed', reason: raison };
  };

  /* Le numéro ne sonne nulle part: ni trunk SIP, ni Vapi. L'attribuer
     donnerait au client une ligne qu'aucun appel n'atteindra. */
  if (acheminement(claimed) === null) {
    return rendre(
      `${claimed.number} n'est rattaché à rien (ni trunk SIP, ni Vapi): ` +
        'acheté et facturé, mais aucun appel ne lui parviendra.',
    );
  }

  /* LA LIGNE QUE LE CŒUR VOCAL LIT. Bloquante: sans elle, `/context/by-number`
     ne trouve pas le client et la réceptionniste décroche au nom générique. */
  const inscrite = await inscrireLaLigne(clientId, claimed.number);
  if (!inscrite.ok) return rendre(inscrite.reason);

  await rejouerVapi(claimed, assistantId);

  logger.info(
    `[PhoneStock] ${claimed.number} attribué à ${clientId} (acheminement: ${acheminement(claimed)})`,
  );
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

  /* ÉTEINDRE LA LIGNE AVANT DE RENDRE LE NUMÉRO, et ce n'est pas un détail de
     ménage. Une ligne laissée active pointe encore vers l'ancien client; le
     numéro repart au lot, un nouveau client le prend, et `/context/by-number`
     trouve alors DEUX lignes pour ce numéro. Le résident de la première
     décroche chez le second — avec son nom, ses horaires et ses rendez-vous.
     La symétrie de l'inscription est donc obligatoire, pas facultative. */
  for (const line of held) {
    try {
      await prisma.clientPhoneNumber.updateMany({
        where: { clientId, number: line.number },
        data: { isActive: false },
      });
    } catch (error) {
      logger.error(
        `[PhoneStock] ligne ${line.number} NON désactivée: ${(error as Error).message}. ` +
          'Elle répondra encore pour ce client si le numéro est réattribué.',
      );
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

/**
 * Rattache le numéro à l'assistant Vapi — AU MIEUX, plus jamais en bloquant.
 *
 * Tant que des numéros restent acheminés vers Vapi, ce rattachement est ce qui
 * les fait sonner, et il continue donc d'être rejoué. Mais il ne décide plus
 * du sort d'une activation: un numéro déjà sur le trunk SIP n'a rien à faire
 * chez Vapi, et faire échouer sa prise parce qu'une API qu'on quitte a répondu
 * 4xx serait se rendre dépendant de ce qu'on est en train de retirer.
 *
 * L'échec est journalisé en `warn` et non avalé: quand la ligne est encore
 * VRAIMENT chez Vapi, c'est la seule trace qui dira pourquoi elle ne sonne pas.
 */
async function rejouerVapi(
  ligne: { number: string; vapiNumberId: string | null; sipTrunkSid: string | null },
  assistantId: string,
): Promise<void> {
  if (!ligne.vapiNumberId) return;
  try {
    await vapiClient.updatePhoneNumber(ligne.vapiNumberId, { assistantId });
  } catch (error) {
    /* Un accès indexé sur le journal se type mal et n'apporte rien : deux
       branches explicites, et le message n'est pas le même de toute façon. */
    if (acheminement(ligne) === 'vapi') {
      logger.error(
        `[PhoneStock] rattachement Vapi échoué pour ${ligne.number}: ` +
          `${(error as Error).message} — ce numéro est acheminé vers Vapi, il ne sonnera pas.`,
      );
    } else {
      logger.warn(
        `[PhoneStock] rattachement Vapi échoué pour ${ligne.number}: ` +
          `${(error as Error).message} (sans effet : le numéro est acheminé vers le cœur vocal).`,
      );
    }
  }
}
