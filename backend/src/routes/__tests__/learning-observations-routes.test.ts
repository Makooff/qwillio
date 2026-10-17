import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAutofixToken } from '../autofix.routes';

// Hoisted mocks precede router imports: no config/env loader or DATABASE_URL startup.
const db = vi.hoisted(() => ({
  client: { findFirst: vi.fn(), findMany: vi.fn() },
  clientCall: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  learningPattern: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock('../../config/database', () => ({ prisma: db }));
vi.mock('../../config/env', () => ({ env: {} }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/discord.service', () => ({ discordService: {} }));
import router from '../learning.routes';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const app = express();
app.use(express.json());
app.use('/api/learning', router);
const client = { businessType: 'restaurant', country: 'BE', agentLanguage: 'fr' };
const call = (id = C1, clientId = A) => ({
  id, clientId, status: 'completed', createdAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:05:00Z'),
  client, isSpam: false, transcript: 'User: secret-transcript', summary: 'secret-summary', callerName: 'secret-name',
  metadata: { callerNumber: 'secret-number', room: 'secret-room', error: 'secret-error', latency: { tours: 4, total_p50: 450 }, mortem: { verdict: 'watch', codes: ['slow_turns', 'secret-name'] } },
});
const authGet = (path: string) => request(app).get(`/api/learning${path}`).set('X-Learning-Read-Token', 'read-test-key');
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('LEARNING_READ_TOKEN', 'read-test-key');
  vi.stubEnv('AUTOFIX_TOKEN', 'owner-test-key');
  delete process.env.LEARNING_READ_CURSOR_SECRET;
  db.client.findFirst.mockResolvedValue({ id: A });
  db.client.findMany.mockResolvedValue([]);
  db.clientCall.findMany.mockResolvedValue([call()]);
  db.learningPattern.findMany.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe('privileged learning read HTTP API', () => {
  it('fails closed without configured keys and never queries storage', async () => {
    delete process.env.LEARNING_READ_TOKEN;
    delete process.env.AUTOFIX_TOKEN;
    expect((await authGet('/clients')).status).toBe(503);
    expect((await authGet(`/observations?clientId=${A}`)).status).toBe(503);
    expect(db.client.findMany).not.toHaveBeenCalled();
    expect(db.clientCall.findMany).not.toHaveBeenCalled();
  });
  it('rejects missing, wrong, query, body and JWT credentials', async () => {
    for (const path of ['/clients', `/observations?clientId=${A}`]) {
      expect((await request(app).get(`/api/learning${path}`)).status).toBe(401);
      expect((await request(app).get(`/api/learning${path}`).set('X-Learning-Read-Token', 'x')).status).toBe(401);
      expect((await request(app).get(`/api/learning${path}`).set('Authorization', 'Bearer read-test-key')).status).toBe(401);
    }
    expect((await request(app).get('/api/learning/clients?token=read-test-key').send({ token: 'read-test-key' })).status).toBe(401);
    expect(db.client.findMany).not.toHaveBeenCalled();
  });
  it('uses an independent read key, not AUTOFIX_TOKEN, when configured', async () => {
    expect((await authGet('/clients')).status).toBe(200);
    expect((await request(app).get('/api/learning/clients').set('X-Autofix-Token', 'owner-test-key')).status).toBe(401);
    expect((await request(app).get('/api/learning/clients').set('X-Learning-Read-Token', 'owner-test-key')).status).toBe(401);
  });
  it('allows the legacy owner token only if the read key is absent, not blank', async () => {
    delete process.env.LEARNING_READ_TOKEN;
    expect((await request(app).get('/api/learning/clients').set('X-Autofix-Token', 'owner-test-key')).status).toBe(200);
    process.env.LEARNING_READ_TOKEN = '   ';
    expect((await request(app).get('/api/learning/clients').set('X-Autofix-Token', 'owner-test-key')).status).toBe(503);
  });
  it('rejects malformed identifiers, duplicate query values, limits and cursors before storage reads', async () => {
    for (const query of ['', 'clientId=not-a-uuid', `clientId=%20${A}`, `clientId=${A}&clientId=${B}`, `clientId=${A}&limit=0`, `clientId=${A}&limit=101`, `clientId=${A}&limit=1e1`, `clientId=${A}&limit=1.0`, `clientId=${A}&cursor=`, `clientId=${A}&cursor=bad`]) {
      expect((await authGet(`/observations?${query}`)).status, query).toBe(400);
    }
    expect(db.clientCall.findMany).not.toHaveBeenCalled();
    expect(db.client.findFirst).not.toHaveBeenCalled();
  });
  it('returns allowlisted observations, authentic country/niche, no PII, no invented metrics or attribution', async () => {
    const res = await authGet(`/observations?clientId=${A}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.coverage).toBe('creation_only');
    const item = res.body.items[0];
    expect(item).toMatchObject({ callRef: C1, clientRef: A, country: 'BE', niche: 'restaurant', language: 'fr', hasTranscript: true, observedAt: null, metrics: { tours: 4, total_p50: 450 }, release_refs: { backend: null, worker: null } });
    expect(item.metrics).not.toHaveProperty('caller_turns');
    expect(item.metrics).not.toHaveProperty('total_p95');
    expect(item.mortem.codes).toEqual(['slow_turns']);
    expect(JSON.stringify(res.body)).not.toContain('secret-');
    expect(db.clientCall.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ clientId: A }), take: 51 }));
  });
  it('paginates tied timestamps and rejects cross-tenant and modified cursors', async () => {
    db.clientCall.findMany.mockResolvedValueOnce([call(), call(C2)]).mockResolvedValueOnce([call(C2)]);
    const first = await authGet(`/observations?clientId=${A}&limit=1`);
    expect(first.status).toBe(200);
    expect(first.body.hasMore).toBe(true);
    const cursor = encodeURIComponent(first.body.nextCursor);
    const second = await authGet(`/observations?clientId=${A}&limit=1&cursor=${cursor}`);
    expect(second.body.items.map((item: {callRef: string}) => item.callRef)).toEqual([C2]);
    expect(second.body.watermark).toBe(first.body.watermark);
    expect(second.body.hasMore).toBe(false);
    expect(second.body.nextCursor).toBeNull();
    expect((await authGet(`/observations?clientId=${B}&cursor=${cursor}`)).status).toBe(400);
    expect((await authGet(`/observations?clientId=${A}&cursor=${cursor}a`)).status).toBe(400);
  });
  it('scopes individual lookups to an explicit validated tenant', async () => {
    db.clientCall.findFirst.mockImplementation(async ({ where }) => where.clientId === A ? call() : null);
    const res = await authGet(`/observations/${C1}?clientId=${A}`);
    expect(res.status).toBe(200);
    expect((await authGet(`/observations/${C1}?clientId=${B}`)).status).toBe(404);
    expect((await authGet(`/observations/${C1}`)).status).toBe(400);
    expect((await authGet(`/observations/nope?clientId=${A}`)).status).toBe(400);
  });
  it('isolates tenant scans, includes spam/in-progress calls, and honestly misses late updates behind the cursor', async () => {
    const rows = [call(), { ...call(C2), status: 'in-progress', isSpam: true, transcript: '' }, call('cccccccc-cccc-4ccc-8ccc-cccccccccccc', B)];
    // The fake implements the Prisma keyset predicates over mutable retained rows.
    db.clientCall.findMany.mockImplementation(async ({ where, take }) => rows.filter(row =>
      row.clientId === where.clientId && row.createdAt <= where.createdAt.lte &&
      (!where.OR || row.createdAt > where.OR[0].createdAt.gt ||
        (row.createdAt.getTime() === where.OR[1].createdAt.getTime() && row.id > where.OR[1].id.gt)),
    ).slice(0, take));
    db.clientCall.findFirst.mockImplementation(async ({ where }) => rows.find(row => row.id === where.id && row.clientId === where.clientId) ?? null);
    const first = await authGet(`/observations?clientId=${A}&limit=1`);
    expect(first.body.items[0].metrics.total_p50).toBe(450);
    rows[0].metadata.latency.total_p50 = 999; // late analysis changes no creation timestamp
    const next = await authGet(`/observations?clientId=${A}&limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`);
    expect(next.status).toBe(200);
    expect(next.body.coverage).toBe('creation_only');
    expect(next.body.items.map((item: {callRef: string}) => item.callRef)).toEqual([C2]);
    expect(next.body.items[0]).toMatchObject({ status: 'in-progress', isSpam: true, hasTranscript: false });
    expect(next.body.hasMore).toBe(false);
    const tenantB = await authGet(`/observations?clientId=${B}`);
    expect(tenantB.body.items.map((item: {clientRef: string}) => item.clientRef)).toEqual([B]);
    const refreshed = await authGet(`/observations/${C1}?clientId=${A}`);
    expect(refreshed.body.metrics.total_p50).toBe(999);
    const rescan = await authGet(`/observations?clientId=${A}`);
    expect(rescan.body.items[0].metrics.total_p50).toBe(999);
  });
  it('distinguishes an unknown client from an existing empty client', async () => {
    db.client.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: A });
    expect((await authGet(`/observations?clientId=${B}`)).status).toBe(404);
    db.clientCall.findMany.mockResolvedValueOnce([]);
    const empty = await authGet(`/observations?clientId=${A}`);
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ items: [], nextCursor: null, hasMore: false });
    expect(db.learningPattern.findMany).not.toHaveBeenCalled();
  });
  it('lists only bounded non-PII client fields and paginates independently', async () => {
    const rows = [ { id: A, ...client, contactName: 'secret-name' }, { id: B, ...client } ];
    db.client.findMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([rows[1]]);
    const first = await authGet('/clients?limit=1');
    expect(first.status).toBe(200);
    expect(first.body.items).toEqual([{ id: A, niche: 'restaurant', country: 'BE', language: 'fr' }]);
    expect(first.body.hasMore).toBe(true);
    const cursor = encodeURIComponent(first.body.nextCursor);
    const second = await authGet(`/clients?limit=1&cursor=${cursor}`);
    expect(second.body.items[0].id).toBe(B);
    expect(second.body.hasMore).toBe(false);
    expect((await authGet(`/observations?clientId=${A}&cursor=${cursor}`)).status).toBe(400);
    expect((await authGet('/clients?limit=101')).status).toBe(400);
    expect(db.client.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ take: 2, select: { id: true, businessType: true, country: true, agentLanguage: true } }));
  });
  it('returns sanitized errors rather than database messages', async () => {
    db.clientCall.findMany.mockRejectedValue(new Error('secret-database-url'));
    const res = await authGet(`/observations?clientId=${A}`);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret-');
  });
  it('does not grant the read key write access and preserves existing pattern handlers', async () => {
    // Exercise the real legacy middleware; only its network notification dependency is mocked.
    expect(typeof requireAutofixToken).toBe('function');
    expect((await request(app).post(`/api/learning/patterns/${C1}/status`).set('X-Learning-Read-Token', 'read-test-key').send({ status: 'merged' })).status).toBe(401);
    const patterns = await request(app).get('/api/learning/patterns').set('X-Autofix-Token', 'owner-test-key');
    expect(patterns.status).toBe(200);
    expect(patterns.body).toEqual({ patterns: [] });
    expect(db.learningPattern.update).not.toHaveBeenCalled();
    expect(db.clientCall.update).not.toHaveBeenCalled();
    expect(db.clientCall.create).not.toHaveBeenCalled();
    expect(db.clientCall.deleteMany).not.toHaveBeenCalled();
  });
});
