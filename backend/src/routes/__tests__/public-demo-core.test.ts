import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { TokenVerifier } from 'livekit-server-sdk';
import router from '../public-demo.routes';
import { env } from '../../config/env';
import { CHARACTERS } from '../../config/voice-characters';
const quota = vi.hoisted(() => vi.fn(() => 120));
vi.mock('../../services/demo-quota.service', () => ({ reserveDemoSeconds: quota, DEMO_DAILY_SECONDS: 120 }));
vi.mock('../../config/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const original = { ...env };
afterEach(() => { Object.assign(env, original); quota.mockReturnValue(120); });
function app() { const a = express(); a.use(express.json()); a.use('/public', router); return a; }
function configure() { Object.assign(env, { VOICE_RUNTIME: 'core', LIVEKIT_URL: 'wss://unit.test', LIVEKIT_API_KEY: 'unit', LIVEKIT_API_SECRET: 'synthetic-signing-secret-1234567890' }); }
const characterId = Object.keys(CHARACTERS)[0];
describe('public demo core transport', () => {
 it('ignores browser rollback and tenant choices and issues a verifiable restricted token', async () => {
  configure(); const r = await request(app()).post('/public/demo/live-config?transport=vapi').send({ characterId, transport: 'vapi', clientId: 'attacker-tenant' });
  expect(r.status).toBe(200); expect(r.body.provider).toBe('livekit');
  const c: any = await new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET).verify(r.body.token);
  expect(c.video.canPublishSources).toEqual(['microphone']); expect(c.video.canPublishData).toBe(false);
  expect(JSON.parse(c.roomConfig.agents[0].metadata).qwillioWeb.profile.clientId).toBe('');
 });
 it('fails closed without LiveKit even when legacy Vapi is available', async () => {
  configure(); env.LIVEKIT_URL = ''; env.VAPI_PUBLIC_KEY = 'legacy';
  const r = await request(app()).post('/public/demo/live-config').send({ characterId });
  expect(r.status).toBe(503); expect(r.body.token).toBeUndefined(); expect(r.body.publicKey).toBeUndefined();
 });
 it('preserves exhausted daily quota errors', async () => {
  configure(); quota.mockReturnValue(0);
  const r = await request(app()).post('/public/demo/live-config').send({ characterId });
  expect(r.status).toBe(429); expect(r.body.error).toBe('demo_daily_quota');
 });
});
