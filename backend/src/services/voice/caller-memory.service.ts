import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { realtimeContextService } from './realtime-context.service';
import { normalizeNumber } from './phone-allocation.service';

/**
 * Persistent caller memory.
 *
 * `ClientCall` already records every call, but answering "what do we know about
 * this number" from it means scanning and re-summarising history while the
 * phone is ringing. `CallerMemory` is the collapsed view: one row per caller
 * per client, rewritten at the end of each call and read in one indexed lookup.
 *
 * What it buys, concretely: the agent greets a repeat caller by name, does not
 * re-ask for an email it already has, and can open with "calling about your
 * Thursday appointment?" instead of "how can I help?".
 */

export interface CallerMemoryRecord {
  knownName: string | null;
  email: string | null;
  profileSummary: string | null;
  preferences: string[];
  totalCalls: number;
  lastCallAt: Date | null;
  lastSummary: string | null;
  lastOutcome: string | null;
  isBlocked: boolean;
}

/** Keep the rolling summary short: it is injected into every call's prompt. */
const MAX_SUMMARY_CHARS = 400;
const MAX_PREFERENCES = 6;

class CallerMemoryService {
  async get(clientId: string, callerNumber: string | null): Promise<CallerMemoryRecord | null> {
    if (!callerNumber) return null;
    try {
      const row = await prisma.callerMemory.findUnique({
        where: { clientId_callerNumber: { clientId, callerNumber } },
        select: {
          knownName: true,
          email: true,
          profileSummary: true,
          preferences: true,
          totalCalls: true,
          lastCallAt: true,
          lastSummary: true,
          lastOutcome: true,
          isBlocked: true,
        },
      });
      return row;
    } catch (error) {
      // Memory is an enhancement. A failed lookup must never stop a call from
      // being answered.
      logger.warn(`[CallerMemory] lookup failed for ${clientId}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Fold one finished call into the caller's memory.
   *
   * The rolling summary is built from the previous one plus this call rather
   * than by re-reading history, so the write stays O(1) and the row keeps a
   * continuous picture instead of only the most recent call.
   */
  async remember(input: {
    clientId: string;
    callerNumber: string | null;
    name?: string | null;
    email?: string | null;
    summary?: string | null;
    outcome?: string | null;
    preferences?: string[];
  }): Promise<void> {
    if (!input.callerNumber) return;

    /* LA CLÉ SE NORMALISE ICI, ET NULLE PART AILLEURS (19/09/2026).
     *
     * `captureLead` écrit la mémoire sous `dictated.e164 ?? session.callerNumber`.
     * Le second est passé par `normalizeNumber`, donc des CHIFFRES seuls; le
     * premier est de l'E.164, donc avec un « + ». Or la lecture
     * (`getCallerHistory`) interroge la clé unique avec le numéro de la ligne
     * appelante, qui est toujours la forme chiffres.
     *
     * Conséquence exacte, et c'est le retour du 19/09 mot pour mot: un appelant
     * qui DICTE un numéro de rappel voit son nom et son résumé classés sous
     * « +32… », une clé que rien ne relit jamais. Au rappel suivant l'agent ne
     * le reconnaît pas, redemande son nom, et le cycle recommence. La requête
     * réussit et ne trouve rien, en silence — le mode d'échec de `phoneForms`,
     * ici sur la seule table à clé unique, où `in` n'est pas possible.
     *
     * La normalisation vit donc à l'ÉCRITURE, au passage obligé, parce qu'une
     * seconde règle écrite près d'un appelant divergerait (6vicies). */
    const callerNumber = normalizeNumber(input.callerNumber) ?? input.callerNumber;

    try {
      const existing = await prisma.callerMemory.findUnique({
        where: { clientId_callerNumber: { clientId: input.clientId, callerNumber } },
        select: { profileSummary: true, preferences: true, knownName: true, email: true },
      });

      const preferences = this.mergePreferences(existing?.preferences ?? [], input.preferences ?? []);
      const profileSummary = this.rollSummary(existing?.profileSummary ?? null, input.summary ?? null);

      await prisma.callerMemory.upsert({
        where: { clientId_callerNumber: { clientId: input.clientId, callerNumber } },
        create: {
          clientId: input.clientId,
          callerNumber,
          knownName: input.name ?? null,
          email: input.email ?? null,
          profileSummary,
          preferences,
          totalCalls: 1,
          lastCallAt: new Date(),
          lastSummary: input.summary ?? null,
          lastOutcome: input.outcome ?? null,
        },
        update: {
          // Never overwrite a known value with a null: a call where the caller
          // did not restate their name must not erase the name we already had.
          knownName: input.name ?? existing?.knownName ?? null,
          email: input.email ?? existing?.email ?? null,
          profileSummary,
          preferences,
          totalCalls: { increment: 1 },
          lastCallAt: new Date(),
          lastSummary: input.summary ?? null,
          lastOutcome: input.outcome ?? null,
        },
      });

      /* Le cache se vide sur les DEUX écritures: la forme normalisée qu'on
         vient d'écrire, et celle qu'on a reçue, sous laquelle une entrée de
         cache a pu être posée par une lecture antérieure. */
      await realtimeContextService.invalidateCaller(input.clientId, callerNumber);
      if (callerNumber !== input.callerNumber) {
        await realtimeContextService.invalidateCaller(input.clientId, input.callerNumber);
      }
    } catch (error) {
      logger.warn(`[CallerMemory] write failed for ${input.clientId}: ${(error as Error).message}`);
    }
  }

  /**
   * Prepend the newest call to the rolling summary and trim from the end, so
   * the most recent context survives and the oldest is what gets dropped.
   */
  private rollSummary(previous: string | null, latest: string | null): string | null {
    if (!latest?.trim()) return previous;
    const merged = previous?.trim() ? `${latest.trim()} | ${previous.trim()}` : latest.trim();
    return merged.length <= MAX_SUMMARY_CHARS ? merged : `${merged.slice(0, MAX_SUMMARY_CHARS - 1)}…`;
  }

  private mergePreferences(existing: string[], incoming: string[]): string[] {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const pref of [...incoming, ...existing]) {
      const key = pref.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(pref.trim());
      if (merged.length >= MAX_PREFERENCES) break;
    }
    return merged;
  }

  /** Marks a caller as not to be engaged — abuse, or an explicit opt-out. */
  async block(clientId: string, callerNumber: string): Promise<void> {
    await prisma.callerMemory.upsert({
      where: { clientId_callerNumber: { clientId, callerNumber } },
      create: { clientId, callerNumber, isBlocked: true },
      update: { isBlocked: true },
    });
    await realtimeContextService.invalidateCaller(clientId, callerNumber);
  }
}

export const callerMemoryService = new CallerMemoryService();
