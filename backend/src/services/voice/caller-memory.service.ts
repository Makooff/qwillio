import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { realtimeContextService } from './realtime-context.service';
import {
  canonicalCallerNumber, callerMemoryView, memoryEnvelope, memoryText,
  mergeIdentityFact, validMemoryEmail, validMemoryName,
  type CallerMemoryInput, type MemoryRequest,
} from './caller-memory-policy';

export interface CallerMemoryRecord {
  knownName: string | null; email: string | null; profileSummary: string | null;
  preferences: string[]; totalCalls: number; lastCallAt: Date | null;
  lastSummary: string | null; lastOutcome: string | null; isBlocked: boolean;
  /* La source du nom servi ('analysis' | 'capture' | 'confirmed'), portée par
     le spread de `callerMemoryView` : le GET /caller la transmet au worker. */
  identitySource?: string | null;
  identityResetAt?: string | null;
  facts?: unknown;
  openRequests?: Array<{ text: string; callbackWhen: string | null; forPerson: string | null }>;
  callbackNumber?: string | null;
}
const SELECT = {
  knownName: true, email: true, profileSummary: true, preferences: true,
  totalCalls: true, lastCallAt: true, lastSummary: true, lastOutcome: true,
  isBlocked: true, facts: true,
} as const;

/** One canonical key for writes; read old +E164 keys without deleting history. */
async function readRows(db: Pick<Prisma.TransactionClient, 'callerMemory'>, clientId: string, callerNumber: string) {
  const current = await db.callerMemory.findUnique({ where: { clientId_callerNumber: { clientId, callerNumber } }, select: SELECT });
  const legacy = await db.callerMemory.findUnique({ where: { clientId_callerNumber: { clientId, callerNumber: `+${callerNumber}` } }, select: SELECT });
  if (current?.isBlocked || legacy?.isBlocked) return { ...(current ?? legacy)!, isBlocked: true };
  if (!current) return legacy;
  if (!legacy) return current;
  const newer = (legacy.lastCallAt?.getTime() ?? 0) > (current.lastCallAt?.getTime() ?? 0) ? legacy : current;
  const older = newer === legacy ? current : legacy;
  const facts = memoryEnvelope(newer.facts);
  const other = memoryEnvelope(older.facts);
  facts.meta.identityResetAt = [facts.meta.identityResetAt, other.meta.identityResetAt].filter((v): v is string => !!v).sort().pop() ?? null;
  const strongest = (a: typeof facts.identity.name, b: typeof facts.identity.name) => {
    if (facts.meta.identityResetAt) {
      if (a && a.at <= facts.meta.identityResetAt) a = null;
      if (b && b.at <= facts.meta.identityResetAt) b = null;
    }
    if (!a) return b;
    if (!b) return a;
    const rank = { analysis: 0, capture: 1, confirmed: 2 };
    return rank[a.source] === rank[b.source] ? (a.at >= b.at ? a : b) : rank[a.source] > rank[b.source] ? a : b;
  };
  facts.identity.name = strongest(facts.identity.name, other.identity.name);
  facts.identity.email = strongest(facts.identity.email, other.identity.email);
  facts.contact.callbackNumber = strongest(facts.contact.callbackNumber, other.contact.callbackNumber);
  facts.meta.completedCalls = [...new Set([...other.meta.completedCalls, ...facts.meta.completedCalls])].slice(-128);
  return { ...newer, facts, totalCalls: Math.max(current.totalCalls ?? 0, legacy.totalCalls ?? 0) };
}

class CallerMemoryService {
  async get(clientId: string, raw: string | null): Promise<CallerMemoryRecord | null> {
    const callerNumber = canonicalCallerNumber(raw);
    if (!callerNumber) return null;
    try {
      const row = await readRows(prisma, clientId, callerNumber);
      if (!row) return null;
      const view = callerMemoryView(row);
      return { ...row, ...view, facts: null, lastSummary: view.isBlocked || (view.identityResetAt && !view.profileSummary) ? null : memoryText(row.lastSummary, 400), lastOutcome: view.isBlocked ? null : row.lastOutcome };
    } catch {
      logger.warn('[CallerMemory] lookup unavailable');
      return null;
    }
  }

  /** Serialised across processes; the SIP number, never a dictated callback, is the key. */
  async remember(input: CallerMemoryInput): Promise<void> {
    const callerNumber = canonicalCallerNumber(input.callerNumber);
    if (!callerNumber) return;
    const now = new Date();
    let at = now;
    if (input.occurredAt !== undefined) {
      // Prisma/structuredClone may return a Date from another realm. Validate
      // its internal Date value rather than instanceof the local constructor.
      let timestamp: number;
      try { timestamp = Date.prototype.getTime.call(input.occurredAt); }
      catch { return; }
      if (!Number.isFinite(timestamp) || timestamp > now.getTime()) return;
      at = new Date(timestamp);
    }
    try {
      await prisma.$transaction(async tx => {
        const lock = `caller-memory:${input.clientId}:${callerNumber}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text AS locked`;
        const existing = await readRows(tx, input.clientId, callerNumber);
        if (existing?.isBlocked) return;
        const facts = memoryEnvelope(existing?.facts);
        // Delivery time must never promote a delayed event past a reset.
        if (facts.meta.identityResetAt && (!input.occurredAt || at.getTime() <= Date.parse(facts.meta.identityResetAt))) return;
        const callId = memoryText(input.callId, 255);
        const duplicate = !!callId && facts.meta.completedCalls.includes(callId);
        const completed = input.phase !== 'capture';
        const increment = completed && !duplicate ? 1 : 0;
        facts.identity.name = mergeIdentityFact(facts.identity.name, validMemoryName(input.name), input, at);
        facts.identity.email = mergeIdentityFact(facts.identity.email, validMemoryEmail(input.email), input, at);
        facts.contact.callbackNumber = mergeIdentityFact(
          facts.contact.callbackNumber, canonicalCallerNumber(input.callbackNumber), input, at);
        facts.engagements.openRequests = this.mergeOpenRequests(facts.engagements.openRequests, input, at);
        facts.meta.lastCallId = callId ?? facts.meta.lastCallId;
        if (completed && callId && !duplicate) facts.meta.completedCalls = [...facts.meta.completedCalls, callId].slice(-128);
        const fresh = at.getTime() >= (existing?.lastCallAt?.getTime() ?? 0);
        const preferences = fresh ? this.mergePreferences(
          this.removePreferences(existing?.preferences ?? [], input.removePreferences ?? []), input.preferences ?? []) : existing?.preferences ?? [];
        if (fresh && (input.preferences?.length || input.removePreferences?.length)) facts.meta.preferencesAt = at.toISOString();
        const summary = memoryText(input.summary, 400);
        const previous = memoryText(existing?.profileSummary, 400);
        const summaryFresh = at.getTime() >= (Date.parse(facts.meta.summaryAt ?? '') || existing?.lastCallAt?.getTime() || 0);
        const acceptSummary = !!summary && summaryFresh;
        const profileSummary = acceptSummary && summary !== existing?.lastSummary
          ? (callId && facts.meta.summaryCallId === callId ? summary : [summary, previous].filter(Boolean).join(' | ').slice(0, 400)) : previous;
        if (acceptSummary) { facts.meta.summaryAt = at.toISOString(); facts.meta.summaryCallId = callId; }
        const common = {
          knownName: facts.identity.name?.value ?? existing?.knownName ?? null,
          email: facts.identity.email?.value ?? existing?.email ?? null,
          profileSummary, preferences, facts: facts as unknown as Prisma.InputJsonObject,
          lastCallAt: fresh ? at : existing?.lastCallAt ?? at,
          lastSummary: acceptSummary ? summary : existing?.lastSummary ?? null,
          lastOutcome: fresh ? memoryText(input.outcome, 100) ?? existing?.lastOutcome ?? null : existing?.lastOutcome ?? null,
        };
        // Consolidate the historical maximum on the canonical row under the same lock.
        const canonical = await tx.callerMemory.findUnique({
          where: { clientId_callerNumber: { clientId: input.clientId, callerNumber } },
          select: { totalCalls: true },
        });
        const historicalTotal = existing?.totalCalls ?? 0;
        const consolidation = Math.max(0, historicalTotal - (canonical?.totalCalls ?? 0));
        await tx.callerMemory.upsert({
          where: { clientId_callerNumber: { clientId: input.clientId, callerNumber } },
          create: { clientId: input.clientId, callerNumber, ...common, totalCalls: historicalTotal + increment },
          update: { ...common, totalCalls: { increment: consolidation + increment } },
        });
      }, { timeout: 5000, maxWait: 2000 });
      await this.invalidate(input.clientId, callerNumber, input.callerNumber);
    } catch {
      // Driver messages may contain PII and queries. Never log raw errors here.
      logger.warn('[CallerMemory] persistence unavailable');
    }
  }

  /** Retire les préférences listées, insensiblement à la casse: c'est le mécanisme de correction. */
  private removePreferences(existing: string[], removed: string[]): string[] {
    const drop = new Set(removed.flatMap(r => memoryText(r, 120) ? [memoryText(r, 120)!.toLowerCase()] : []));
    return existing.filter(value => !drop.has(value.toLowerCase()));
  }

  /** Nouvelle demande devant, dédupliquée par texte (mise à jour du créneau), bornée à 5. */
  private mergeOpenRequests(existing: MemoryRequest[], input: CallerMemoryInput, at: Date): MemoryRequest[] {
    const request = input.request;
    const text = memoryText(request?.text, 200);
    if (!request || !text) return existing.slice(0, 5);
    const next: MemoryRequest = {
      text, at: at.toISOString(), callId: memoryText(input.callId, 255),
      callbackWhen: memoryText(request.callbackWhen, 120),
      forPerson: memoryText(request.forPerson, 120),
    };
    const previous = existing.find(r => r.text.toLowerCase() === text.toLowerCase());
    if (previous && Date.parse(previous.at) > at.getTime()) return existing;
    return [next, ...existing.filter(r => r.text.toLowerCase() !== text.toLowerCase())]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 5);
  }

  private mergePreferences(existing: string[], incoming: string[]): string[] {
    const seen = new Set<string>();
    return [...(Array.isArray(incoming) ? incoming : []), ...(Array.isArray(existing) ? existing : [])]
      .slice(0, 100).flatMap(raw => {
        const value = memoryText(raw, 120);
        if (!value || seen.has(value.toLowerCase())) return [];
        seen.add(value.toLowerCase());
        return [value];
      }).slice(0, 6);
  }

  private async invalidate(clientId: string, number: string, raw: string | null) {
    for (const form of new Set([number, `+${number}`, raw].filter((v): v is string => !!v))) {
      await realtimeContextService.invalidateCaller(clientId, form);
    }
  }

  /** Opposition uses the same lock/key as remember so a racing write cannot revive data. */
  async block(clientId: string, raw: string): Promise<void> {
    const callerNumber = canonicalCallerNumber(raw);
    if (!callerNumber) return;
    await prisma.$transaction(async tx => {
      const lock = `caller-memory:${clientId}:${callerNumber}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text AS locked`;
      const data = { isBlocked: true, knownName: null, email: null, profileSummary: null,
        preferences: [], facts: Prisma.DbNull, lastSummary: null, lastOutcome: null,
        totalCalls: 0, lastCallAt: null };
      for (const form of [callerNumber, `+${callerNumber}`]) {
        await tx.callerMemory.upsert({ where: { clientId_callerNumber: { clientId, callerNumber: form } },
          create: { clientId, callerNumber: form, ...data }, update: data });
      }
    }, { timeout: 5000, maxWait: 2000 });
    await this.invalidate(clientId, callerNumber, raw);
  }
}
export const callerMemoryService = new CallerMemoryService();
