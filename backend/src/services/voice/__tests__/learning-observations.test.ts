import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLearningObservationsService,
  canonicalCountry,
  readMetrics,
  readMortem,
  detectSource,
  mapObservation,
  encodeObservationCursor,
  decodeObservationCursor,
  ObservationRequestError,
  OBSERVATIONS_COVERAGE_MODE,
  type LearningObservationsDb,
  type PatternsByCall,
} from '../learning-observations.service';

const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';
const CALL_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CALL_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const SECRET = 'cursor-test-secret';

function makeCall(overrides: Record<string, unknown> = {}) {
  return {
    id: CALL_1,
    clientId: CLIENT_A,
    status: 'completed',
    endedAt: new Date('2026-10-01T10:05:00.000Z'),
    transcript: null,
    metadata: null,
    isSpam: false,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    client: { businessType: 'restaurant', country: 'BE', agentLanguage: 'fr' },
    ...overrides,
  } as never;
}

function makeDb(overrides: Record<string, unknown> = {}): LearningObservationsDb {
  return {
    clientCall: { findMany: vi.fn(), findFirst: vi.fn() },
    client: { findFirst: vi.fn(), findMany: vi.fn() },
    learningPattern: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as LearningObservationsDb;
}

beforeEach(() => {
  process.env.LEARNING_READ_TOKEN = SECRET;
});
afterEach(() => {
  delete process.env.LEARNING_READ_TOKEN;
  delete process.env.AUTOFIX_TOKEN;
  delete process.env.LEARNING_READ_CURSOR_SECRET;
  delete process.env.RENDER_GIT_COMMIT;
  vi.restoreAllMocks();
});

describe('closed niche privacy boundary', () => {
  it.each(['SYNTHETIC_PII_SENTINEL', 'Alice Martin', 'Alice Dental Martin', 'custom', 'constructor', '__proto__', '', null])(
    'does not export arbitrary businessType %s through any observation surface', async businessType => {
      const row = makeCall({ client: { businessType, country: 'BE', agentLanguage: 'fr' } });
      const db = makeDb({
        client: {
          findFirst: vi.fn().mockResolvedValue({ id: CLIENT_A }),
          findMany: vi.fn().mockResolvedValue([{ id: CLIENT_A, businessType, country: 'BE', agentLanguage: 'fr' }]),
        },
        clientCall: { findMany: vi.fn().mockResolvedValue([row]), findFirst: vi.fn().mockResolvedValue(row) },
      });
      const service = createLearningObservationsService(db);
      const mapped = mapObservation(row, new Map([[CALL_1, 1]]));
      const directory = await service.listClients({});
      const list = await service.listObservations({ clientId: CLIENT_A });
      const single = await service.getObservation(CALL_1, CLIENT_A);
      expect(directory.items[0].niche).toBeNull();
      for (const item of [mapped, list.items[0], single]) {
        expect(item.niche).toBeNull();
        expect(item.patterns.niche).toBeNull();
      }
      if (businessType) expect(JSON.stringify([directory, list, single, mapped])).not.toContain(businessType);
    },
  );
  it('preserves exact repository identifiers, not substring profession guesses', () => {
    for (const niche of ['roofing', 'home_services', 'dental', 'restaurant', 'real_estate', 'ecommerce', 'plumber', 'garage']) {
      const item = mapObservation(makeCall({ client: { businessType: niche, country: 'BE', agentLanguage: 'fr' } }), new Map());
      expect(item.niche).toBe(niche);
      expect(item.patterns.niche).toBe(niche);
    }
  });
});

describe('canonicalCountry', () => {
  it('passes through two-letter codes uppercased, without inventing values', () => {
    expect(canonicalCountry('BE')).toBe('BE');
    expect(canonicalCountry(' be ')).toBe('BE');
    expect(canonicalCountry('fr')).toBe('FR');
  });
  it('maps explicit known full country names, case-insensitive', () => {
    expect(canonicalCountry('France')).toBe('FR');
    expect(canonicalCountry('BELGIUM')).toBe('BE');
    expect(canonicalCountry('Nederland')).toBe('NL');
  });
  it('returns null for unknown or empty values — never infers', () => {
    expect(canonicalCountry('Atlantis')).toBeNull();
    expect(canonicalCountry('')).toBeNull();
    expect(canonicalCountry(null)).toBeNull();
    expect(canonicalCountry(undefined)).toBeNull();
    expect(canonicalCountry('ZZ')).toBeNull();
    expect(canonicalCountry('constructor')).toBeNull();
    expect(canonicalCountry('__proto__')).toBeNull();
  });
});

describe('readMetrics', () => {
  it('reads the voice-core latency allowlist and keeps agent tours distinct from caller turns', () => {
    const metrics = readMetrics({
      latency: { total_p95: 800, total_p50: 400, tours: 6, eou_tours: 5, arrets_pour_rien: 2, eou_au_plafond: 3, junk: 1 },
    });
    expect(metrics.total_p95).toBe(800);
    expect(metrics.total_p50).toBe(400);
    expect(metrics.tours).toBe(6);
    expect(metrics.eou_tours).toBe(5);
    expect(metrics.arrets_pour_rien).toBe(2);
    expect(metrics.eou_au_plafond).toBe(3);
    expect(metrics).not.toHaveProperty('junk');
    expect(metrics).not.toHaveProperty('caller_turns');
  });
  it('fills missing totals from the vapi realtime latency shape without overwriting voice-core values', () => {
    const metrics = readMetrics({
      latency: { total_p95: 900 },
      realtime: { callerTurns: 5, latency: { total: { p95: 700, median: 650 } } },
    });
    expect(metrics.total_p95).toBe(900);
    expect(metrics.total_p50).toBe(650);
    expect(metrics.caller_turns).toBe(5);
  });
  it('omits non-numeric, negative, non-finite values — missing is never coerced to 0', () => {
    const metrics = readMetrics({
      latency: { total_p95: '800', total_p50: -1, tours: Number.NaN, arrets_pour_rien: Infinity, eou_p50: null },
    });
    expect(metrics).toEqual({});
  });
  it('retains measured zero and rejects booleans and malformed realtime metrics', () => {
    expect(readMetrics({ latency: { tours: 0, eou_au_plafond: false, total_p95: true }, realtime: { callerTurns: '3', latency: { total: { median: 0, p95: -1 } } } })).toEqual({ tours: 0, total_p50: 0 });
    expect(readMetrics({ realtime: { callerTurns: Infinity, latency: { total: { p95: NaN } } } })).toEqual({});
  });
  it('returns an empty object when metadata is absent', () => {
    expect(readMetrics(null)).toEqual({});
    expect(readMetrics(undefined)).toEqual({});
    expect(readMetrics('nope')).toEqual({});
  });
});

describe('readMortem', () => {
  it('returns verdict and validated codes from metadata.mortem', () => {
    const mortem = readMortem({ mortem: { verdict: 'watch', codes: ['slow_turns', 'bogus_code'] } });
    expect(mortem).toEqual({ verdict: 'watch', codes: ['slow_turns'] });
  });
  it('accepts the three known verdicts and rejects malformed shapes', () => {
    expect(readMortem({ mortem: { verdict: 'ok', codes: [] } })).toEqual({ verdict: 'ok', codes: [] });
    expect(readMortem({ mortem: { verdict: 'broken', codes: ['tool_failed'] } })).toEqual({ verdict: 'broken', codes: ['tool_failed'] });
    expect(readMortem({ mortem: { verdict: 'catastrophic', codes: [] } })).toBeNull();
    expect(readMortem({ mortem: 'yes' })).toBeNull();
    expect(readMortem({})).toBeNull();
    expect(readMortem(null)).toBeNull();
  });
});

describe('detectSource', () => {
  it('distinguishes voice-core, vapi and unknown metadata', () => {
    expect(detectSource({ source: 'voice-core', latency: {} })).toBe('voice-core');
    expect(detectSource({ realtime: { callerTurns: 1 } })).toBe('vapi');
    expect(detectSource({})).toBe('unknown');
    expect(detectSource(null)).toBe('unknown');
  });
});

describe('observation cursors', () => {
  it('round-trips a payload', () => {
    const cursor = encodeObservationCursor({ v: 1, clientId: CLIENT_A, wm: 1727750000000, c: 1727700000000, id: CALL_1 }, SECRET);
    expect(decodeObservationCursor(cursor, CLIENT_A, SECRET)).toEqual({ v: 1, clientId: CLIENT_A, wm: 1727750000000, c: 1727700000000, id: CALL_1 });
  });
  it('rejects tampered payloads', () => {
    const cursor = encodeObservationCursor({ v: 1, clientId: CLIENT_A, wm: 1727750000000, c: null, id: null }, SECRET);
    const [data, mac] = cursor.split('.');
    const tampered = `${data.slice(0, -2)}xx.${mac}`;
    expect(() => decodeObservationCursor(tampered, CLIENT_A, SECRET)).toThrowError(ObservationRequestError);
  });
  it('rejects a cross-client cursor', () => {
    const cursor = encodeObservationCursor({ v: 1, clientId: CLIENT_A, wm: 1727750000000, c: null, id: null }, SECRET);
    expect(() => decodeObservationCursor(cursor, CLIENT_B, SECRET)).toThrowError(
      expect.objectContaining({ code: 'cursor_client_mismatch' }) as Error,
    );
  });
  it('rejects a future watermark and an unknown version', () => {
    const future = encodeObservationCursor({ v: 1, clientId: CLIENT_A, wm: Date.now() + 60_000, c: null, id: null }, SECRET);
    expect(() => decodeObservationCursor(future, CLIENT_A, SECRET)).toThrowError(
      expect.objectContaining({ code: 'cursor_watermark_future' }) as Error,
    );
    const wrongVersion = encodeObservationCursor({ v: 99, clientId: CLIENT_A, wm: 1727750000000, c: null, id: null }, SECRET);
    expect(() => decodeObservationCursor(wrongVersion, CLIENT_A, SECRET)).toThrowError(
      expect.objectContaining({ code: 'cursor_version_unsupported' }) as Error,
    );
  });
  it('rejects signed invalid tuples and extra fields instead of silently repairing them', () => {
    const base = { v: 1, clientId: CLIENT_A, wm: 1727750000000, c: null, id: null };
    for (const invalid of [
      { ...base, c: 1727750000001, id: CALL_1 },
      { ...base, c: -1, id: CALL_1 },
      { ...base, c: 1.5, id: CALL_1 },
      { ...base, c: 1, id: null },
      { ...base, c: null, id: CALL_1 },
      { ...base, wm: '1727750000000' },
      { ...base, wm: 8640000000000001 },
      { ...base, extra: 'ignored?' },
    ]) {
      expect(() => decodeObservationCursor(encodeObservationCursor(invalid as never, SECRET), CLIENT_A, SECRET)).toThrowError(ObservationRequestError);
    }
    expect(() => decodeObservationCursor('a'.repeat(2049), CLIENT_A, SECRET)).toThrowError(ObservationRequestError);
  });
  it('rejects malformed base64 and bad JSON', () => {
    expect(() => decodeObservationCursor('!!!.abc', CLIENT_A, SECRET)).toThrowError(ObservationRequestError);
    const bogus = `${Buffer.from('{"v":1}', 'utf8').toString('base64url')}.${'0'.repeat(64)}`;
    expect(() => decodeObservationCursor(bogus, CLIENT_A, SECRET)).toThrowError(ObservationRequestError);
  });
});

describe('mapObservation', () => {
  const noPatterns: PatternsByCall = new Map();

  it('maps niche/country/language from the client row, never from the call', () => {
    const item = mapObservation(makeCall({ metadata: {} }), noPatterns);
    expect(item.niche).toBe('restaurant');
    expect(item.country).toBe('BE');
    expect(item.language).toBe('fr');
    expect(item.clientRef).toBe(CLIENT_A);
    expect(item.callRef).toBe(CALL_1);
    expect(item.status).toBe('completed');
    expect(item.endedAt).toBe('2026-10-01T10:05:00.000Z');
    expect(item.observedAt).toBeNull();
    expect(item.revision).toBe(1);
    expect(item.source).toBe('unknown');
    expect(item.mortem).toBeNull();
    expect(item.patterns).toEqual({ read: false, count: 0, niche: 'restaurant' });
  });

  it('never exposes transcript, summary, caller identity, raw room or vapiCallId even when planted', () => {
    const item = mapObservation(
      makeCall({
        transcript: 'User: bonjour\nAI: bonjour',
        metadata: {
          room: 'room-secret-123',
          vapiCallId: 'vapi-deadbeef',
          callerName: 'John Doe',
          callerNumber: '+32477000000',
          error: 'boom stack trace',
        },
      }),
      noPatterns,
    );
    expect(item.hasTranscript).toBe(true);
    expect(item.isSpam).toBe(false);
    const serialised = JSON.stringify(item);
    expect(serialised).not.toContain('John Doe');
    expect(serialised).not.toContain('+32477000000');
    expect(serialised).not.toContain('room-secret-123');
    expect(serialised).not.toContain('vapi-deadbeef');
    expect(serialised).not.toContain('boom stack trace');
    for (const forbidden of ['transcript', 'summary', 'callerName', 'callerNumber', 'vapiCallId', 'emailCollected', 'nameCollected', 'phoneCollected', 'recordingUrl', 'metadata']) {
      expect(item).not.toHaveProperty(forbidden);
    }
  });

  it('keeps release_refs null without structured at-call release identity, ignoring runtime commit env', () => {
    process.env.RENDER_GIT_COMMIT = 'deadbeefcafe';
    const item = mapObservation(makeCall({ metadata: { latency: { total_p95: 100 } } }), noPatterns);
    expect(item.release_refs).toEqual({ backend: null, worker: null });
    const structured = mapObservation(makeCall({ metadata: { release: { backend: 'abc123', worker: null } } }), noPatterns);
    expect(structured.release_refs).toEqual({ backend: null, worker: null });
  });

  it('reports spam and missing metrics honestly', () => {
    const item = mapObservation(makeCall({ isSpam: true, transcript: '   ' }), noPatterns);
    expect(item.isSpam).toBe(true);
    expect(item.hasTranscript).toBe(false);
    expect(item.metrics).toEqual({});
  });
});

describe('createLearningObservationsService', () => {
  it('rejects a missing or malformed clientId before touching calls', async () => {
    const db = makeDb();
    const service = createLearningObservationsService(db);
    await expect(service.listObservations({ clientId: '', limit: 10 })).rejects.toMatchObject({ code: 'client_id_required' });
    await expect(service.listObservations({ clientId: 'not-a-uuid', limit: 10 })).rejects.toMatchObject({ code: 'client_id_invalid' });
    expect(db.clientCall.findMany).not.toHaveBeenCalled();
  });

  it('rejects out-of-range limits', async () => {
    const db = makeDb({ client: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT_A }) } });
    const service = createLearningObservationsService(db);
    for (const limit of [0, 101, Number.NaN, 3.5]) {
      await expect(service.listObservations({ clientId: CLIENT_A, limit })).rejects.toMatchObject({ code: 'invalid_limit' });
    }
  });

  it('404s an unknown client', async () => {
    const db = makeDb({ client: { findFirst: vi.fn().mockResolvedValue(null) } });
    const service = createLearningObservationsService(db);
    await expect(service.listObservations({ clientId: CLIENT_B, limit: 10 })).rejects.toMatchObject({
      status: 404,
      code: 'client_not_found',
    });
  });

  it('paginates with take limit+1, a stable keyset cursor, and an honest creation_only coverage', async () => {
    const tied = new Date('2026-10-01T10:00:00.000Z');
    const rows = [
      makeCall({ id: CALL_1, createdAt: tied }),
      makeCall({ id: CALL_2, createdAt: tied }),
    ];
    const findMany = vi.fn().mockResolvedValueOnce([rows[0], rows[1]]).mockResolvedValueOnce([rows[1]]);
    const db = makeDb({
      client: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT_A }) },
      clientCall: { findMany, findFirst: vi.fn() },
    });
    const service = createLearningObservationsService(db);

    const page1 = await service.listObservations({ clientId: CLIENT_A, limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].callRef).toBe(CALL_1);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();
    expect(page1.coverage).toBe(OBSERVATIONS_COVERAGE_MODE);
    expect(page1.coverage).toBe('creation_only');
    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ take: 2 }));

    const page2 = await service.listObservations({ clientId: CLIENT_A, cursor: page1.nextCursor!, limit: 1 });
    expect(page2.items.map(i => i.callRef)).toEqual([CALL_2]);
    expect(page2.hasMore).toBe(false);
    expect(page2.nextCursor).toBeNull();
    expect(page2.watermark).toBe(page1.watermark);

    const secondWhere = findMany.mock.calls[1][0].where;
    expect(secondWhere.OR).toBeDefined();
    expect(page1.items[0].callRef).not.toBe(page2.items[0].callRef);
  });

  it('excludes rows created after the snapshot watermark during pagination', async () => {
    const early = new Date('2026-10-01T09:00:00.000Z');
    const stored: Array<{ id: string; createdAt: Date }> = [
      makeCall({ id: CALL_1, createdAt: early }), makeCall({ id: CALL_2, createdAt: early }),
    ];
    const findMany = vi.fn(async (args) => stored.filter(row =>
      row.createdAt <= args.where.createdAt.lte &&
      (!args.where.OR || row.createdAt > args.where.OR[0].createdAt.gt ||
        (row.createdAt.getTime() === args.where.OR[1].createdAt.getTime() && row.id > args.where.OR[1].id.gt)),
    ).slice(0, args.take));
    const db = makeDb({
      client: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT_A }) },
      clientCall: { findMany, findFirst: vi.fn() },
    });
    const service = createLearningObservationsService(db);
    const page1 = await service.listObservations({ clientId: CLIENT_A, limit: 1 });
    const watermarkMs = new Date(page1.watermark).getTime();
    stored.push(makeCall({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', createdAt: new Date(watermarkMs + 60_000) }));
    findMany.mockClear();
    const page2 = await service.listObservations({ clientId: CLIENT_A, cursor: page1.nextCursor!, limit: 1 });
    expect(page2.items.map(item => item.callRef)).toEqual([CALL_2]);
    const secondWhere = findMany.mock.calls[0][0].where;
    expect(secondWhere.createdAt.lte.getTime()).toBe(watermarkMs);
  });

  it('counts only patterns whose evidence references the call', async () => {
    const db = makeDb({
      client: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT_A }) },
      learningPattern: {
        findMany: vi.fn().mockResolvedValue([
          { evidence: [{ callId: CALL_1, quote: 'x' }, { callId: CALL_1, quote: 'y' }] },
          { evidence: [{ callId: CALL_2, quote: 'z' }] },
          { evidence: 'corrupt' },
        ]),
      },
      clientCall: {
        findMany: vi.fn().mockResolvedValue([makeCall({ id: CALL_1 })]),
        findFirst: vi.fn(),
      },
    });
    const service = createLearningObservationsService(db);
    const page = await service.listObservations({ clientId: CLIENT_A, limit: 10 });
    expect(page.items[0].patterns).toEqual({ read: true, count: 1, niche: 'restaurant' });
  });

  it('makes pattern truncation explicit and counts each matching pattern once', async () => {
    const evidence = [{ callId: CALL_1, clientId: CLIENT_A }, { callId: CALL_1, clientId: CLIENT_A }];
    const db = makeDb({
      client: { findFirst: vi.fn().mockResolvedValue({ id: CLIENT_A }) },
      clientCall: { findMany: vi.fn().mockResolvedValue([makeCall()]), findFirst: vi.fn() },
      learningPattern: { findMany: vi.fn().mockResolvedValue(Array.from({ length: 1001 }, () => ({ evidence }))) },
    });
    const page = await createLearningObservationsService(db).listObservations({ clientId: CLIENT_A });
    expect(page.patternsTruncated).toBe(true);
    expect(page.items[0].patterns.count).toBe(1000);
    expect(db.learningPattern.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 1001, select: { evidence: true }, where: expect.objectContaining({ clientIds: { has: CLIENT_A } }),
    }));
  });
  it('scopes getObservation to the authenticated client and 404s otherwise', async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(makeCall()).mockResolvedValueOnce(null);
    const db = makeDb({
      clientCall: { findMany: vi.fn(), findFirst },
    });
    const service = createLearningObservationsService(db);
    const item = await service.getObservation(CALL_1, CLIENT_A);
    expect(item.callRef).toBe(CALL_1);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: CALL_1, clientId: CLIENT_A }) }));
    await expect(service.getObservation(CALL_1, CLIENT_B)).rejects.toMatchObject({ status: 404, code: 'observation_not_found' });
    await expect(service.getObservation('nope', CLIENT_A)).rejects.toMatchObject({ code: 'call_ref_invalid' });
  });

  it('lists clients with bounded fields only', async () => {
    const db = makeDb({
      client: {
        findMany: vi.fn().mockResolvedValue([
          { id: CLIENT_A, businessName: 'Le Comptoir', contactEmail: 'secret@example.com', contactPhone: '+32', businessType: 'restaurant', country: 'France', agentLanguage: 'fr', createdAt: new Date('2026-01-01') },
        ]),
      },
    });
    const service = createLearningObservationsService(db);
    const page = await service.listClients({ limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toEqual({ id: CLIENT_A, niche: 'restaurant', country: 'FR', language: 'fr' });
    expect(page.items[0]).not.toHaveProperty('businessName');
    expect(page.items[0]).not.toHaveProperty('contactEmail');
    expect(page.items[0]).not.toHaveProperty('contactPhone');
  });
});
