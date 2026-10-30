import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Only the external DB boundary is mocked. Rows survive module reloads (new worker).
const db = vi.hoisted(() => ({
  agentCrmActivity: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
vi.mock('../../../config/database', () => ({ prisma: db }));

type Row = { id: string; clientId: string; type: string; dealId: string; status: string; performedAt: Date | null; createdAt: Date; content: any };
let rows: Row[];
let locked = 0;
const epoch = new Date('2026-10-20T10:00:00.000Z');
const payload = (extra: Record<string, unknown> = {}) => ({
  room: 'room-1', clientId: 'c1', caller: '+32460000000', trunkNumber: '+32460000001',
  brain: 'classic', startedAt: epoch.toISOString(), durationSeconds: 42,
  latency: { p50: 100, p95: 250 }, transcript: 'APPELANT: information privée', twilioCallSid: 'CA123', ...extra,
});
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((v: any) => matches(row, v));
    if (key === 'AND') return value.every((v: any) => matches(row, v));
    if (key === 'NOT') return !matches(row, value);
    if (value && typeof value === 'object' && 'path' in value) {
      const nested = value.path.reduce((a: any, k: string) => a?.[k], row[key]);
      return nested !== undefined && nested !== null;
    }
    const actual = row[key];
    if (value instanceof Date) return actual instanceof Date && +actual === +value;
    if (value === null || typeof value !== 'object') return actual === value;
    if ('equals' in value) return JSON.stringify(actual) === JSON.stringify(value.equals);
    if ('in' in value && !value.in.includes(actual)) return false;
    if ('lte' in value && (actual == null || actual > value.lte)) return false;
    if ('gt' in value && (actual == null || actual <= value.gt)) return false;
    return true;
  });
}
const load = async () => (await import('../voice-completion-inbox.service')).voiceCompletionInbox;
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(epoch);
  rows = []; locked = 0;
  let queue = Promise.resolve();
  db.$transaction.mockImplementation(async (callback: any) => {
    let release: (() => void) | undefined;
    const tx = { ...db, $queryRaw: async (...args: any[]) => {
      db.$queryRaw(...args);
      const previous = queue;
      queue = new Promise<void>(r => { release = r; });
      await previous; locked++;
      return [{ acquired: 1 }];
    } };
    try { return await callback(tx); } finally { if (release) { locked--; release(); } }
  });
  db.$queryRaw.mockResolvedValue([{ acquired: 1 }]);
  db.agentCrmActivity.findFirst.mockImplementation(async ({ where }: any) => structuredClone(rows.find(r => matches(r, where)) ?? null));
  db.agentCrmActivity.findMany.mockImplementation(async ({ where, take }: any) => structuredClone(rows.filter(r => matches(r, where)).slice(0, take)));
  db.agentCrmActivity.create.mockImplementation(async ({ data }: any) => {
    const row = { id: `job-${rows.length + 1}`, performedAt: null, createdAt: new Date(), ...structuredClone(data) };
    rows.push(row); return structuredClone(row);
  });
  db.agentCrmActivity.updateMany.mockImplementation(async ({ where, data }: any) => {
    const selected = rows.filter(r => matches(r, where));
    selected.forEach(row => Object.assign(row, structuredClone(data)));
    return { count: selected.length };
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('voice completion durable inbox', () => {
  it('stores and revalidates the STT label without losing numeric legacy summaries', async () => {
    const inbox = await load();
    const latency = { stt: 'nova-3', total_p50: 850 };
    const { id } = await inbox.enqueue(payload({ latency: { ...latency, langue: 'nl', caller: '' } }));
    expect(rows[0].content.payload.latency).toEqual(latency);
    const handler = vi.fn().mockResolvedValue(undefined);
    await inbox.runOne(id, handler);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ latency }));
    expect(rows[0].status).toBe('completed');
  });

  it('persists before resolving enqueue (the caller may now ACK), first payload wins under concurrent replay', async () => {
    const inbox = await load();
    const result = await Promise.all([inbox.enqueue(payload()), inbox.enqueue(payload({ transcript: 'replacement' }))]);
    expect(result).toEqual([{ id: 'job-1', already: false }, { id: 'job-1', already: true }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].content.payload).toEqual(payload());
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    const [sql, key] = db.$queryRaw.mock.calls[0];
    expect(sql.join('?')).toMatch(/pg_advisory_xact_lock/);
    expect(sql.join('?')).toContain('::text');
    expect(sql.join('?')).toMatch(/SELECT\s+1\s+FROM\s+l/i); // referenced CTE, never deserialize void
    expect(sql.join('?')).not.toContain('room-1');
    expect(key).toContain('c1'); expect(key).toContain('room-1');
  });

  it('does not resolve before durable create or acknowledge a failed transaction', async () => {
    const inbox = await load(); const gate = deferred();
    const create = db.agentCrmActivity.create.getMockImplementation()!;
    db.agentCrmActivity.create.mockImplementationOnce(async (args: any) => { await gate.promise; return create(args); });
    let ack = false;
    const writing = inbox.enqueue(payload()).then(() => { ack = true; });
    await Promise.resolve(); await Promise.resolve(); expect(ack).toBe(false);
    gate.resolve(); await writing; expect(rows).toHaveLength(1);
    db.$transaction.mockRejectedValueOnce(new Error('DB down'));
    await expect(inbox.enqueue(payload({ room: 'another' }))).rejects.toThrow();
    expect(rows).toHaveLength(1);
  });

  it('keeps completion tombstone, never recycles it, and isolates tenant and lead_capture', async () => {
    const inbox = await load(); const first = await inbox.enqueue(payload());
    await inbox.runOne(first.id, async () => {});
    expect(await inbox.enqueue(payload({ transcript: 'replay' }))).toEqual({ ...first, already: true });
    expect(rows[0].status).toBe('completed'); expect(rows[0].content.payload).toBeUndefined();
    const other = await inbox.enqueue(payload({ clientId: 'c2' }));
    expect(other.id).not.toBe(first.id);
    rows.push({ ...structuredClone(rows[1]), id: 'lead', type: 'lead_capture', status: 'pending', content: { transcript: 'untouched' } });
    const handler = vi.fn(); await inbox.runOne('lead', handler); await inbox.drain(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].clientId).toBe('c2');
    expect(rows.find(r => r.id === 'lead')?.content).toEqual({ transcript: 'untouched' });
  });

  it.each([
    { room: {} }, { clientId: [] }, { caller: {} }, { transcript: {} }, { durationSeconds: '42' },
    { durationSeconds: -1 }, { durationSeconds: Infinity }, { transcript: 'a'.repeat(200001) },
    { room: 'r'.repeat(256) }, { brain: {} }, { startedAt: {} }, { latency: { bad: {} } },
    { twilioCallSid: {} }, { trunkNumber: {} }, { startedAt: 'not a date' },
  ])('rejects invalid/bounded runtime input without DB writes: %j', async extra => {
    const inbox = await load(); await expect(inbox.enqueue(payload(extra) as any)).rejects.toThrow('Invalid voice completion payload');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('handler runs outside transaction; failure keeps payload for bounded backoff and surfaces sanitized error', async () => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload());
    const handler = vi.fn(async () => { expect(locked).toBe(0); throw new Error('secret transcript'); });
    await expect(inbox.runOne(id, handler)).rejects.toThrow('Voice completion handler failed');
    expect(rows[0].status).toBe('retry'); expect(rows[0].content.payload).toEqual(payload());
    expect(rows[0].content.attempts).toBe(1);
    expect(JSON.stringify(rows[0].content)).not.toContain('secret transcript');
    expect(+rows[0].performedAt!).toBeGreaterThan(+epoch);
    await inbox.runOne(id, handler); expect(handler).toHaveBeenCalledTimes(1);
    vi.setSystemTime(rows[0].performedAt!);
    await inbox.runOne(id, async () => {});
    expect(rows[0].status).toBe('completed'); expect(rows[0].content.payload).toBeUndefined();
  });

  it('two workers claim only once; a new process resumes after five minute lease', async () => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload());
    const gate = deferred(); const handler = vi.fn(async () => gate.promise);
    const old = inbox.runOne(id, handler);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    vi.resetModules(); const next = await load();
    await next.runOne(id, handler); expect(handler).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(+epoch + 300001));
    const newer = vi.fn(async () => {}); await next.runOne(id, newer);
    expect(newer).toHaveBeenCalledTimes(1); expect(rows[0].status).toBe('completed');
    gate.resolve(); await old;
    expect(rows[0].status).toBe('completed'); expect(rows[0].content.attempts).toBe(2);
  });

  it.each([false, true])('old owner cannot ACK/fail over a newer processing owner (failure=%s)', async fail => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload());
    const oldGate = deferred(); const newGate = deferred();
    const oldHandler = vi.fn(async () => { await oldGate.promise; if (fail) throw new Error('private'); });
    const old = inbox.runOne(id, oldHandler).catch(() => {});
    await vi.waitFor(() => expect(oldHandler).toHaveBeenCalledTimes(1));
    vi.setSystemTime(new Date(+epoch + 300001));
    const newHandler = vi.fn(async () => newGate.promise);
    const newer = inbox.runOne(id, newHandler);
    await vi.waitFor(() => expect(newHandler).toHaveBeenCalledTimes(1));
    const owner = structuredClone(rows[0]);
    oldGate.resolve(); await old;
    expect(rows[0]).toEqual(owner);
    newGate.resolve(); await newer;
    expect(rows[0].status).toBe('completed');
  });

  it('deadletters fifth failed attempt and erases payload', async () => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload()); const handler = vi.fn(async () => { throw new Error('private'); });
    for (let i = 0; i < 5; i++) {
      await expect(inbox.runOne(id, handler)).rejects.toThrow('Voice completion handler failed');
      vi.setSystemTime(new Date(+rows[0].performedAt! + 1));
    }
    expect(rows[0].status).toBe('dead_letter'); expect(rows[0].content.payload).toBeUndefined();
    await inbox.runOne(id, handler); expect(handler).toHaveBeenCalledTimes(5);
  });

  it('crashed fifth attempt is never attempted a sixth time', async () => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload());
    rows[0].status = 'processing'; rows[0].performedAt = new Date(+epoch - 300001); rows[0].content.attempts = 5;
    const handler = vi.fn(); await inbox.runOne(id, handler);
    expect(handler).not.toHaveBeenCalled(); expect(rows[0].status).toBe('dead_letter'); expect(rows[0].content.payload).toBeUndefined();
  });

  it('expires and erases PII at 24h including deadletters, not lead_capture; injectable now', async () => {
    const inbox = await load(); await inbox.enqueue(payload()); await inbox.enqueue(payload({ room: 'room-2' }));
    rows[1].status = 'dead_letter';
    rows.push({ ...structuredClone(rows[0]), id: 'lead', type: 'lead_capture' });
    const handler = vi.fn(); await inbox.drain(handler, new Date(+epoch + 86400000));
    expect(handler).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('dead_letter'); expect(rows[1].content.payload).toBeUndefined();
    expect(JSON.stringify(rows.slice(0, 2))).not.toContain('information privée');
    expect(rows[2].content.payload).toEqual(payload());
  });

  it('poison row and slow other tenant do not prevent subsequent work', async () => {
    const inbox = await load(); await inbox.enqueue(payload()); rows[0].content = { malformed: true };
    await inbox.enqueue(payload({ room: 'slow', clientId: 'c2' })); await inbox.enqueue(payload({ room: 'fast', clientId: 'c3' }));
    const gate = deferred(); const handler = vi.fn(async (p: any) => { if (p.room === 'slow') await gate.promise; });
    const draining = inbox.drain(handler);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(rows[2].status).toBe('completed'));
    expect(rows[0].status).toBe('dead_letter'); expect(rows[0].content.payload).toBeUndefined();
    gate.resolve(); await draining;
  });

  it('bounded drain does not spin and repeated startup drain recovers pending jobs', async () => {
    const inbox = await load();
    for (let i = 0; i < 35; i++) await inbox.enqueue(payload({ room: `room-${i}` }));
    const handler = vi.fn(async () => {}); await inbox.drain(handler);
    expect(handler.mock.calls.length).toBeGreaterThan(0); expect(handler.mock.calls.length).toBeLessThan(35);
    vi.resetModules(); const next = await load(); await next.drain(handler);
    expect(handler).toHaveBeenCalledTimes(35);
  });

  it('drain recovers expired processing leases, not a live owner', async () => {
    const inbox = await load(); await inbox.enqueue(payload());
    await inbox.enqueue(payload({ room: 'live' }));
    rows[0].status = rows[1].status = 'processing';
    rows[0].performedAt = new Date(+epoch - 300001); rows[1].performedAt = epoch;
    const handler = vi.fn(async () => {}); await inbox.drain(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(rows[0].status).toBe('completed'); expect(rows[1].status).toBe('processing');
  });

  it('expiration progresses beyond 100 completed tombstones without changing their status', async () => {
    const inbox = await load(); await inbox.enqueue(payload());
    const old = new Date(+epoch - 86400001);
    const template = structuredClone(rows[0]);
    rows = Array.from({ length: 105 }, (_, i) => ({ ...structuredClone(template), id: `done-${i}`, createdAt: old, status: 'completed', content: { attempts: 1 } }));
    rows.push({ ...template, id: 'expired', createdAt: old });
    const handler = vi.fn(); await inbox.drain(handler);
    expect(rows.slice(0, 105).every(r => r.status === 'completed')).toBe(true);
    expect(rows[105].content.payload).toBeUndefined();
    expect(rows[105].status).toBe('dead_letter'); expect(handler).not.toHaveBeenCalled();
    await inbox.drain(handler);
    expect(db.agentCrmActivity.updateMany.mock.calls.filter(([a]) => a.where.id === 'expired')).toHaveLength(1);
  });

  it.each(['read', 'increment'])('does not invoke handler after ownership is lost before %s', async stage => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload());
    if (stage === 'read') {
      const read = db.agentCrmActivity.findFirst.getMockImplementation()!;
      db.agentCrmActivity.findFirst.mockImplementationOnce(async (args: any) => {
        Object.assign(rows[0], { provider: 'new-owner', status: 'processing' });
        return read(args);
      });
    } else {
      const update = db.agentCrmActivity.updateMany.getMockImplementation()!;
      db.agentCrmActivity.updateMany.mockImplementation(async (args: any) => {
        if (args.data.content?.attempts) Object.assign(rows[0], { provider: 'new-owner' });
        return update(args);
      });
    }
    const handler = vi.fn(); await inbox.runOne(id, handler);
    expect(handler).not.toHaveBeenCalled();
    expect((rows[0] as any).provider).toBe('new-owner');
  });

  it.each([{ clientId: 'other-tenant' }, { room: 'other-room' }, { attempts: 'bad' }])('rejects poisoned envelope identity/counter %j', async extra => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload());
    if ('attempts' in extra) rows[0].content.attempts = extra.attempts;
    else Object.assign(rows[0].content.payload, extra);
    const handler = vi.fn(); await inbox.runOne(id, handler);
    expect(handler).not.toHaveBeenCalled(); expect(rows[0].status).toBe('dead_letter');
  });

  it('runOne never runs a payload older than the PII TTL', async () => {
    const inbox = await load(); const { id } = await inbox.enqueue(payload());
    rows[0].createdAt = new Date(+epoch - 86400000);
    const handler = vi.fn(); await inbox.runOne(id, handler);
    expect(handler).not.toHaveBeenCalled(); expect(rows[0].content.payload).toBeUndefined();
  });

  it('expiry CAS cannot overwrite a completion that raced the scan', async () => {
    const inbox = await load(); await inbox.enqueue(payload()); rows[0].createdAt = new Date(+epoch - 86400001);
    const scan = db.agentCrmActivity.findMany.getMockImplementation()!;
    db.agentCrmActivity.findMany.mockImplementationOnce(async (args: any) => {
      const result = await scan(args);
      Object.assign(rows[0], { status: 'completed', content: { attempts: 1 } });
      return result;
    });
    await inbox.drain(vi.fn());
    expect(rows[0].status).toBe('completed'); expect(rows[0].content).toEqual({ attempts: 1 });
  });

  it('test start drains once without timer', async () => {
    const inbox = await load(); await inbox.enqueue(payload());
    const handler = vi.fn(async () => {}); const stop = inbox.start(handler);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(vi.getTimerCount()).toBe(0); stop();
  });

  it('start polls every 30s, unrefs interval, prevents local overlap and stops', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const inbox = await load(); await inbox.enqueue(payload());
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    const gate = deferred(); const handler = vi.fn(async () => gate.promise);
    const stop = inbox.start(handler);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    const timer = intervalSpy.mock.results[0].value as NodeJS.Timeout;
    expect(timer.hasRef()).toBe(false);
    const before = db.agentCrmActivity.findMany.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(db.agentCrmActivity.findMany).toHaveBeenCalledTimes(before);
    gate.resolve(); await vi.advanceTimersByTimeAsync(0);
    // Missed ticks are dropped, not queued behind the slow drain.
    expect(db.agentCrmActivity.findMany).toHaveBeenCalledTimes(before);
    await inbox.enqueue(payload({ room: 'later' }));
    await vi.advanceTimersByTimeAsync(30000); expect(handler).toHaveBeenCalledTimes(2);
    stop(); expect(vi.getTimerCount()).toBe(0); intervalSpy.mockRestore();
  });
});
