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
 * That works when a client owns their number. It cannot work when several
 * clients share one: the same number then maps to several tenants and nothing
 * in the call distinguishes them. This module makes that ambiguity explicit and
 * loud rather than silently answering as the wrong business, which is the worst
 * possible failure — one client's caller hearing another client's agent.
 */

export type InboundResolution =
  | { kind: 'resolved'; clientId: string; businessName: string }
  | { kind: 'unknown'; dialed: string | null }
  | { kind: 'ambiguous'; dialed: string; candidates: number };

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

    const clients = await prisma.client.findMany({
      where: {
        vapiAssistantId: { not: null },
        vapiPhoneNumber: { not: null },
        subscriptionStatus: { in: ['active', 'trialing'] },
      },
      select: { id: true, businessName: true, vapiPhoneNumber: true },
    });

    const matches = clients.filter(c => normalizeNumber(c.vapiPhoneNumber) === dialed);

    if (matches.length === 1) {
      return { kind: 'resolved', clientId: matches[0].id, businessName: matches[0].businessName };
    }

    if (matches.length > 1) {
      // Shared number with several live tenants. Answering as any one of them
      // is a coin flip that a real caller pays for, so we refuse instead.
      logger.error(
        `[InboundRouting] ${matches.length} clients share ${dialed} — cannot tell which one was called. ` +
          'Give each client their own Vapi number.'
      );
      return { kind: 'ambiguous', dialed, candidates: matches.length };
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
