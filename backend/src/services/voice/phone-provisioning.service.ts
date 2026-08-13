import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { vapiClient } from '../../config/vapi';

/**
 * Achat automatique d'un numéro entrant (roadmap 2.4).
 *
 * Le bloquant vente n°1: un seul numéro partagé, le client n°2 restait sans
 * ligne avec une alerte Discord demandant un achat MANUEL. `buyPhoneNumber`
 * existait dans le client Vapi depuis le début — sans aucun appelant.
 *
 * Derrière `PHONE_AUTO_PROVISION=1`, STRICTEMENT off par défaut: chaque appel
 * réussi ACHÈTE un numéro Twilio facturé au compte. On n'active pas une
 * dépense récurrente par défaut de code; c'est une décision d'exploitation.
 *
 * Limite connue: l'achat passe par le compte Twilio de Vapi (numéros US, ou
 * du pays supporté par le compte). Un numéro BELGE exige un bundle
 * réglementaire (adresse locale, justificatifs) — dépendance externe notée
 * dans ROADMAP.md; ce service saura le poser le jour où le compte l'a.
 */

export interface ProvisionedNumber {
  number: string;
  numberId: string;
}

export function autoProvisionEnabled(): boolean {
  return env.PHONE_AUTO_PROVISION === '1';
}

/**
 * Achète un numéro et l'attache à l'assistant du client. Retourne null sur
 * échec (l'appelant garde alors le chemin actuel: alerte + achat manuel).
 */
export async function autoProvisionNumber(
  clientId: string,
  assistantId: string,
): Promise<ProvisionedNumber | null> {
  if (!autoProvisionEnabled()) return null;

  try {
    const bought = (await vapiClient.buyPhoneNumber({
      assistantId,
      ...(env.PHONE_PROVISION_AREA_CODE ? { areaCode: env.PHONE_PROVISION_AREA_CODE } : {}),
    })) as { id?: string; number?: string };

    if (!bought?.id || !bought?.number) {
      logger.error(`[PhoneProvisioning] réponse Vapi sans id/number pour ${clientId}: ${JSON.stringify(bought)}`);
      return null;
    }

    /* `ClientPhoneNumber` est la source de vérité multi-lignes: c'est elle que
       lit le routage entrant. Le label dit d'où vient la ligne — un numéro
       acheté par un automate doit rester distinguable d'un numéro posé à la
       main. */
    await prisma.clientPhoneNumber.create({
      data: {
        clientId,
        number: bought.number,
        label: 'Ligne principale (provisionnée automatiquement)',
      },
    });

    logger.info(`[PhoneProvisioning] numéro ${bought.number} acheté pour ${clientId}`);
    return { number: bought.number, numberId: bought.id };
  } catch (error) {
    logger.error(`[PhoneProvisioning] achat échoué pour ${clientId}: ${(error as Error).message}`);
    return null;
  }
}
