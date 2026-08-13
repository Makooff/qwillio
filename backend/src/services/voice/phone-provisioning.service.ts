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

/**
 * Rattache un numéro DÉJÀ ACHETÉ dans notre compte Twilio à un client.
 *
 * C'est la seule voie pour la Belgique: les opérateurs belges exigent qu'un
 * numéro soit rattaché à une adresse belge via un dossier réglementaire, et ce
 * dossier vit dans notre compte Twilio — pas dans celui de Vapi, que
 * `autoProvisionNumber` utilise. On achète donc chez nous, puis on confie.
 *
 * Contrairement à l'achat automatique, cette fonction n'est derrière aucun
 * drapeau: elle ne dépense rien, le numéro est déjà payé. Elle refuse en
 * revanche d'attribuer deux fois le même numéro, parce qu'un numéro entrant
 * appartient à UN client et qu'en recopier un rendrait les deux injoignables
 * (le piège documenté dans CLAUDE.md).
 */
export async function attachOwnedNumber(
  clientId: string,
  assistantId: string,
  number: string,
  label = 'Ligne principale',
): Promise<ProvisionedNumber | { error: string }> {
  const trimmed = number.trim();
  if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
    return { error: 'number must be E.164, e.g. +3223215400' };
  }
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return { error: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants' };
  }

  const alreadyTaken = await prisma.clientPhoneNumber.findFirst({
    where: { number: trimmed },
    select: { clientId: true },
  });
  if (alreadyTaken) {
    return {
      error: alreadyTaken.clientId === clientId
        ? 'ce numéro est déjà attribué à ce client'
        : 'ce numéro est déjà attribué à un AUTRE client',
    };
  }

  try {
    const linked = (await vapiClient.importTwilioNumber({
      number: trimmed,
      twilioAccountSid: env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: env.TWILIO_AUTH_TOKEN,
      assistantId,
      name: label,
    })) as { id?: string; number?: string };

    if (!linked?.id) {
      logger.error(`[PhoneProvisioning] Vapi n'a pas rendu d'id pour ${trimmed}: ${JSON.stringify(linked)}`);
      return { error: 'Vapi a refusé le numéro (voir les logs)' };
    }

    await prisma.clientPhoneNumber.create({
      data: { clientId, number: trimmed, label },
    });

    logger.info(`[PhoneProvisioning] numéro possédé ${trimmed} rattaché à ${clientId}`);
    return { number: trimmed, numberId: linked.id };
  } catch (error) {
    logger.error(`[PhoneProvisioning] rattachement échoué pour ${trimmed}: ${(error as Error).message}`);
    return { error: (error as Error).message };
  }
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
