import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { normalizeNumber } from './phone-allocation.service';
import { divertedNumber } from './inbound-routing.service';

/**
 * La preuve que le renvoi d'appel FONCTIONNE (REL-10).
 *
 * `forwardingVerifiedAt` était faux par construction. Deux écritures le
 * posaient, et aucune des deux ne vérifiait quoi que ce soit: le cron quotidien
 * `forwarding-verification` journalisait un numéro puis horodatait la colonne,
 * sans passer le moindre appel, et l'inscription la posait sur la simple
 * présence d'un numéro d'entreprise. La liste d'installation lisait ce champ,
 * donc l'étape « renvoi » naissait VERTE pour tout le monde — le même défaut
 * que l'étape du numéro de transfert, à un autre endroit.
 *
 * Ce qui prouve un renvoi n'est pas une déclaration, c'est un appel qui est
 * arrivé PAR ce renvoi. Un appel entrant qui porte un en-tête de diversion
 * nommant la ligne du client dit exactement cela, et rien d'autre ne le dit:
 * ni la validité du numéro, ni une sonde qui appellerait la ligne Qwillio (elle
 * répondrait même si le renvoi était coupé).
 *
 * Ce que ça n'atteint pas: un opérateur qui n'envoie aucun en-tête de diversion.
 * L'appel se déroule normalement et le renvoi reste simplement non prouvé — la
 * déclaration du client (`forwardingStatus`) continue de tenir lieu de réponse,
 * en étant lisiblement une déclaration.
 */

/**
 * On ne réécrit pas la colonne à chaque appel: un client à cent appels par jour
 * ferait cent écritures pour la même information. Une par jour suffit, et
 * l'horodatage garde son sens — « prouvé récemment » plutôt que « prouvé un
 * jour ».
 */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

class ForwardingProofService {
  /**
   * Enregistre la preuve si l'appel en porte une. Ne lève jamais: un appel en
   * cours ne tombe pas parce qu'une colonne d'installation n'a pas pu s'écrire.
   */
  async noteInboundCall(clientId: string, event: unknown): Promise<boolean> {
    try {
      const diverted = divertedNumber(event);
      if (!diverted) return false;

      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          contactPhone: true,
          forwardingVerifiedAt: true,
          user: { select: { businessPhone: true } },
        },
      });
      if (!client) return false;

      /* La diversion doit nommer la ligne DU CLIENT, et les deux colonnes qui
         la portent sont lues: la fiche client et le compte qui l'a créée
         peuvent diverger, et une seule des deux est parfois remplie.
         `transferNumber` n'en fait volontairement PAS partie: c'est le mobile
         du gérant, vers lequel on transfère. Un appel renvoyé depuis lui
         décrirait une boucle, pas un renvoi installé. */
      const own = [client.contactPhone, client.user?.businessPhone]
        .map(n => normalizeNumber(n ?? null))
        .filter((n): n is string => Boolean(n));
      if (!own.includes(diverted)) return false;

      const last = client.forwardingVerifiedAt?.getTime() ?? 0;
      if (Date.now() - last < REFRESH_AFTER_MS) return false;

      await prisma.client.update({
        where: { id: clientId },
        data: { forwardingVerifiedAt: new Date(), forwardingStatus: 'verified' },
      });
      logger.info(`[Forwarding] renvoi prouvé pour ${clientId} par un appel renvoyé de ${diverted}`);
      return true;
    } catch (error) {
      logger.warn(`[Forwarding] preuve non enregistrée pour ${clientId}: ${(error as Error).message}`);
      return false;
    }
  }
}

export const forwardingProofService = new ForwardingProofService();
