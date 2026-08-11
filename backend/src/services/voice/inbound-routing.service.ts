import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

/**
 * Which client an inbound call belongs to (`assistant-request` routing).
 *
 * The receptionist webhook is per-tenant — `/webhooks/vapi/client/:clientId` —
 * but the Vapi phone number carries a single Server URL, so the tenant has to
 * be resolved from the call itself. The dialed number is the only thing that
 * identifies it.
 *
 * That works when a client owns their number. It degrades when several clients
 * share one: nothing in the call distinguishes them. Ce module tranche alors par
 * le plus récemment activé et hurle dans les journaux, parce qu'un appel
 * raccroché est perdu pour de bon là où un mauvais aiguillage se corrige.
 * L'attribution exclusive vit dans `phone-allocation.service.ts`, qui empêche ce
 * cas de se produire pour les clients créés par l'onboarding.
 */

export type InboundResolution =
  | { kind: 'resolved'; clientId: string; businessName: string; lineLabel?: string }
  | { kind: 'unknown'; dialed: string | null };

/** Digits only, so "+1 (607) 354-8569" and "+16073548569" compare equal. */
function normalizeNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

class InboundRoutingService {
  /**
   * Resolve the tenant for a call, from the number that was dialed.
   *
   * Matching is done in memory on normalised digits rather than in SQL: stored
   * numbers are not consistently formatted, and a `LIKE` on a formatted column
   * would miss the ones that are.
   */
  async resolveClient(dialedRaw: unknown): Promise<InboundResolution> {
    const dialed = normalizeNumber(dialedRaw);
    if (!dialed) return { kind: 'unknown', dialed: null };

    /* Deux sources, et non plus une: le numéro principal du client, et ses
       lignes supplémentaires (multi-sites). Un client qui n'en a aucune se
       comporte exactement comme avant. */
    const clients = await prisma.client.findMany({
      where: {
        vapiAssistantId: { not: null },
        subscriptionStatus: { in: ['active', 'trialing'] },
        OR: [
          { vapiPhoneNumber: { not: null } },
          { phoneNumbers: { some: { isActive: true } } },
        ],
      },
      select: {
        id: true,
        businessName: true,
        vapiPhoneNumber: true,
        // Servent uniquement à départager un numéro partagé, plus bas.
        activationDate: true,
        createdAt: true,
        phoneNumbers: { where: { isActive: true }, select: { number: true, label: true } },
      },
    });

    /* Un client est retenu si le numéro composé est SON principal ou l'une de
       ses lignes. Le dédoublonnage se fait par client, pas par numéro: deux
       lignes du même client ne doivent pas ressembler à une ambiguïté. */
    const matches = clients.filter(c =>
      normalizeNumber(c.vapiPhoneNumber) === dialed ||
      (c.phoneNumbers ?? []).some(p => normalizeNumber(p.number) === dialed)
    );

    if (matches.length === 1) {
      const c = matches[0];
      /* Quelle LIGNE a sonné, quand ce n'est pas la principale: c'est ce qui
         permet plus tard de dire « Boutique Ixelles, bonjour » plutôt que le
         nom générique de l'entreprise. */
      const line = (c.phoneNumbers ?? []).find(p => normalizeNumber(p.number) === dialed);
      return {
        kind: 'resolved',
        clientId: c.id,
        businessName: c.businessName,
        ...(line?.label ? { lineLabel: line.label } : {}),
      };
    }

    if (matches.length > 1) {
      /* Plusieurs clients vivants sur la même ligne. On refusait de trancher, et
         l'appelant entendait « ligne non configurée »: le deuxième client cassait
         donc aussi le premier. Raccrocher est pourtant le pire des deux maux, un
         appel manqué étant définitif là où un mauvais aiguillage se rattrape.
         On départage par le plus récemment activé, qui est le seul ordre non
         arbitraire disponible, et on crie dans les journaux: c'est une anomalie
         d'exploitation, à corriger en achetant une ligne, pas un cas normal.
         `allocateInboundNumber` empêche désormais cette situation de naître; ce
         bloc ne couvre que les fiches posées à la main ou héritées. */
      const ranked = [...matches].sort(
        (a, b) =>
          (b.activationDate?.getTime() ?? b.createdAt.getTime()) -
          (a.activationDate?.getTime() ?? a.createdAt.getTime()),
      );
      const chosen = ranked[0];
      logger.error(
        `[InboundRouting] ${matches.length} clients partagent ${dialed} ` +
          `(${matches.map(c => c.businessName).join(', ')}). ` +
          `Appel routé vers « ${chosen.businessName} », le plus récemment activé. ` +
          'Donner une ligne propre à chaque client.',
      );
      const line = (chosen.phoneNumbers ?? []).find(p => normalizeNumber(p.number) === dialed);
      return {
        kind: 'resolved',
        clientId: chosen.id,
        businessName: chosen.businessName,
        ...(line?.label ? { lineLabel: line.label } : {}),
      };
    }

    logger.warn(`[InboundRouting] no active client owns ${dialed}`);
    return { kind: 'unknown', dialed };
  }

  /**
   * What the caller hears when routing fails.
   *
   * Deliberately not silence and not a technical message: someone rang a
   * business and deserves a sentence they can act on. It also does not pretend
   * to be any particular business, because we do not know which one they wanted.
   */
  unroutableAssistant(lang: 'fr' | 'en' = 'fr') {
    const message = lang === 'fr'
      ? "Bonjour, cette ligne n'est pas encore configurée. Merci de rappeler un peu plus tard."
      : 'Hello, this line is not set up yet. Please try again a little later.';

    return {
      name: 'Unrouted line',
      firstMessage: message,
      // Say the line and hang up. No model, no tools: there is nothing to
      // discuss, and keeping the caller on an agent with no business context
      // would only waste their time and our minutes.
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        maxTokens: 40,
        messages: [{ role: 'system', content: `Say exactly: "${message}" then end the call.` }],
      },
      endCallFunctionEnabled: true,
      endCallMessage: message,
      maxDurationSeconds: 20,
    };
  }
}

export const inboundRoutingService = new InboundRoutingService();
