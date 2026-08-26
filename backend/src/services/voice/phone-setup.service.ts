import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { allocateInboundNumber, normalizeNumber } from './phone-allocation.service';
import { autoProvisionNumber, autoProvisionEnabled } from './phone-provisioning.service';

/**
 * Qui obtient quelle ligne entrante, et pourquoi.
 *
 * Trois chemins décidaient de la ligne d'un client, sans jamais se parler:
 * l'allocation du numéro partagé, l'achat automatique, et le numéro que le
 * client déclare lui-même. Aucun n'écrivait où il s'était arrêté, si bien
 * qu'un client sans ligne était indistinguable d'un client dont l'achat avait
 * échoué. On ne diagnostique pas ça depuis un tableau de bord, on le
 * diagnostique quand un appelant se plaint.
 *
 * Ce module les séquence et **écrit l'état**. Il ne remplace rien: il appelle
 * les deux services existants, dans l'ordre, et consigne le résultat.
 *
 * ── La règle commerciale ────────────────────────────────────────────────────
 *
 * Un numéro dédié à partir d'un abonnement PAYANT. Un essai reste sur la ligne
 * partagée avec un renvoi d'appel.
 *
 * Le critère est l'abonnement (`subscriptionStatus === 'active'`) et non le
 * palier: une ligne coûte de l'ordre d'un euro par mois contre 99 au moins
 * d'abonnement, donc la réserver aux gros paliers laisserait les petits clients
 * sur le chemin fragile pour une économie qui ne se voit pas. Ce qu'on ne veut
 * pas payer, c'est une ligne par essai gratuit, et c'est exactement ce que ce
 * critère écarte.
 *
 * ── Pourquoi c'est idempotent, et ce que ça évite ───────────────────────────
 *
 * `ensureLine` est sûr à rappeler autant qu'on veut. Un client déjà `active`
 * ressort immédiatement, SANS toucher à Vapi. Ce n'est pas une élégance: chaque
 * achat réussi facture une ligne au compte, donc une seconde activation
 * naïvement écrite ferait payer un numéro que personne ne composera jamais.
 * C'est le scénario « double activation » et il doit être un non-évènement.
 */

export type PhoneSetupState = 'none' | 'shared' | 'provisioning' | 'active' | 'failed';

export interface LineOutcome {
  state: PhoneSetupState;
  number: string | null;
  /** L'identifiant du numéro chez Vapi, quand il est connu. */
  numberId: string | null;
  /** En français, lisible par le client. Jamais vide sur un échec. */
  reason: string | null;
  /** Vrai quand rien n'a été fait parce que rien n'avait à l'être. */
  unchanged: boolean;
}

/** Un abonnement payé, par opposition à un essai. */
export function hasPaidSubscription(status: string | null | undefined): boolean {
  return (status || '').toLowerCase() === 'active';
}

class PhoneSetupService {
  /**
   * Donne une ligne à ce client, ou dit pourquoi il n'en a pas.
   *
   * Ne lève jamais: un onboarding qui échoue en levant laisse un client à
   * moitié créé, et c'est plus difficile à rattraper qu'un état `failed` avec
   * sa raison écrite.
   */
  async ensureLine(clientId: string, assistantIdOverride?: string): Promise<LineOutcome> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        vapiPhoneNumber: true,
        vapiAssistantId: true,
        subscriptionStatus: true,
        phoneSetupState: true,
      },
    });

    if (!client) {
      return { state: 'failed', number: null, numberId: null, reason: 'Client introuvable.', unchanged: true };
    }

    /* Déjà servi: on ne rappelle NI Vapi ni l'allocation. Le numéro fait foi,
       pas l'état: un état `active` sans numéro serait une incohérence, et le
       corriger ici vaut mieux que la propager. */
    if (client.phoneSetupState === 'active' && normalizeNumber(client.vapiPhoneNumber)) {
      return { state: 'active', number: client.vapiPhoneNumber, numberId: null, reason: null, unchanged: true };
    }

    /* `assistantIdOverride` sert l'onboarding: l'assistant vient d'être créé
       chez Vapi mais n'est pas encore écrit sur la fiche client, et lire la base
       ici rendrait `null` alors que l'assistant existe. Passer l'identifiant
       évite de réordonner les écritures de l'onboarding pour ce seul besoin. */
    const assistantId = assistantIdOverride ?? client.vapiAssistantId;

    if (hasPaidSubscription(client.subscriptionStatus)) {
      return this.provisionDedicated(client.id, assistantId);
    }
    return this.fallBackToShared(client.id, "L'essai utilise la ligne partagée. Un numéro dédié est attribué dès le passage à un abonnement.");
  }

  /**
   * Achète une ligne au client. Retombe sur la ligne partagée plutôt que de
   * laisser un client injoignable: une ligne partagée avec renvoi vaut mieux
   * qu'un numéro absent, et l'état dit lequel des deux on a obtenu.
   */
  private async provisionDedicated(clientId: string, assistantId: string | null): Promise<LineOutcome> {
    if (!assistantId) {
      // Vapi rattache le numéro à un assistant: sans lui, l'achat produirait
      // une ligne qui sonne dans le vide, et facturée.
      return this.fail(clientId, "L'assistant n'est pas encore créé. La ligne sera attribuée juste après.");
    }
    if (!autoProvisionEnabled()) {
      return this.fallBackToShared(clientId, "L'achat automatique de numéro est désactivé (PHONE_AUTO_PROVISION). Ligne partagée en attendant.");
    }

    await this.write(clientId, 'provisioning', null);

    const bought = await autoProvisionNumber(clientId, assistantId);
    if (!bought) {
      /* L'achat a échoué chez le fournisseur (pays non couvert, dossier
         réglementaire manquant, quota). On ne laisse pas le client sans ligne
         pour autant, et la raison reste écrite pour l'exploitant. */
      const shared = await this.fallBackToShared(clientId, "Le numéro dédié n'a pas pu être acheté. Ligne partagée en service, avec renvoi d'appel.");
      return shared;
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { vapiPhoneNumber: bought.number },
    });
    await this.write(clientId, 'active', null);
    logger.info(`[PhoneSetup] ${clientId}: ligne dédiée ${bought.number}`);
    return { state: 'active', number: bought.number, numberId: bought.numberId, reason: null, unchanged: false };
  }

  /**
   * Met le client sur la ligne partagée.
   *
   * L'allocation reste EXCLUSIVE: si un autre client vivant tient déjà ce
   * numéro, celui-ci repart sans ligne plutôt que de la partager. Deux clients
   * sur un même numéro entrant, c'est deux clients injoignables, pas deux
   * clients servis: rien ne distingue plus leurs appels.
   */
  private async fallBackToShared(clientId: string, why: string): Promise<LineOutcome> {
    const allocation = await allocateInboundNumber(clientId);

    if (allocation.kind === 'none') {
      const reason = allocation.reason === 'already_taken'
        ? "La ligne partagée est déjà attribuée à un autre client. Un numéro dédié est nécessaire."
        : "Aucune ligne n'est configurée sur la plateforme.";
      return this.fail(clientId, reason);
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { vapiPhoneNumber: allocation.number },
    });
    await this.write(clientId, 'shared', why);
    return { state: 'shared', number: allocation.number, numberId: allocation.numberId, reason: why, unchanged: false };
  }

  private async fail(clientId: string, reason: string): Promise<LineOutcome> {
    await this.write(clientId, 'failed', reason);
    logger.warn(`[PhoneSetup] ${clientId}: ${reason}`);
    return { state: 'failed', number: null, numberId: null, reason, unchanged: false };
  }

  private async write(clientId: string, state: PhoneSetupState, reason: string | null): Promise<void> {
    await prisma.client.update({
      where: { id: clientId },
      data: { phoneSetupState: state, phoneSetupReason: reason, phoneSetupAt: new Date() },
    });
  }
}

export const phoneSetupService = new PhoneSetupService();
