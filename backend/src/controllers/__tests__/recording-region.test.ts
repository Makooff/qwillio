import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ findFirst: vi.fn(), recordingUrl: vi.fn(), getCall: vi.fn() }));
vi.mock('../../config/database', () => ({ prisma: { clientCall: { findFirst: h.findFirst } } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../config/vapi', () => ({ vapiClient: { recordingUrl: h.recordingUrl, getCall: h.getCall } }));

import { env } from '../../config/env';
import { clientDashboardController } from '../client-dashboard.controller';

const original = { ...env };
const AC = 'AC' + '9'.repeat(32);
const RE = 'RE' + 'b'.repeat(32);
const mediaUrl = (host = 'api.dublin.ie1.twilio.com') => `https://${host}/2010-04-01/Accounts/${AC}/Recordings/${RE}.mp3`;
let fetchMock: ReturnType<typeof vi.spyOn>;
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
function response() {
  const res: any = { statusCode: 200, headers: {} };
  res.status = (status: number) => { res.statusCode = status; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  res.setHeader = (key: string, value: string) => { res.headers[key] = value; return res; };
  res.end = vi.fn();
  return res;
}
async function playback(url = mediaUrl()) {
  h.findFirst.mockResolvedValue({ recordingUrl: url, vapiCallId: 'livekit-room' });
  const res = response();
  await clientDashboardController.getMyCallRecording({ params: { id: 'call' }, clientId: 'tenant', headers: { range: 'bytes=0-99' } }, res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(env, { TWILIO_ACCOUNT_SID: AC, TWILIO_AUTH_TOKEN: 'test-account-token',
    TWILIO_TRUNK_REGION: 'ie1', TWILIO_TRUNK_EDGE: 'dublin',
    TWILIO_TRUNK_KEY_SID: 'SK' + '1'.repeat(32), TWILIO_TRUNK_KEY_SECRET: 'test-regional-secret' });
  fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
    status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-99/1000', 'accept-ranges': 'bytes' },
  }));
});
afterEach(() => { vi.restoreAllMocks(); Object.assign(env, original); });

describe('portal playback imports the real region-aware media/auth implementation', () => {
  it.each(['api.dublin.ie1.twilio.com', 'api.twilio.com'])('serves %s audio using its own credentials and Range', async host => {
    const res = await playback(mediaUrl(host));
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-99/1000');
    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(h.recordingUrl).not.toHaveBeenCalled();
    expect(h.getCall).not.toHaveBeenCalled();
    const [target, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(target).toBe(mediaUrl(host));
    expect(headers.get('Range')).toBe('bytes=0-99');
    expect(headers.get('Authorization')).toBe(host === 'api.twilio.com'
      ? basic(AC, env.TWILIO_AUTH_TOKEN) : basic(env.TWILIO_TRUNK_KEY_SID, env.TWILIO_TRUNK_KEY_SECRET));
    expect(options?.redirect).toBe('manual');
    expect(h.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'call', clientId: 'tenant' } }));
  });

  it('never forwards Twilio authorization to a media/CDN redirect', async () => {
    const cdn = 'https://cdn.example.test/audio.mp3?signature=test';
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: cdn } }));
    const res = await playback();
    expect(res.statusCode).toBe(206);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [target, options] = fetchMock.mock.calls[1];
    expect(target).toBe(cdn);
    expect(new Headers(options?.headers).get('Authorization')).toBeNull();
    expect(new Headers(options?.headers).get('Range')).toBe('bytes=0-99');
  });

  it('fails without sending US credentials when the IE1 key is missing', async () => {
    env.TWILIO_TRUNK_KEY_SECRET = '';
    const res = await playback();
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['api.evil.twilio.com', 'api.dublin.ie1.twilio.com.evil.example'])('does not authorize an untrusted stored host %s', async host => {
    h.recordingUrl.mockResolvedValue(null); h.getCall.mockResolvedValue({});
    await playback(mediaUrl(host));
    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options?.headers).get('Authorization')).toBeNull();
    }
  });

  it('does not fetch another tenant’s recording', async () => {
    h.findFirst.mockResolvedValue(null);
    const res = response();
    await clientDashboardController.getMyCallRecording({ params: { id: 'other' }, clientId: 'tenant', headers: {} }, res);
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
