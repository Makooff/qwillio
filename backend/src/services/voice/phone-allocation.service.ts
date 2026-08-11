import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

/**
 * Qui possède quel numéro entrant.
 *
 * Historiquement, l'onboarding recopiait `VAPI_PHONE_NUMBER` dans CHAQUE client:
 * un seul numéro Twilio pour tout le monde, le routage étant censé se faire par
 * l'URL de webhook de l'assistant. Ça marche pour un appel SORTANT, où l'on sait
 * quel assistant on lance. Ça ne peut pas marcher en ENTRANT: le numéro composé
 * est la seule chose qui identifie l'entreprise appelée, et si deux clients le
 * partagent, plus rien ne les distingue.
 *
 * Conséquence mesurée: le deuxième client activé casse aussi le premier, parce
 * que `inbound-routing` refusait alors de trancher. Ce module rend l'attribution
 * exclusive: le premier client vivant qui prend le numéro le garde, les suivants
 * repartent sans numéro et l'exploitant est prévenu, plutôt que de découvrir la
 * panne par un appelant.
 */

/** Chiffres seuls, pour que « +32 2 555 00 11 » et « +3225550011 » comparent égal. */
export function normalizeNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export type Allocation =
  | { kind: 'allocated'; number: string; numberId: string | null }
  | { kind: 'none'; reason: 'not_configured' | 'already_taken'; heldBy?: string };

/**
 * Réserve le numéro entrant d'un client.
 *
 * Ne consulte que les clients VIVANTS (`active` / `trialing`): un client résilié
 * ne doit pas immobiliser une ligne. Le client lui-même est exclu de la
 * recherche, si bien qu'un ré-onboarding conserve son propre numéro.
 */
export async function allocateInboundNumber(clientId: string): Promise<Allocation> {
  const configured = env.VAPI_PHONE_NUMBER;
  const wanted = normalizeNumber(configured);
  if (!configured || !wanted) {
    return { kind: 'none', reason: 'not_configured' };
  }

  /* Comparaison en mémoire et non en SQL: les numéros stockés ne sont pas
     formatés de façon homogène, un `LIKE` sur la colonne raterait les autres
     écritures du même numéro. Le volume de clients vivants reste petit. */
  const live = await prisma.client.findMany({
    where: {
      id: { not: clientId },
      subscriptionStatus: { in: ['active', 'trialing'] },
    },
    select: {
      id: true,
      businessName: true,
      vapiPhoneNumber: true,
      phoneNumbers: { where: { isActive: true }, select: { number: true } },
    },
  });

  const holder = live.find(
    c =>
      normalizeNumber(c.vapiPhoneNumber) === wanted ||
      (c.phoneNumbers ?? []).some(p => normalizeNumber(p.number) === wanted),
  );

  if (holder) {
    logger.error(
      `[PhoneAllocation] ${configured} est déjà pris par « ${holder.businessName} » (${holder.id}). ` +
        `Le client ${clientId} reste sans ligne entrante: il faut lui acheter un numéro.`,
    );
    return { kind: 'none', reason: 'already_taken', heldBy: holder.businessName };
  }

  return { kind: 'allocated', number: configured, numberId: env.VAPI_PHONE_NUMBER_ID || null };
}
