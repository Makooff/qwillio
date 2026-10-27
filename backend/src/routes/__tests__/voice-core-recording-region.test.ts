import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RequestClient from 'twilio/lib/base/RequestClient';

const h = vi.hoisted(() => ({ getClientProfile: vi.fn(), upsert: vi.fn(), executeRaw: vi.fn() }));
vi.mock('../../config/database', () => ({ prisma: { clientCall: { upsert: h.upsert }, $executeRaw: h.executeRaw } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/voice/realtime-context.service', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/voice/realtime-context.service')>(),
  realtimeContextService: { getClientProfile: h.getClientProfile },
}));
vi.mock('../../services/client-call.service', () => ({ clientCallService: {} }));
vi.mock('../../services/voice/tool-runtime.service', () => ({ toolRuntimeService: {} }));
vi.mock('../../services/voice/caller-memory.service', () => ({ callerMemoryService: {} }));
vi.mock('../../services/voice/live-transcript.store', () => ({ liveTranscripts: { ouvrir: vi.fn() } }));

import { env } from '../../config/env';
import router from '../voice-core.routes';
const original = { ...env };
const CA = 'CA' + 'a'.repeat(32);
const RE = 'RE' + 'b'.repeat(32);
let transport: ReturnType<typeof vi.spyOn>;
const start = router.stack.find((layer: any) => layer.route?.path === '/calls/start').route.stack[0].handle;

beforeEach(() => {
  vi.clearAllMocks();
  h.upsert.mockResolvedValue({ id: 'call', metadata: {} });
  h.executeRaw.mockResolvedValue(1);
  Object.assign(env, { TWILIO_ACCOUNT_SID: 'AC' + '9'.repeat(32), TWILIO_AUTH_TOKEN: 'test-account-token',
    TWILIO_TRUNK_REGION: 'ie1', TWILIO_TRUNK_EDGE: 'dublin',
    TWILIO_TRUNK_KEY_SID: 'SK' + '1'.repeat(32), TWILIO_TRUNK_KEY_SECRET: 'test-regional-secret' });
  transport = vi.spyOn(RequestClient.prototype, 'request').mockResolvedValue({ statusCode: 201, body: JSON.stringify({ sid: RE }), headers: {} });
});
afterEach(() => { vi.restoreAllMocks(); Object.assign(env, original); });

async function callStart(recordCalls: boolean, twilioCallSid: string | null = CA, caller = '+32475123456') {
  h.getClientProfile.mockResolvedValue({ recordCalls });
  const res: any = {};
  res.status = vi.fn(() => res); res.json = vi.fn(() => res);
  await start({ body: { clientId: 'tenant', room: 'livekit-room', caller, trunkNumber: '+32470006690', twilioCallSid } }, res);
  await new Promise(resolve => setImmediate(resolve));
  return res;
}

describe('real /calls/start handler + shouldRecord + recording service + Twilio SDK', () => {
  it('recordCalls false never starts a recording', async () => {
    const res = await callStart(false);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(h.getClientProfile).toHaveBeenCalledWith('tenant');
    expect(transport).not.toHaveBeenCalled();
    expect(h.executeRaw).not.toHaveBeenCalled();
  });
  it('recordCalls true starts on IE1 using its key, and stores the returned SID', async () => {
    await callStart(true);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ method: 'post',
      uri: expect.stringContaining('https://api.dublin.ie1.twilio.com/'),
      username: env.TWILIO_TRUNK_KEY_SID, password: env.TWILIO_TRUNK_KEY_SECRET,
    }));
    expect(h.executeRaw).toHaveBeenCalledWith(expect.anything(), JSON.stringify({ recordingSid: RE }), 'call', 'tenant', 'livekit-room');
  });
  /* LiveKit ne remplit `sip.twilio.callSid` que s'il reconnaît le trunk comme
     Twilio. Quand l'attribut manque, le pont envoie `twilioCallSid: null` —
     avant ce correctif l'enregistrement n'existait alors tout simplement pas,
     alors que le prompt annonçait « cet appel est enregistré ». */
  it('sans SID du pont, retrouve l’appel en cours chez Twilio et démarre quand même', async () => {
    transport.mockResolvedValueOnce({ statusCode: 200, headers: {}, body: JSON.stringify({ calls: [{
      sid: CA, to: 'sip:+32470006690@livekit', status: 'in-progress', date_created: new Date().toUTCString(),
    }] }) });
    await callStart(true, null);
    expect(transport).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: 'get', uri: expect.stringContaining('/Calls.json'),
      params: expect.objectContaining({ Status: 'in-progress', From: '+32475123456' }),
    }));
    expect(transport).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'post', uri: expect.stringContaining(`${CA}/Recordings`),
    }));
    expect(h.executeRaw).toHaveBeenCalledWith(expect.anything(), JSON.stringify({ recordingSid: RE }), 'call', 'tenant', 'livekit-room');
  });
  it('sans SID et sans appel en cours, n’invente pas d’enregistrement', async () => {
    transport.mockResolvedValueOnce({ statusCode: 200, headers: {}, body: JSON.stringify({ calls: [] }) });
    await callStart(true, null);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(h.executeRaw).not.toHaveBeenCalled();
  });
});
