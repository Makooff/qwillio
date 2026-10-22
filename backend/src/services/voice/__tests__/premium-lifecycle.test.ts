import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real services, policy, analysis parser and memory merge; only I/O is replaced.
const io = vi.hoisted(() => ({ db: {} as any, fetch: vi.fn() }));
vi.mock('../../../config/database', () => ({ prisma: io.db }));
vi.mock('../../../config/env', () => ({ env: { REDIS_URL: undefined, VOICE_CONTEXT_TTL_MS: 60_000, DEFAULT_TIMEZONE: 'Europe/Brussels' } }));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../discord.service', () => ({ discordService: { notify: vi.fn(async () => {}) } }));
vi.mock('../../sms.service', () => ({ smsService: { sendBookingConfirmationSMS: vi.fn(async () => false) } }));
vi.mock('../../call-notification.service', () => ({ callNotificationService: { notify: vi.fn(async () => {}) } }));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const now = new Date('2026-10-20T10:00:00.000Z');
const old = '2026-06-01T10:00:00.000Z';
const phone = '32475123456';
let calls: any[];
let memories: any[];
let activities: any[];
let client: any;
let bookings: any[];
let failClientUpdate: boolean;
let failRescue: boolean;
let failJournal: boolean;
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([k, v]: [string, any]) => {
    if (k === 'OR') return v.some((x: any) => matches(row, x));
    if (k === 'AND') return v.every((x: any) => matches(row, x));
    if (k === 'clientId_callerNumber') return matches(row, v);
    if (v === null || typeof v !== 'object') return row[k] === v;
    if (v instanceof Date) return +row[k] === +v;
    if ('in' in v) return v.in.includes(row[k]);
    if ('lte' in v) return row[k] != null && row[k] <= v.lte;
    if ('gte' in v) return row[k] != null && row[k] >= v.gte;
    return matches(row[k] ?? {}, v);
  });
}
function project(row: any, select: any) {
  if (!row) return null;
  return structuredClone(select ? Object.fromEntries(Object.keys(select).filter(k => select[k]).map(k => [k, row[k]])) : row);
}
function table(rows: () => any[]) {
  return {
    findUnique: vi.fn(async ({ where, select }: any) => project(rows().find(r => matches(r, where)), select)),
    findFirst: vi.fn(async ({ where, select }: any) => project(rows().find(r => matches(r, where)), select)),
    findMany: vi.fn(async ({ where, select, take }: any) => rows().filter(r => matches(r, where)).slice(0, take).map(r => project(r, select))),
    count: vi.fn(async ({ where }: any) => rows().filter(r => matches(r, where)).length),
    create: vi.fn(async ({ data, select }: any) => {
      if (data.type === 'lead_capture' && failRescue) { failRescue = false; throw new Error('rescue storage unavailable'); }
      if (data.vapiCallId && rows().some(r => r.vapiCallId === data.vapiCallId)) throw new Error('unique vapiCallId');
      const row = { id: `row-${rows().length}`, createdAt: new Date(), performedAt: null, ...structuredClone(data) };
      rows().push(row); return project(row, select);
    }),
    upsert: vi.fn(async ({ where, create, update, select }: any) => {
      const row = rows().find(r => matches(r, where));
      if (row) {
        // Prisma ignores undefined update fields; null explicitly clears them.
        Object.assign(row, structuredClone(Object.fromEntries(
          Object.entries(update).filter(([, value]) => value !== undefined),
        )));
        return project(row, select);
      }
      if (create.vapiCallId && rows().some(r => r.vapiCallId === create.vapiCallId)) throw new Error('unique vapiCallId');
      const created = { id: `row-${rows().length}`, createdAt: new Date(), performedAt: null, ...structuredClone(create) };
      rows().push(created);
      return project(created, select);
    }),
    update: vi.fn(async ({ where, data, select }: any) => {
      const row = rows().find(r => matches(r, where));
      if (!row) throw new Error('missing row');
      if (data.metadata?.completionLifecycle?.completed && failJournal) { failJournal = false; throw new Error('journal write unavailable'); }
      Object.assign(row, structuredClone(data)); return project(row, select);
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const chosen = rows().filter(r => matches(r, where));
      chosen.forEach(r => Object.assign(r, structuredClone(data))); return { count: chosen.length };
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      const chosen = rows().filter(r => matches(r, where));
      chosen.forEach(r => rows().splice(rows().indexOf(r), 1)); return { count: chosen.length };
    }),
  };
}
const model = (name: string | null = null, callbackPromised = false) => io.fetch.mockResolvedValue({
  ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({
    callerName: name, summary: 'Demande de rappel', sentiment: 'neutral', outcome: 'message_taken',
    bookingRequested: false, isLead: false, callbackPromised, tags: [],
  }) } }] }),
});
function seed(source: string = 'analysis', at = old, name = 'Alice Martin') {
  memories.push({ clientId: 'tenant', callerNumber: phone, knownName: name, totalCalls: 1,
    isBlocked: false, preferences: [], lastCallAt: new Date(at),
    facts: { version: 1, identity: { name: { value: name, source, at, callId: 'old' } } } });
  calls.push({ id: 'old-call', clientId: 'tenant', vapiCallId: 'old', callerNumber: phone, status: 'completed',
    createdAt: new Date(at), endedAt: new Date(at), nameCollected: name, callerName: name });
}
async function services() {
  return {
    context: (await import('../realtime-context.service')).realtimeContextService,
    calls: (await import('../../client-call.service')).clientCallService,
    orchestrator: (await import('../realtime-orchestrator.service')).realtimeOrchestratorService,
    memory: (await import('../caller-memory.service')).callerMemoryService,
  };
}
const finish = async (service: any, extra = {}, room = 'new') => service.handleClientCallCompleted(
  'tenant', room, 'APPELANT: Bonjour, je souhaite un renseignement.', 30, phone, undefined, null, extra,
);
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  vi.stubGlobal('fetch', io.fetch);
  calls = []; memories = []; activities = []; bookings = [];
  failClientUpdate = failRescue = failJournal = false;
  client = { id: 'tenant', businessName: 'Atelier', agentName: 'Marc', country: 'BE', businessType: 'other', retentionDays: 90, totalCallsMade: 0 };
  io.db.clientCall = { ...table(() => calls), aggregate: vi.fn(async () => ({ _sum: { durationSeconds: 30 } })) };
  io.db.callerMemory = { ...table(() => memories), upsert: vi.fn(async ({ where, create, update }: any) => {
    const row = memories.find(r => matches(r, where));
    if (!row) { memories.push(structuredClone(create)); return structuredClone(create); }
    const count = row.totalCalls + update.totalCalls.increment;
    Object.assign(row, structuredClone(update), { totalCalls: count }); return structuredClone(row);
  }) };
  io.db.clientBooking = table(() => bookings);
  io.db.spamNumber = table(() => []);
  io.db.activity = table(() => activities);
  io.db.agentCrmActivity = table(() => activities);
  // Exercise real CRM matching, but simulate its storage being unavailable (best effort).
  io.db.contact = { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), create: vi.fn(async () => { throw new Error('CRM boundary offline'); }) };
  io.db.client = {
    findUnique: vi.fn(async ({ where }: any) => matches(client, where) ? structuredClone(client) : null),
    update: vi.fn(async ({ data }: any) => {
      if (failClientUpdate) { failClientUpdate = false; throw new Error('client.update unavailable'); }
      client.totalCallsMade += data.totalCallsMade?.increment ?? 0;
      client.lastCallDate = data.lastCallDate; return structuredClone(client);
    }),
  };
  io.db.$queryRaw = vi.fn(async () => [{ locked: '1' }]);
  let queue = Promise.resolve();
  io.db.$transaction = vi.fn(async (fn: any) => {
    const previous = queue; let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; }); await previous;
    const snapshot = structuredClone({ calls, memories, activities, client, bookings });
    try { return await fn(io.db); }
    catch (e) { ({ calls, memories, activities, client, bookings } = snapshot); throw e; }
    finally { release(); }
  });
  model();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('P1 completion resume through real services', () => {
  it.each(['in-progress', 'ended'])('completes the same %s row, retaining metadata and links through retry', async status => {
    const startedAt = new Date(now.getTime() - 30_000);
    calls.push({ id: 'stable-placeholder', clientId: 'tenant', vapiCallId: 'new', status,
      callerNumber: phone, startedAt, createdAt: startedAt,
      metadata: { recordingSid: 'RE-stable', liveMarker: { retained: true } } });
    activities.push({ id: 'linked-live', clientId: 'tenant', type: 'live-marker', callId: 'stable-placeholder' });
    model(null, true);
    const s = await services();
    failClientUpdate = true;
    await expect(finish(s.calls)).rejects.toThrow('client.update unavailable');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 'stable-placeholder', status: 'completed',
      clientId: 'tenant', vapiCallId: 'new', callerNumber: phone,
      transcript: 'APPELANT: Bonjour, je souhaite un renseignement.', durationSeconds: 30,
      metadata: { recordingSid: 'RE-stable', liveMarker: { retained: true },
        completionLifecycle: { completed: false } } });
    expect(io.db.clientCall.create).not.toHaveBeenCalled();
    expect(io.db.clientCall.deleteMany).not.toHaveBeenCalled();
    expect(client.totalCallsMade).toBe(0);
    expect(activities.filter(a => a.type === 'lead_capture')).toHaveLength(0);
    const analyses = io.fetch.mock.calls.length;
    vi.resetModules();
    const next = await services();
    await finish(next.calls);
    await finish(next.calls);
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('stable-placeholder');
    expect(calls[0].metadata).toMatchObject({ recordingSid: 'RE-stable', liveMarker: { retained: true },
      completionLifecycle: { completed: true } });
    expect(activities.find(a => a.id === 'linked-live').callId).toBe(calls[0].id);
    expect(io.fetch).toHaveBeenCalledTimes(analyses);
    expect(client.totalCallsMade).toBe(1);
    expect(activities.filter(a => a.type === 'lead_capture')).toHaveLength(1);
  });

  it('rejects a foreign tenant call collision without mutating its stable row', async () => {
    const foreign = { id: 'foreign-row', clientId: 'other-tenant', vapiCallId: 'new',
      status: 'completed', transcript: 'foreign transcript', metadata: { recordingSid: 'RE-foreign' } };
    calls.push(structuredClone(foreign));
    const s = await services();
    await expect(finish(s.calls)).rejects.toThrow('unique vapiCallId');
    expect(calls).toEqual([foreign]);
    expect(client.totalCallsMade).toBe(0);
    expect(activities).toHaveLength(0);
  });

  it('models Prisma upsert update without inserting, ignores undefined, and applies explicit null', async () => {
    calls.push({ id: 'stable', clientId: 'tenant', vapiCallId: 'new', callerNumber: phone, summary: 'old' });
    const row = await io.db.clientCall.upsert({ where: { vapiCallId: 'new' },
      create: { id: 'wrong-new-id', vapiCallId: 'new' },
      update: { callerNumber: undefined, summary: null, status: 'ended' } });
    expect(calls).toHaveLength(1);
    expect(row).toMatchObject({ id: 'stable', clientId: 'tenant', callerNumber: phone, summary: null, status: 'ended' });
  });
  it.each(['client', 'rescue', 'journal'])('rolls back %s failure and resumes without analysis, duplicate call, counter or lead', async failure => {
    model(null, true); const s = await services();
    if (failure === 'client') failClientUpdate = true;
    if (failure === 'rescue') failRescue = true;
    if (failure === 'journal') failJournal = true;
    await expect(finish(s.calls)).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(client.totalCallsMade).toBe(0);
    expect(activities.filter(a => a.type === 'lead_capture')).toHaveLength(0);
    expect(calls[0].metadata.completionLifecycle.completed).toBe(false);
    const analyses = io.fetch.mock.calls.length;
    // A new worker has only the durable row, not the first attempt's local state.
    vi.resetModules(); const next = await services();
    const result = await finish(next.calls);
    expect(result.rescuedLead?.phone).toBe(phone);
    expect(io.fetch).toHaveBeenCalledTimes(analyses);
    expect(calls).toHaveLength(1);
    expect(client.totalCallsMade).toBe(1);
    expect(activities.filter(a => a.type === 'lead_capture')).toHaveLength(1);
    expect(calls[0].metadata.completionLifecycle.completed).toBe(true);
    await finish(next.calls);
    expect(client.totalCallsMade).toBe(1);
    expect(activities.filter(a => a.type === 'lead_capture')).toHaveLength(1);
    expect(io.fetch).toHaveBeenCalledTimes(analyses);
  });

  it('serializes concurrent resumes under a transaction advisory lock', async () => {
    model(null, true); const s = await services(); failClientUpdate = true;
    await expect(finish(s.calls)).rejects.toThrow();
    const analyses = io.fetch.mock.calls.length;
    await Promise.all(Array.from({ length: 5 }, () => finish(s.calls)));
    expect(calls).toHaveLength(1);
    expect(client.totalCallsMade).toBe(1);
    expect(activities.filter(a => a.type === 'lead_capture')).toHaveLength(1);
    expect(io.fetch).toHaveBeenCalledTimes(analyses);
    const locks = io.db.$queryRaw.mock.calls.filter(([, key]: any[]) => String(key).startsWith('call-completion:'));
    expect(locks.length).toBeGreaterThanOrEqual(5);
    const [sql, key] = locks[0];
    expect(sql.join('?')).toContain('pg_advisory_xact_lock');
    expect(key).toContain('new');
  });
});

describe('P1 identity lifecycle through real services', () => {
  it('does not resurrect expired analysis from raw ClientCall in caller history', async () => {
    seed(); const s = await services();
    expect((await s.context.getCallerHistory('tenant', phone)).knownName).toBeNull();
  });
  it('does not impose expired knownName on a new completion or renew it through persistMemory', async () => {
    seed(); const s = await services();
    await finish(s.calls);
    expect(calls.find(c => c.vapiCallId === 'new').nameCollected).toBeNull();
    await s.orchestrator.persistMemory({ clientId: 'tenant', vapiCallId: 'new', callerNumber: phone, metrics: null });
    expect(memories[0].facts.identity.name.at).toBe(old);
    expect(io.db.callerMemory.upsert).toHaveBeenCalled();
    expect(memories[0].facts.meta.completedCalls).toContain('new');
    expect(memories[0].totalCalls).toBe(2);
    expect((await s.memory.get('tenant', phone))?.knownName).toBeNull();
  });
  it('does not refresh the date of an unexpired identity copied to a new call', async () => {
    const at = '2026-10-01T10:00:00.000Z'; seed('analysis', at); const s = await services();
    await finish(s.calls);
    expect(calls.find(c => c.vapiCallId === 'new').nameCollected).toBe('Alice Martin');
    await s.orchestrator.persistMemory({ clientId: 'tenant', vapiCallId: 'new', callerNumber: phone, metrics: null });
    expect(memories[0].facts.identity.name.at).toBe(at);
  });
});
