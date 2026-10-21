import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import twilio from 'twilio';
const { config } = vi.hoisted(() => ({ config: { NODE_ENV: 'production', TWILIO_VALIDATE_WEBHOOKS: false, TWILIO_AUTH_TOKEN: 'fixture-twilio-token' } }));
vi.mock('../../config/env', () => ({ env: config }));
vi.mock('../../config/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
import { validateTwilioSignature } from '../twilio.middleware';
const body = { From: '+32470000000', Body: 'test' };
const url = 'https://callbacks.example/api/webhooks/twilio/sms?source=test';
function app() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.post('/api/webhooks/twilio/sms', validateTwilioSignature, (_req, res) => res.sendStatus(204));
  return app;
}
function send(signature?: string) {
  const req = request(app()).post('/api/webhooks/twilio/sms?source=test')
    .set('X-Forwarded-Proto', 'https, http').set('X-Forwarded-Host', 'callbacks.example').type('form');
  if (signature) req.set('X-Twilio-Signature', signature);
  return req.send(body);
}
beforeEach(() => Object.assign(config, { NODE_ENV: 'production', TWILIO_VALIDATE_WEBHOOKS: false, TWILIO_AUTH_TOKEN: 'fixture-twilio-token' }));
describe('Twilio signature boundary', () => {
  it('rejects a missing signature in production even with flag false', async () => expect((await send()).status).toBe(403));
  it('rejects an invalid signature', async () => expect((await send('forged')).status).toBe(403));
  it('accepts a real SDK signature with forwarded public URL and query intact', async () => {
    expect((await send(twilio.getExpectedTwilioSignature(config.TWILIO_AUTH_TOKEN, url, body))).status).toBe(204);
  });
  it('returns 503 when production credentials are missing', async () => {
    config.TWILIO_AUTH_TOKEN = '';
    expect((await send()).status).toBe(503);
  });
  it('allows explicit local development bypass', async () => {
    config.NODE_ENV = 'development'; config.TWILIO_AUTH_TOKEN = '';
    expect((await send()).status).toBe(204);
  });
  it('fails closed when development verification is opted in without credentials', async () => {
    config.NODE_ENV = 'development'; config.TWILIO_VALIDATE_WEBHOOKS = true; config.TWILIO_AUTH_TOKEN = '';
    expect((await send()).status).toBe(503);
  });
  it('verifies development requests when opted in', async () => {
    config.NODE_ENV = 'development'; config.TWILIO_VALIDATE_WEBHOOKS = true;
    expect((await send('forged')).status).toBe(403);
  });
});
