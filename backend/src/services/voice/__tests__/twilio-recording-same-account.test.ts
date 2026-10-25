import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RequestClient from 'twilio/lib/base/RequestClient';

const h = vi.hoisted(() => ({
  env: {
    TWILIO_ACCOUNT_SID: 'AC' + '9'.repeat(32), TWILIO_AUTH_TOKEN: 'test-account-token',
    TWILIO_TRUNK_REGION: 'ie1', TWILIO_TRUNK_EDGE: 'dublin',
    TWILIO_TRUNK_KEY_SID: 'SK' + '1'.repeat(32), TWILIO_TRUNK_KEY_SECRET: 'test-regional-secret',
  },
  findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
  memoryFindUnique: vi.fn(), memoryDelete: vi.fn(),
}));
vi.mock('../../../config/env', () => ({ env: h.env }));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../../config/database', () => ({ prisma: {
  client: { findMany: vi.fn(async () => [{ id: 'tenant', retentionDays: 90 }]) },
  clientCall: { findMany: h.findMany, update: h.update, updateMany: h.updateMany },
  callerMemory: { findUnique: h.memoryFindUnique, deleteMany: h.memoryDelete, updateMany: vi.fn(async () => ({ count: 0 })) },
  call: { updateMany: vi.fn(async () => ({ count: 0 })) },
  prospect: { updateMany: vi.fn(async () => ({ count: 0 })) },
} }));

import { twilioRecordingService, enteteAuthTwilio, sidDepuisUrl } from '../twilio-recording.service';
import { dataRetentionService } from '../../data-retention.service';

const CA = 'CA' + 'a'.repeat(32);
const RE = 'RE' + 'b'.repeat(32);
const path = `/2010-04-01/Accounts/${h.env.TWILIO_ACCOUNT_SID}/Recordings/${RE}`;
const url = (host = 'api.dublin.ie1.twilio.com') => `https://${host}${path}.mp3`;
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
const response = (body: unknown, statusCode = 200) => ({ statusCode, body: JSON.stringify(body), headers: {} });
let transport: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.env, { TWILIO_TRUNK_REGION: 'ie1', TWILIO_TRUNK_EDGE: 'dublin', TWILIO_TRUNK_KEY_SECRET: 'test-regional-secret' });
  transport = vi.spyOn(RequestClient.prototype, 'request').mockResolvedValue(response({ sid: RE }));
  h.findMany.mockResolvedValue([]);
  h.update.mockResolvedValue({});
  h.updateMany.mockResolvedValue({ count: 0 });
  h.memoryFindUnique.mockResolvedValue(null);
  h.memoryDelete.mockResolvedValue({ count: 0 });
});
afterEach(() => vi.restoreAllMocks());

// Real imported service + real Twilio SDK. Only the network boundary is stubbed.
describe('recordings use the processing region, not the US account default', () => {
  it('starts exactly once with the regional host/key and unchanged per-call options', async () => {
    await expect(twilioRecordingService.demarrer(CA)).resolves.toBe(RE);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      method: 'post', uri: `https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/${h.env.TWILIO_ACCOUNT_SID}/Calls/${CA}/Recordings.json`,
      username: h.env.TWILIO_TRUNK_KEY_SID, password: h.env.TWILIO_TRUNK_KEY_SECRET,
      data: { RecordingChannels: 'dual', Trim: 'do-not-trim' },
    }));
  });

  it('looks up completed audio in that same region and persists its media host', async () => {
    transport.mockResolvedValue(response({ recordings: [{ sid: RE, status: 'completed', uri: `${path}.json` }], next_page_uri: null }));
    await expect(twilioRecordingService.delAppel(CA)).resolves.toEqual({ sid: RE, url: url() });
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get', uri: `https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/${h.env.TWILIO_ACCOUNT_SID}/Recordings.json`,
      username: h.env.TWILIO_TRUNK_KEY_SID, password: h.env.TWILIO_TRUNK_KEY_SECRET,
      params: expect.objectContaining({ CallSid: CA }),
    }));
  });

  it('keeps unconfigured region on the US account client', async () => {
    h.env.TWILIO_TRUNK_REGION = ''; h.env.TWILIO_TRUNK_EDGE = '';
    await expect(twilioRecordingService.demarrer(CA)).resolves.toBe(RE);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      uri: expect.stringContaining('https://api.twilio.com/'), username: h.env.TWILIO_ACCOUNT_SID, password: h.env.TWILIO_AUTH_TOKEN,
    }));
  });

  it('does not retry a timed-out POST on any host', async () => {
    transport.mockRejectedValue(new Error('ETIMEDOUT'));
    await expect(twilioRecordingService.demarrer(CA)).resolves.toBeNull();
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each(['TWILIO_TRUNK_KEY_SECRET', 'TWILIO_TRUNK_EDGE'] as const)('fails closed with missing %s', async field => {
    const original = h.env[field]; h.env[field] = '';
    try {
      await expect(twilioRecordingService.demarrer(CA)).resolves.toBeNull();
      expect(transport).not.toHaveBeenCalled();
    } finally { h.env[field] = original; }
  });
});

describe('media credentials belong to the persisted URL region', () => {
  it('uses the IE1 key even when account credentials also exist', () => {
    expect(enteteAuthTwilio(url())).toBe(basic(h.env.TWILIO_TRUNK_KEY_SID, h.env.TWILIO_TRUNK_KEY_SECRET));
  });
  it('uses account auth for historical US audio even when current calls use IE1', () => {
    expect(enteteAuthTwilio(url('api.twilio.com'))).toBe(basic(h.env.TWILIO_ACCOUNT_SID, h.env.TWILIO_AUTH_TOKEN));
  });
  it('never falls back to US credentials on IE1', () => {
    h.env.TWILIO_TRUNK_KEY_SECRET = '';
    expect(enteteAuthTwilio(url())).toBeNull();
  });
  it.each([
    'api.evil.twilio.com', 'api.dublin.ie1.twilio.com.evil.example', 'api.sydney.au1.twilio.com',
  ])('does not authorize unknown/unconfigured host %s', host => {
    expect(enteteAuthTwilio(url(host))).toBeNull();
  });
  it.each([
    'http://api.dublin.ie1.twilio.com', 'https://api.dublin.ie1.twilio.com:444',
    'https://user:password@api.dublin.ie1.twilio.com', 'https://evil.example',
  ])('does not authorize unsafe origin %s', origin => {
    expect(enteteAuthTwilio(`${origin}${path}.mp3`)).toBeNull();
  });
  it('does not authorize a different account', () => {
    expect(enteteAuthTwilio(url().replace(h.env.TWILIO_ACCOUNT_SID, 'AC' + '0'.repeat(32)))).toBeNull();
  });
  it('does not recognize recording SID prefixes as valid paths', () => {
    expect(sidDepuisUrl(url() + 'evil')).toBeNull();
  });
});

describe('real retention service preserves region for remote deletion', () => {
  it.each(['api.dublin.ie1.twilio.com', 'api.twilio.com'])('deletes %s audio before local erasure', async host => {
    h.findMany.mockResolvedValue([{ id: 'old-call', recordingUrl: url(host), vapiCallId: 'livekit-room' }]);
    transport.mockResolvedValue(response({}, 204));
    const report = await dataRetentionService.purgeExpiredCallData();
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      method: 'delete', uri: `https://${host}${path}.json`,
      username: host === 'api.twilio.com' ? h.env.TWILIO_ACCOUNT_SID : h.env.TWILIO_TRUNK_KEY_SID,
      password: host === 'api.twilio.com' ? h.env.TWILIO_AUTH_TOKEN : h.env.TWILIO_TRUNK_KEY_SECRET,
    }));
    expect(report.vapiDeletionFailures).toBe(0);
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'old-call' }, data: expect.objectContaining({ recordingUrl: null }) }));
    expect(transport.mock.invocationCallOrder[0]).toBeLessThan(h.update.mock.invocationCallOrder[0]);
  });
  it('erasure-on-request preserves a failed remote recording for retry', async () => {
    h.env.TWILIO_TRUNK_KEY_SECRET = '';
    h.findMany.mockResolvedValue([{ id: 'old-call', recordingUrl: url(), vapiCallId: 'livekit-room' }]);
    await expect(dataRetentionService.eraseCaller('tenant', 'caller')).rejects.toThrow();
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it('Twilio purge also selects recordings with no Vapi/LiveKit identifier', async () => {
    await dataRetentionService.purgeExpiredCallData();
    expect(h.findMany.mock.calls[0][0].where.vapiCallId).toBeUndefined();
    const localOnly = h.updateMany.mock.calls[0][0].where.AND[1].OR;
    expect(localOnly).not.toContainEqual({ recordingUrl: { not: null }, vapiCallId: null });
  });

  it('does not erase the local URL when regional credentials are missing', async () => {
    h.env.TWILIO_TRUNK_KEY_SECRET = '';
    h.findMany.mockResolvedValue([{ id: 'old-call', recordingUrl: url(), vapiCallId: 'livekit-room' }]);
    const report = await dataRetentionService.purgeExpiredCallData();
    expect(report.vapiDeletionFailures).toBe(1);
    expect(transport).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });
});
