import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
// Intended contracts derived from independent QA probes. Real services/handlers;
// only database, model and external provider I/O are replaced.
const io = vi.hoisted(() => ({ db: {} as any, fetch: vi.fn() }));
vi.mock('../config/database', () => ({ prisma: io.db }));
vi.mock('../config/env', () => ({ env: { DEFAULT_TIMEZONE: 'Europe/Brussels' } }));
vi.mock('../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/spam-detection.service', () => ({ spamDetectionService: { classifyInboundCall: vi.fn(async () => ({ isSpam: false, score: 0, reasons: [] })) } }));
vi.mock('../services/discord.service', () => ({ discordService: { notify: vi.fn(async () => {}) } }));
vi.mock('../services/sms.service', () => ({ smsService: {} }));
vi.mock('../services/call-notification.service', () => ({ callNotificationService: { notify: vi.fn(async () => {}) } }));
vi.mock('../services/google-calendar.service', () => ({ googleCalendarService: {} }));
vi.mock('../services/voice/voice-completion-inbox.service', () => ({ voiceCompletionInbox: { enqueue: vi.fn(async () => ({ id: 'job-qa', already: false })), start: vi.fn(() => () => {}), runOne: vi.fn() } }));
vi.mock('../services/voice/lead-capture-store.service', () => ({ getPendingCaptureForRoom: vi.fn(async () => null), linkCaptureToCall: vi.fn(), persistCapture: vi.fn(), persistRoomCapture: vi.fn() }));
vi.mock('../services/voice/caller-memory.service', () => ({ callerMemoryService: { remember: vi.fn(async () => {}) } }));
vi.mock('../services/voice/realtime-context.service', () => ({ realtimeContextService: { getClientProfile: vi.fn(async () => ({ recordingEnabled: true })) }, shouldRecord: vi.fn(() => true) }));
vi.mock('../services/voice/twilio-recording.service', () => ({ twilioRecordingService: { demarrer: vi.fn(), delAppel: vi.fn(async () => null) } }));

let rows: any[], leads: any[], count: number;
const match = (r: any, w: any) => Object.entries(w).every(([k,v]) => r[k] === v);
const view = (r: any, select: any) => r ? structuredClone(select ? Object.fromEntries(Object.keys(select).map(k => [k,r[k]])) : r) : null;
const response = (summary = 'Winning analysis', callbackPromised = true) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ callerName: null, summary, sentiment: 'neutral', outcome: 'message_taken', bookingRequested: false, isLead: false, callbackPromised, tags: [] }) } }] }) });
const finish = (s: any) => s.handleClientCallCompleted('tenant', 'room', 'APPELANT: Bonjour, rappelez-moi.', 30, '32475123456');
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); rows = []; leads = []; count = 0;
  vi.stubGlobal('fetch', io.fetch); io.fetch.mockReset().mockResolvedValue(response());
  io.db.client = { findUnique: vi.fn(async () => ({ id: 'tenant', businessName: 'QA', country: 'BE', businessType: 'other', retentionDays: 90 })), update: vi.fn(async () => { count++; return {}; }) };
  io.db.clientCall = {
    create: vi.fn(async ({data}: any) => {
      if (rows.some(r => r.vapiCallId === data.vapiCallId)) throw Error('unique vapiCallId');
      const row = {id:'stable',...structuredClone(data)}; rows.push(row); return structuredClone(row);
    }),
    findUnique: vi.fn(async ({where,select}: any) => view(rows.find(r => match(r,where)),select)),
    upsert: vi.fn(async ({where,create,update}: any) => {
      let r = rows.find(r => match(r,where));
      if (r) Object.assign(r, structuredClone(Object.fromEntries(Object.entries(update).filter(([,v]) => v !== undefined))));
      else {
        if (rows.some(other => other.vapiCallId === create.vapiCallId)) throw Error('unique vapiCallId');
        r = {id:'stable',...structuredClone(create)}; rows.push(r);
      }
      return structuredClone(r);
    }),
    update: vi.fn(async ({where,data}:any) => { const r=rows.find(r=>match(r,where)); Object.assign(r,structuredClone(data)); return structuredClone(r); }),
    aggregate: vi.fn(async () => ({_sum:{durationSeconds:30}})),
  };
  io.db.clientBooking = { findFirst: vi.fn(async () => null) };
  io.db.callerMemory = { findUnique: vi.fn(async () => null) };
  io.db.contact = { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), create: vi.fn(async () => { throw Error('offline CRM'); }) };
  io.db.agentCrmActivity = {create:vi.fn(async ({data}:any)=> { leads.push(structuredClone(data)); return data; })};
  io.db.$queryRaw = vi.fn(async () => [{locked:1}]);
  io.db.$executeRaw = vi.fn(async () => 1);
  let queue=Promise.resolve();
  io.db.$transaction=vi.fn(async (fn:any)=> { const prev=queue; let release!:()=>void; queue=new Promise<void>(r=>release=r); await prev; try {return await fn(io.db);} finally {release();} });
});
afterEach(() => vi.unstubAllGlobals());
const service = async () => (await import('../services/client-call.service')).clientCallService;
const handler = async (path: string) => {
  const router = (await import('../routes/voice-core.routes')).default;
  return (router as any).stack.find((l:any) => l.route?.path === path && l.route.methods.post).route.stack[0].handle;
};
const resMock = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

describe('completion lifecycle review regressions', () => {
  it('handles closure failure with 500 and leaves the durable inbox recoverable on retry', async () => {
    const inbox = (await import('../services/voice/voice-completion-inbox.service')).voiceCompletionInbox;
    let durable: any = null;
    (inbox.enqueue as any).mockImplementation(async (payload: any) => {
      const already = !!durable;
      durable ??= { id: 'job-qa', status: 'pending', payload: structuredClone(payload) };
      return { id: durable.id, already };
    });
    io.db.agentCrmActivity.findFirst = vi.fn(async () => ({ status: durable.status }));
    io.db.clientCall.updateMany = vi.fn().mockRejectedValueOnce(Error('closure storage unavailable')).mockResolvedValue({ count: 1 });
    const handle = await handler('/calls');
    const req = { body: { room: 'room', clientId: 'tenant', transcript: 'QA', durationSeconds: 30 } };
    const res = resMock(), next = vi.fn();
    await expect(handle(req, res, next)).resolves.toBeDefined();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'record_failed' });
    expect(next).not.toHaveBeenCalled();
    expect(durable).toMatchObject({ id: 'job-qa', status: 'pending', payload: req.body });
    expect(inbox.runOne).not.toHaveBeenCalled();
    res.status.mockClear(); res.json.mockClear();
    await handle(req, res, next);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ room: 'room', pending: true });
    expect(inbox.enqueue).toHaveBeenCalledTimes(2);
    // Run the actual recovery processor registered before the closure failed.
    const processJob = (inbox.start as any).mock.calls[0][0];
    await processJob(durable.payload);
    expect(rows).toHaveLength(1);
    expect(count).toBe(1);
    expect(rows[0].metadata.completionLifecycle.completed).toBe(true);
  });
  it('rejects a foreign tenant collision without changing its stable row', async () => {
    const foreign = {id:'foreign',clientId:'other-tenant',vapiCallId:'room',status:'completed',transcript:'foreign secret',metadata:{privateMarker:true}};
    rows.push(structuredClone(foreign));
    await expect(finish(await service())).rejects.toThrow('unique vapiCallId');
    expect(rows).toEqual([foreign]); expect(count).toBe(0); expect(leads).toHaveLength(0);
  });
  it('retains recordingSid learned while model analysis is blocked', async () => {
    rows.push({id:'stable',clientId:'tenant',vapiCallId:'room',status:'ended',metadata:{live:true}});
    let release!: (v:any)=>void;
    io.fetch.mockImplementationOnce(() => new Promise(r=>release=r));
    const pending=finish(await service());
    await vi.waitFor(()=>expect(io.fetch).toHaveBeenCalledTimes(1));
    rows[0].metadata={...rows[0].metadata,recordingSid:'RE-concurrent'};
    release(response()); await pending;
    expect(rows[0].metadata.recordingSid).toBe('RE-concurrent');
    expect(rows[0].metadata.completionLifecycle.completed).toBe(true);
  });
  it.each(['ended', 'in-progress', 'absent'])('persists only the winning analysis for two initial %s completions', async status => {
    if (status !== 'absent') rows.push({id:'stable',clientId:'tenant',vapiCallId:'room',status,metadata:{}});
    const releases: Array<(v:any)=>void>=[];
    io.fetch.mockImplementation(() => new Promise(r=>releases.push(r)));
    const s=await service(); const one=finish(s); const two=finish(s);
    await vi.waitFor(()=>expect(releases).toHaveLength(2));
    expect(io.db.$transaction).not.toHaveBeenCalled(); // No DB lock over model I/O.
    releases[0](response()); await one;
    const committed = structuredClone(rows[0]);
    expect(count).toBe(1); expect(leads).toHaveLength(1);
    releases[1](response('LOSING analysis', false)); await two;
    expect(rows).toEqual([committed]);
    expect(io.db.clientCall.upsert.mock.calls.length + io.db.clientCall.create.mock.calls.length).toBe(1);
    expect(count).toBe(1); expect(leads).toHaveLength(1);
    expect(rows[0].metadata.completionLifecycle.completed).toBe(true);
  });
  it('routes a losing initial analysis to the pending winning journal after rollback', async () => {
    rows.push({id:'stable',clientId:'tenant',vapiCallId:'room',status:'ended',metadata:{recordingSid:'RE-keep'}});
    const releases: Array<(v:any)=>void> = [];
    io.fetch.mockImplementation(() => new Promise(r=>releases.push(r)));
    io.db.client.update.mockRejectedValueOnce(Error('counter unavailable'));
    const s=await service(), one=finish(s), two=finish(s);
    await vi.waitFor(()=>expect(releases).toHaveLength(2));
    const failure=expect(one).rejects.toThrow('counter unavailable');
    releases[0](response()); await failure;
    const winningJournal=structuredClone(rows[0].metadata.completionLifecycle);
    expect(winningJournal.completed).toBe(false);
    releases[1](response('LOSING analysis', false)); await two;
    expect(rows[0].metadata.completionLifecycle).toEqual({...winningJournal,completed:true});
    expect(rows[0].summary).toBe('Winning analysis');
    expect(rows[0].metadata.recordingSid).toBe('RE-keep');
    expect(io.db.clientCall.upsert).toHaveBeenCalledTimes(1);
    expect(count).toBe(1); expect(leads).toHaveLength(1);
  });
  it('never overwrites a delayed /start inserted after the absent-row read; retry converts its stable row', async () => {
    const create = io.db.clientCall.create.getMockImplementation();
    const placeholder={id:'late-start',clientId:'tenant',vapiCallId:'room',status:'in-progress',metadata:{recordingSid:'RE-late-start',live:true}};
    io.db.clientCall.create.mockImplementationOnce(async (args: any) => {
      rows.push(structuredClone(placeholder));
      return create(args); // Real unique constraint rejects the concurrent insert.
    });
    const s=await service();
    await expect(finish(s)).rejects.toThrow('unique vapiCallId');
    expect(rows).toEqual([placeholder]); expect(count).toBe(0); expect(leads).toHaveLength(0);
    await finish(s);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({id:'late-start',status:'completed',metadata:{recordingSid:'RE-late-start',completionLifecycle:{completed:true}}});
    expect(count).toBe(1); expect(leads).toHaveLength(1);
  });
  it('locks the current row before both journal initialization and resume read/replace', async () => {
    rows.push({id:'stable',clientId:'tenant',vapiCallId:'room',status:'ended',metadata:{}});
    const s=await service(); await finish(s);
    const lifecycleQuery = (call: any[]) => String(call[1]).startsWith('call-completion:') || call[0].join('?').includes('FOR UPDATE');
    const queries=io.db.$queryRaw.mock.calls.filter(lifecycleQuery);
    expect(queries).toHaveLength(4);
    for (const offset of [0,2]) {
      expect(queries[offset][0].join('?')).toContain('pg_advisory_xact_lock');
      expect(queries[offset][1]).toBe('call-completion:tenant:room');
      const [sql,room,tenant]=queries[offset+1];
      expect(sql.join('?')).toContain('FOR UPDATE');
      expect(sql.join('?')).toContain('client_id =');
      expect(room).toBe('room'); expect(tenant).toBe('tenant');
    }
    // Initial lookup is advisory only; the persistence-time reads are locked.
    const reads=io.db.clientCall.findUnique.mock.invocationCallOrder;
    const locks=io.db.$queryRaw.mock.invocationCallOrder.filter((_: number,index: number)=>lifecycleQuery(io.db.$queryRaw.mock.calls[index]));
    expect(locks[1]).toBeLessThan(reads[1]); expect(locks[3]).toBeLessThan(reads[2]);
    expect(io.db.$transaction.mock.calls.filter(([,opts]: any[])=>opts?.timeout===5000 && opts?.maxWait===2000)).toHaveLength(2);
  });
  it('late recording callback preserves current completion journal and final metadata', async () => {
    rows.push({id:'stable',clientId:'tenant',vapiCallId:'room',status:'in-progress',metadata:{live:true}});
    const recordings = (await import('../services/voice/twilio-recording.service')).twilioRecordingService;
    let release!: (sid: string) => void;
    (recordings.demarrer as any).mockImplementationOnce(() => new Promise(r => release=r));
    const handle = await handler('/calls/start');
    io.db.$executeRaw = vi.fn(async (sql: TemplateStringsArray, ...args: any[]) => {
      expect(sql.join('?')).toContain('jsonb_typeof(metadata)');
      expect(sql.join('?')).toContain('||');
      expect(sql.join('?')).toContain('client_id =');
      expect(args).toContain('tenant'); expect(args).toContain('stable'); expect(args).toContain('room');
      const patch = args.find(x => typeof x === 'string' && x.startsWith('{'));
      rows[0].metadata = { ...rows[0].metadata, ...JSON.parse(patch) };
      return 1;
    });
    const res = resMock();
    await handle({body:{clientId:'tenant',room:'room',twilioCallSid:'CA-delayed'}},res);
    await vi.waitFor(()=>expect(recordings.demarrer).toHaveBeenCalledTimes(1));
    expect(res.status).toHaveBeenCalledWith(201);
    await finish(await service());
    rows[0].metadata = {...rows[0].metadata,live:false,latency:{total:12},learningEvidence:{retained:true}};
    const committed=structuredClone(rows[0]);
    release('RE-late');
    await vi.waitFor(()=>expect(rows[0].metadata.recordingSid).toBe('RE-late'));
    expect(rows[0]).toEqual({...committed,metadata:{...committed.metadata,recordingSid:'RE-late'}});
    expect(count).toBe(1); expect(leads).toHaveLength(1);
  });
});
