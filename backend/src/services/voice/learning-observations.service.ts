import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { exportEvidence } from './learning-evidence';

export const OBSERVATIONS_COVERAGE_MODE = 'creation_only' as const;
// Closed, exact identifiers only. Sources: config/niches.ts (NicheId and
// KNOWLEDGE_PRESETS), config/receptionist-industry-rules.json, BUSINESS_TYPES
// in utils/constants.ts and NICHE_POINTS in services/prospect-scoring.service.ts.
// Keep the collector's CANONICAL_NICHES in sync. No substring/prose resolver:
// even a name containing a profession must remain unknown. Generic fallback
// markers `default`/`other` are not verified scope.
const CANONICAL_NICHES = new Set((
  'restaurant dental medical salon law real_estate auto home_services veterinary fitness financial hotel ecommerce service ' +
  'plumber hvac electrician roofing locksmith dentist orthodontist auto_garage garage car_repair vet urgent_care chiropractor physical_therapy ' +
  'hair_salon beauty barbershop law_firm lawyer attorney accounting insurance gym yoga childcare daycare pet catering creative photographer florist retail cleaning travel boutique_hotel funeral'
).split(' '));
export function canonicalNiche(value: unknown): string | null {
  return typeof value === 'string' && CANONICAL_NICHES.has(value) ? value : null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY_CODES = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));
const COUNTRY_NAMES: Record<string, string> = {
  belgium: 'BE', belgique: 'BE', belgië: 'BE', france: 'FR', nederland: 'NL',
  netherlands: 'NL', 'pays-bas': 'NL', germany: 'DE', deutschland: 'DE', allemagne: 'DE',
  'united states': 'US', 'united kingdom': 'GB', luxembourg: 'LU', switzerland: 'CH', suisse: 'CH',
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export class ObservationRequestError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}
export function canonicalCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (COUNTRY_CODES.has(clean.toUpperCase())) return clean.toUpperCase();
  const name = clean.toLowerCase();
  return Object.hasOwn(COUNTRY_NAMES, name) ? COUNTRY_NAMES[name] : null;
}
export function readMetrics(metadata: unknown): Record<string, number> {
  const m = object(metadata), core = object(m.latency), rt = object(m.realtime);
  const metrics: Record<string, number> = {};
  // Numeric counters and millisecond measurements only. Never coerce strings or booleans.
  for (const key of ['total_p50', 'total_p95', 'tours', 'eou_p50', 'eou_au_plafond', 'eou_tours', 'arrets_pour_rien', 'llm_ttft_p50', 'tts_ttfb_p50']) {
    if (finite(core[key])) metrics[key] = core[key];
  }
  const total = object(object(rt.latency).total);
  if (metrics.total_p50 === undefined && finite(total.median)) metrics.total_p50 = total.median;
  if (metrics.total_p95 === undefined && finite(total.p95)) metrics.total_p95 = total.p95;
  if (finite(rt.callerTurns)) metrics.caller_turns = rt.callerTurns;
  return metrics;
}
const MORTEM_CODES = new Set(['tool_failed', 'model_failed', 'dead_line', 'booking_without_name', 'engaged_then_lost', 'agent_talks_over', 'slow_turns', 'knowledge_lookup', 'caller_unhappy']);
export function readMortem(metadata: unknown) {
  const m = object(object(metadata).mortem);
  if (!['ok', 'watch', 'broken'].includes(String(m.verdict)) || !Array.isArray(m.codes)) return null;
  return { verdict: m.verdict as 'ok' | 'watch' | 'broken', codes: [...new Set(m.codes.filter((v): v is string => typeof v === 'string' && MORTEM_CODES.has(v)))] };
}
export function detectSource(metadata: unknown): 'voice-core' | 'vapi' | 'unknown' {
  const m = object(metadata);
  return m.source === 'voice-core' ? 'voice-core' : m.realtime !== null && typeof m.realtime === 'object' && !Array.isArray(m.realtime) ? 'vapi' : 'unknown';
}

export interface ObservationCursor { v: number; clientId: string; wm: number; c: number | null; id: string | null }
export function encodeObservationCursor(payload: ObservationCursor, secret: string): string {
  if (!secret) throw new ObservationRequestError('read_key_unavailable', 503);
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${createHmac('sha256', secret).update(data).digest('hex')}`;
}
export function decodeObservationCursor(cursor: string, clientId: string, secret: string): ObservationCursor {
  if (!secret) throw new ObservationRequestError('read_key_unavailable', 503);
  if (typeof cursor !== 'string' || cursor.length > 2048 || !/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/.test(cursor)) throw new ObservationRequestError('cursor_invalid');
  const [data, mac] = cursor.split('.');
  const expected = createHmac('sha256', secret).update(data).digest();
  if (!timingSafeEqual(expected, Buffer.from(mac, 'hex'))) throw new ObservationRequestError('cursor_invalid');
  let p: Record<string, unknown>;
  try {
    const bytes = Buffer.from(data, 'base64url');
    if (bytes.toString('base64url') !== data) throw new Error('noncanonical');
    p = object(JSON.parse(bytes.toString('utf8')));
  } catch { throw new ObservationRequestError('cursor_invalid'); }
  if (p.v !== 1) throw new ObservationRequestError('cursor_version_unsupported');
  if (Object.keys(p).sort().join(',') !== 'c,clientId,id,v,wm' || typeof p.clientId !== 'string' ||
    !Number.isSafeInteger(p.wm) || !finite(p.wm) || p.wm > 8640000000000000 ||
    !(p.c === null && p.id === null || Number.isSafeInteger(p.c) && finite(p.c) && p.c <= p.wm && typeof p.id === 'string' && UUID.test(p.id))) {
    throw new ObservationRequestError('cursor_invalid');
  }
  if (p.clientId !== clientId) throw new ObservationRequestError('cursor_client_mismatch');
  if (p.wm > Date.now()) throw new ObservationRequestError('cursor_watermark_future');
  return p as unknown as ObservationCursor;
}

const clientSelect = { id: true, businessType: true, country: true, agentLanguage: true } satisfies Prisma.ClientSelect;
const callSelect = {
  id: true, clientId: true, status: true, endedAt: true, createdAt: true,
  transcript: true, isSpam: true, metadata: true,
  client: { select: { businessType: true, country: true, agentLanguage: true } },
} satisfies Prisma.ClientCallSelect;
type ObservationRow = Prisma.ClientCallGetPayload<{ select: typeof callSelect }>;
export type PatternsByCall = Map<string, number>;
export function mapObservation(row: ObservationRow, patterns: PatternsByCall) {
  const count = patterns.get(row.id) ?? 0;
  return {
    callRef: row.id, clientRef: row.clientId, niche: canonicalNiche(row.client.businessType),
    country: canonicalCountry(row.client.country), language: row.client.agentLanguage,
    status: row.status, endedAt: row.endedAt?.toISOString() ?? null,
    // No persisted analysis timestamp or at-call release identity exists in the current writers.
    observedAt: null, source: detectSource(row.metadata), mortem: readMortem(row.metadata),
    patterns: { read: count > 0, count, niche: canonicalNiche(row.client.businessType) },
    metrics: readMetrics(row.metadata), release_refs: { backend: null, worker: null }, revision: 1,
    hasTranscript: typeof row.transcript === 'string' && row.transcript.trim().length > 0,
    behaviour: row.status === 'completed' && row.endedAt && row.isSpam === false
      ? exportEvidence(object(row.metadata).learningEvidence, {
          tenant_id: row.clientId, niche: canonicalNiche(row.client.businessType),
          country: canonicalCountry(row.client.country), language: row.client.agentLanguage,
        }) : null,
    isSpam: row.isSpam,
  };
}

// Explicit read-only port: the injected Prisma client cannot write through this interface.
export interface LearningObservationsDb {
  clientCall: {
    findMany(args: Prisma.ClientCallFindManyArgs & { select: typeof callSelect }): Promise<ObservationRow[]>;
    findFirst(args: Prisma.ClientCallFindFirstArgs & { select: typeof callSelect }): Promise<ObservationRow | null>;
  };
  client: {
    findFirst(args: Prisma.ClientFindFirstArgs): Promise<{ id: string } | null>;
    findMany(args: Prisma.ClientFindManyArgs & { select: typeof clientSelect }): Promise<Prisma.ClientGetPayload<{ select: typeof clientSelect }>[]>;
  };
  learningPattern: { findMany(args: Prisma.LearningPatternFindManyArgs): Promise<{ evidence: Prisma.JsonValue }[]> };
}
function validateId(value: unknown, kind: 'client_id' | 'call_ref'): string {
  if (kind === 'client_id' && (value === undefined || value === '')) throw new ObservationRequestError('client_id_required');
  if (typeof value !== 'string' || !UUID.test(value)) throw new ObservationRequestError(`${kind}_invalid`);
  return value;
}
function readLimit(value: unknown): number {
  if (value === undefined) return 50;
  // HTTP query values are strings; accept only the exact decimal representation.
  const n = typeof value === 'string' && /^[1-9][0-9]{0,2}$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 100) throw new ObservationRequestError('invalid_limit');
  return n;
}
function cursorSecret(): string {
  const readKey = process.env.LEARNING_READ_TOKEN === undefined ? process.env.AUTOFIX_TOKEN : process.env.LEARNING_READ_TOKEN;
  if (!readKey?.trim()) throw new ObservationRequestError('read_key_unavailable', 503);
  const secret = process.env.LEARNING_READ_CURSOR_SECRET ?? readKey;
  if (!secret.trim()) throw new ObservationRequestError('read_key_unavailable', 503);
  return secret.trim();
}
function snapshot(cursor: unknown, clientId: string, secret: string): ObservationCursor {
  if (cursor === undefined) return { v: 1, clientId, wm: Date.now() - 1, c: null, id: null };
  if (typeof cursor !== 'string') throw new ObservationRequestError('cursor_invalid');
  return decodeObservationCursor(cursor, clientId, secret);
}
const MAX_PATTERNS = 1000;
export function createLearningObservationsService(db: LearningObservationsDb) {
  async function patternsFor(rows: ObservationRow[], clientId: string) {
    const counts: PatternsByCall = new Map();
    if (rows.length === 0) return { counts, truncated: false };
    const ids = new Set(rows.map(row => row.id));
    const patterns = await db.learningPattern.findMany({
      where: {
        clientIds: { has: clientId },
        OR: [...ids].map(callId => ({ evidence: { array_contains: [{ callId }] } })),
      },
      select: { evidence: true }, orderBy: { id: 'asc' }, take: MAX_PATTERNS + 1,
    });
    for (const pattern of patterns.slice(0, MAX_PATTERNS)) {
      if (!Array.isArray(pattern.evidence)) continue;
      const seen = new Set<string>();
      for (const evidence of pattern.evidence) {
        const e = object(evidence);
        if (typeof e.callId === 'string' && ids.has(e.callId) &&
          (e.clientId === undefined || e.clientId === clientId)) seen.add(e.callId);
      }
      for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return { counts, truncated: patterns.length > MAX_PATTERNS };
  }
  return {
    async listObservations(input: { clientId: unknown; cursor?: unknown; limit?: unknown }) {
      const clientId = validateId(input.clientId, 'client_id');
      const limit = readLimit(input.limit), secret = cursorSecret();
      const state = snapshot(input.cursor, clientId, secret);
      const client = await db.client.findFirst({ where: { id: clientId }, select: { id: true } });
      if (!client) throw new ObservationRequestError('client_not_found', 404);
      const rows = await db.clientCall.findMany({
        where: {
          clientId, createdAt: { lte: new Date(state.wm) },
          ...(state.c === null ? {} : { OR: [
            { createdAt: { gt: new Date(state.c) } },
            { createdAt: new Date(state.c), id: { gt: state.id! } },
          ] }),
        },
        select: callSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: limit + 1,
      });
      const page = rows.slice(0, limit), hasMore = rows.length > limit;
      const last = page[page.length - 1];
      const patterns = await patternsFor(page, clientId);
      return {
        items: page.map(row => mapObservation(row, patterns.counts)), hasMore,
        nextCursor: hasMore ? encodeObservationCursor({ ...state, c: last.createdAt.getTime(), id: last.id }, secret) : null,
        watermark: new Date(state.wm).toISOString(), coverage: OBSERVATIONS_COVERAGE_MODE,
        patternsTruncated: patterns.truncated,
      };
    },
    async getObservation(callRef: string, client: unknown) {
      const clientId = validateId(client, 'client_id');
      validateId(callRef, 'call_ref');
      const row = await db.clientCall.findFirst({ where: { id: callRef, clientId }, select: callSelect });
      if (!row) throw new ObservationRequestError('observation_not_found', 404);
      const patterns = await patternsFor([row], clientId);
      return { ...mapObservation(row, patterns.counts), patternsTruncated: patterns.truncated };
    },
    async listClients(input: { cursor?: unknown; limit?: unknown }) {
      const limit = readLimit(input.limit);
      // Domain separation prevents directory cursors being used as observation cursors.
      const secret = createHmac('sha256', cursorSecret()).update('learning-clients-v1').digest('hex');
      const state = snapshot(input.cursor, 'clients', secret);
      const rows = await db.client.findMany({
        where: { createdAt: { lte: new Date(state.wm) }, ...(state.id === null ? {} : { id: { gt: state.id } }) },
        select: clientSelect, orderBy: { id: 'asc' }, take: limit + 1,
      });
      const page = rows.slice(0, limit), hasMore = rows.length > limit;
      return {
        items: page.map(row => ({ id: row.id, niche: canonicalNiche(row.businessType), country: canonicalCountry(row.country), language: row.agentLanguage })),
        hasMore, nextCursor: hasMore ? encodeObservationCursor({ ...state, c: 0, id: page[page.length - 1].id }, secret) : null,
        watermark: new Date(state.wm).toISOString(), coverage: OBSERVATIONS_COVERAGE_MODE,
      };
    },
  };
}
