import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory transactional adapter only: never import the real database/config.
const db = vi.hoisted(() => {
  const rows = new Map<string, any>();
  const locks = new Map<string, Promise<void>>();
  const key = (args: any) => JSON.stringify(args.where.clientId_callerNumber);
  const findUnique = vi.fn(async (args: any) => structuredClone(rows.get(key(args)) ?? null));
  const upsert = vi.fn(async (args: any) => {
    const old = rows.get(key(args));
    const data = old ? args.update : args.create;
    const next = { isBlocked: false, preferences: [], totalCalls: 0, ...old, ...data };
    if (typeof data.totalCalls === 'object') next.totalCalls = (old?.totalCalls ?? 0) + data.totalCalls.increment;
    rows.set(key(args), structuredClone(next));
    return next;
  });
  const queryRaw = vi.fn();
  const transaction = vi.fn(async (fn: any) => {
    let release: (() => void) | undefined;
    let snapshot: Map<string, any> | undefined;
    const tx = { callerMemory: { findUnique, upsert }, $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queryRaw(strings, ...values);
      const lockKey = String(values[0]);
      const previous = locks.get(lockKey) ?? Promise.resolve();
      locks.set(lockKey, new Promise<void>(resolve => { release = resolve; }));
      await previous;
      snapshot = structuredClone(rows);
      return [{ pg_advisory_xact_lock: '' }];
    } };
    try { return await fn(tx); }
    catch (error) { if (snapshot) { rows.clear(); for (const [k, v] of snapshot) rows.set(k, v); } throw error; }
    finally { release?.(); }
  });
  return { rows, locks, findUnique, upsert, queryRaw, transaction };
});
const cache = vi.hoisted(() => ({ invalidateCaller: vi.fn() }));
const log = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../../../config/database', () => ({ prisma: { callerMemory: db, $transaction: db.transaction } }));
vi.mock('../../../config/logger', () => ({ logger: log }));
vi.mock('../realtime-context.service', () => ({ realtimeContextService: cache }));
vi.mock('../phone-allocation.service', () => ({ normalizeNumber: (x: string) => x.replace(/\D/g, '') }));
const { callerMemoryService: service } = await import('../caller-memory.service');
const phone = '32475123456';
const base = { clientId: 'tenant-a', callerNumber: phone };
const remember = (input: Record<string, unknown>) => service.remember({ ...base, ...input } as Parameters<typeof service.remember>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  db.rows.clear(); db.locks.clear();
});

describe('reset cutoff', () => {
  it('rejects delayed capture/completion including equal cutoff and missing timestamp, then accepts confirmed spelling', async () => {
    await remember({ name: 'Old', occurredAt: new Date('2026-10-18') });
    const row = [...db.rows.values()][0];
    row.knownName = null; row.email = null; row.profileSummary = null; row.lastSummary = null; row.preferences = [];
    row.facts.identity = { name: null, email: null };
    row.facts.meta.identityResetAt = '2026-10-20T00:00:00.000Z';
    db.upsert.mockClear();
    for (const phase of ['capture', 'completed']) for (const occurredAt of [undefined, new Date('2026-10-19'), new Date('2026-10-20')]) {
      await remember({ name: 'Old', email: 'old@example.com', summary: 'Old', preferences: ['Old'], phase, occurredAt });
    }
    expect(db.upsert).not.toHaveBeenCalled();
    expect(await service.get(base.clientId, phone)).toMatchObject({ knownName: null, email: null, profileSummary: null, preferences: [] });
    await remember({ name: 'Jean-Luc de la Forge', phase: 'capture', identitySource: 'confirmed', occurredAt: new Date('2026-10-21') });
    expect((await service.get(base.clientId, phone))?.knownName).toBe('Jean-Luc de la Forge');
  });
});

describe('caller memory engine, offline', () => {
  it('keeps a live correction through a different end analysis and the next read', async () => {
    await remember({ name: 'Julien', phase: 'capture', identitySource: 'capture' });
    await remember({ name: 'Julien Martin', phase: 'capture', identitySource: 'confirmed' });
    await remember({ name: 'Gilles', identitySource: 'analysis' });
    expect((await service.get(base.clientId, phone))?.knownName).toBe('Julien Martin');
  });
});

describe('engagements — une demande d\'appel est durable', () => {
  it('persiste la demande et la restitue à la lecture suivante', async () => {
    await remember({
      request: { text: 'Rappeler pour le devis', callbackWhen: 'demain 9h', forPerson: 'Sarah' },
    });
    const got = await service.get(base.clientId, phone);
    expect(got?.openRequests).toEqual([{ text: 'Rappeler pour le devis', callbackWhen: 'demain 9h', forPerson: 'Sarah' }]);
  });

  it('empile les demandes distinctes, la plus récente d\'abord', async () => {
    await remember({ request: { text: 'Devis toiture' } });
    await remember({ request: { text: 'Changer le créneau' } });
    const got = await service.get(base.clientId, phone);
    expect(got?.openRequests?.map(r => r.text)).toEqual(['Changer le créneau', 'Devis toiture']);
  });

  it('ne duplique pas une demande identique répétée (idempotence textuelle)', async () => {
    await remember({ request: { text: 'Devis toiture', callbackWhen: 'lundi' } });
    await remember({ request: { text: 'Devis toiture', callbackWhen: 'mardi' } });
    const got = await service.get(base.clientId, phone);
    expect(got?.openRequests).toHaveLength(1);
    expect(got?.openRequests?.[0].callbackWhen).toBe('mardi');
  });

  it('borne la pile à cinq demandes — la mémoire vit dans chaque prompt', async () => {
    for (const text of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']) {
      await remember({ request: { text } });
    }
    const got = await service.get(base.clientId, phone);
    expect(got?.openRequests).toHaveLength(5);
    expect(got?.openRequests?.[0].text).toBe('r6');
  });

  it('ignore une demande sans texte', async () => {
    await remember({ request: { text: '  ' } });
    expect((await service.get(base.clientId, phone))?.openRequests).toEqual([]);
  });
});

describe('contact — le numéro de rappel dicté est un fait, pas une clé', () => {
  it('persiste le callbackNumber séparément de la clé d\'écriture', async () => {
    await remember({ callerNumber: phone, callbackNumber: '33699887766' });
    const got = await service.get(base.clientId, phone);
    expect(got?.callbackNumber).toBe('33699887766');
  });

  it('un callbackNumber ultérieur remplace le précédent', async () => {
    await remember({ callbackNumber: '33699887766' });
    await remember({ callbackNumber: '33611223344' });
    expect((await service.get(base.clientId, phone))?.callbackNumber).toBe('33611223344');
  });
});

describe('corrections — preferences', () => {
  it('removePreferences retire une préférence stockée, sans toucher aux autres', async () => {
    await remember({ preferences: ['Fenêtre côté mer', 'Sans noix', 'Appeler après 18h'] });
    await remember({ removePreferences: ['sans noix'] });
    expect((await service.get(base.clientId, phone))?.preferences)
      .toEqual(['Fenêtre côté mer', 'Appeler après 18h']);
  });
});

describe('idempotence — un même callId ne compte qu\'un appel', () => {
  it('deux remember avec le même callId n\'incrémentent qu\'une fois', async () => {
    await remember({ callId: 'call-1', summary: 'Premier passage' });
    await remember({ callId: 'call-1', summary: 'Premier passage, complété' });
    const got = await service.get(base.clientId, phone);
    expect(got?.totalCalls).toBe(1);
  });

  it('un callId différent incrémente normalement', async () => {
    await remember({ callId: 'call-1' });
    await remember({ callId: 'call-2' });
    expect((await service.get(base.clientId, phone))?.totalCalls).toBe(2);
  });
});

describe('premium review regressions', () => {
  it('counts A,B,A once per completion, not capture', async () => {
    await remember({ callId: 'A', phase: 'capture' });
    expect((await service.get(base.clientId, phone))?.totalCalls).toBe(0);
    await remember({ callId: 'A', phase: 'completed' });
    await remember({ callId: 'B', phase: 'completed' });
    await remember({ callId: 'A', phase: 'completed' });
    expect((await service.get(base.clientId, phone))?.totalCalls).toBe(2);
  });
  it('preserves fresher summary, preferences and request corrections', async () => {
    await remember({ occurredAt: new Date('2026-10-19'), summary: 'Fresh', outcome: 'booked', preferences: ['Quiet'], request: { text: 'Quote', callbackWhen: 'Tuesday' } });
    await remember({ occurredAt: new Date('2026-10-18'), summary: 'Old', outcome: 'missed', removePreferences: ['Quiet'], preferences: ['Loud'], request: { text: 'Quote', callbackWhen: 'Monday' } });
    expect(await service.get(base.clientId, phone)).toMatchObject({ lastSummary: 'Fresh', lastOutcome: 'booked', preferences: ['Quiet'], lastCallAt: new Date('2026-10-19'), openRequests: [{ text: 'Quote', callbackWhen: 'Tuesday' }] });
  });
  it('does not erase summary on an empty capture', async () => {
    await remember({ summary: 'Context', outcome: 'booked' });
    await remember({ phase: 'capture', name: 'Jean' });
    expect(await service.get(base.clientId, phone)).toMatchObject({ lastSummary: 'Context', lastOutcome: 'booked' });
  });
  it('merges confirmed corrections across legacy and digits keys', async () => {
    await remember({ name: 'Correct', identitySource: 'confirmed', occurredAt: new Date('2026-10-18') });
    const row = structuredClone([...db.rows.values()][0]);
    row.facts.identity.name = { value: 'Wrong', source: 'analysis', at: '2026-10-19T00:00:00.000Z', callId: null };
    row.knownName = 'Wrong'; row.lastCallAt = new Date('2026-10-19');
    db.rows.set(JSON.stringify({ clientId: base.clientId, callerNumber: '+' + phone }), row);
    expect((await service.get(base.clientId, phone))?.knownName).toBe('Correct');
    await remember({ summary: 'Next' });
    expect((await service.get(base.clientId, phone))?.knownName).toBe('Correct');
  });
  it('never leaks raw facts or provenance on blocked records', async () => {
    await remember({ name: 'Private', identitySource: 'confirmed', request: { text: 'Private request' } });
    [...db.rows.values()][0].isBlocked = true;
    const got = await service.get(base.clientId, phone);
    expect(got?.facts).toBeNull();
    expect(JSON.stringify(got)).not.toContain('Private');
    expect((got as any)?.identitySource).toBeNull();
  });
  it('rejects invalid and future occurredAt', async () => {
    await remember({ occurredAt: new Date('invalid'), name: 'Bad' });
    await remember({ occurredAt: new Date('2099-01-01'), name: 'Future' });
    await remember({ occurredAt: new Date(Date.now() + 30_000), name: 'Near future' });
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it('bounds completion ledger and does not duplicate replayed summary', async () => {
    await remember({ callId: 'A', summary: 'Unique' });
    await remember({ callId: 'A', summary: 'Unique' });
    expect((await service.get(base.clientId, phone))?.profileSummary).toBe('Unique');
    for (let n = 0; n < 140; n++) await remember({ callId: 'call-' + n });
    expect([...db.rows.values()][0].facts.meta.completedCalls).toHaveLength(128);
  });
});

describe('opposition physique', () => {
  it('purge les deux lignes sous le verrou et interdit toute résurrection', async () => {
    await remember({ name: 'Private', email: 'private@example.com', summary: 'Private', preferences: ['Private'], request: { text: 'Private' } });
    db.rows.set(JSON.stringify({ clientId: base.clientId, callerNumber: '+' + phone }), structuredClone([...db.rows.values()][0]));
    await service.block(base.clientId, '+' + phone);
    for (const row of db.rows.values()) {
      expect(row).toMatchObject({ isBlocked: true, knownName: null, email: null, profileSummary: null, preferences: [], lastSummary: null, lastOutcome: null, totalCalls: 0, lastCallAt: null });
      expect(JSON.stringify(row.facts)).not.toContain('Private');
    }
    await remember({ name: 'Revived', callId: 'new' });
    expect((await service.get(base.clientId, phone))?.knownName).toBeNull();
    expect(db.queryRaw.mock.calls.map(c => c[1])).toEqual(Array(3).fill(`caller-memory:${base.clientId}:${phone}`));
  });
});

describe('consolidation compteur legacy', () => {
  it.each([false, true])('persiste le maximum historique sans recompter une completion (canonique présente=%s)', async hasCanonical => {
    await remember({ callId: 'A' });
    const legacy = structuredClone([...db.rows.values()][0]);
    legacy.totalCalls = 10;
    db.rows.set(JSON.stringify({ clientId: base.clientId, callerNumber: '+' + phone }), legacy);
    if (!hasCanonical) db.rows.delete(JSON.stringify({ clientId: base.clientId, callerNumber: phone }));
    await remember({ callId: 'A', phase: 'capture' });
    expect(db.rows.get(JSON.stringify({ clientId: base.clientId, callerNumber: phone })).totalCalls).toBe(10);
    await remember({ callId: 'A' });
    await remember({ callId: 'B' });
    await remember({ callId: 'A' });
    expect((await service.get(base.clientId, phone))?.totalCalls).toBe(11);
  });
});

describe('isolation — deux clients, un même appelant', () => {
  it('aucune fuite entre clients pour le même numéro', async () => {
    await service.remember({ ...base, name: 'Julien', identitySource: 'confirmed' });
    await service.remember({ clientId: 'tenant-b', callerNumber: phone, name: 'Martine', identitySource: 'confirmed' });
    expect((await service.get('tenant-a', phone))?.knownName).toBe('Julien');
    expect((await service.get('tenant-b', phone))?.knownName).toBe('Martine');
  });
});
