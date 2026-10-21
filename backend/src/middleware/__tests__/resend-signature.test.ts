import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import express from 'express';
import request from 'supertest';
const { config } = vi.hoisted(() => ({ config: { RESEND_WEBHOOK_SECRET: '' } }));
vi.mock('../../config/env', () => ({ env: config }));
import { createResendSignatureValidator, resendRawBody } from '../resend.middleware';
const key = Buffer.from('fixture-only-resend-signing-key-32');
const secret = `whsec_${key.toString('base64')}`;
const raw = '{ "type": "email.bounced", "data": {"to":["fixture@example.invalid"],"note":"é"} }\n';
function headers(payload = raw, id = 'msg_fixture', timestamp = String(Math.floor(Date.now() / 1000))) {
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.`).update(Buffer.from(payload)).digest('base64')}` };
}
function build(options = {}) {
  const app = express();
  const handler = vi.fn((req, res) => res.json({ received: true, type: req.body.type }));
  app.use('/events', resendRawBody);
  app.use(express.json());
  app.post('/events', createResendSignatureValidator(options), handler);
  return { app, handler };
}
function send(app: express.Express, h = headers(), payload = raw) {
  return request(app).post('/events').set('Content-Type', 'application/json').set(h).send(payload);
}
beforeEach(() => { config.RESEND_WEBHOOK_SECRET = secret; });
describe('Resend signature boundary', () => {
  it('verifies exact raw bytes including whitespace and unicode then exposes parsed JSON', async () => {
    const { app, handler } = build();
    expect((await send(app)).body).toEqual({ received: true, type: 'email.bounced' });
    expect(handler).toHaveBeenCalledOnce();
  });
  it.each(['svix-id', 'svix-timestamp', 'svix-signature'])('rejects missing %s without handler effects', async name => {
    const { app, handler } = build(); const h = headers(); delete h[name as keyof typeof h];
    expect((await send(app, h)).status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it('rejects forged signatures', async () => {
    const { app, handler } = build();
    expect((await send(app, { ...headers(), 'svix-signature': 'v1,Zm9yZ2Vk' })).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it('rejects changed bytes even when the JSON is semantically identical', async () => {
    const { app } = build(); expect((await send(app, headers(), JSON.stringify(JSON.parse(raw)))).status).toBe(403);
  });
  it.each([-301, 301])('rejects signatures outside replay window (%s seconds)', async delta => {
    const { app } = build(); const timestamp = String(Math.floor(Date.now() / 1000) + delta);
    expect((await send(app, headers(raw, 'msg_fixture', timestamp))).status).toBe(403);
  });
  it('rejects malformed timestamp', async () => {
    const { app } = build(); expect((await send(app, headers(raw, 'msg_fixture', 'NaN'))).status).toBe(403);
  });
  it.each(['', 'whsec_!!!'])('fails closed on absent or malformed configuration', async value => {
    config.RESEND_WEBHOOK_SECRET = value; const { app, handler } = build();
    expect((await send(app)).status).toBe(503); expect(handler).not.toHaveBeenCalled();
  });
  it('accepts any valid v1 signature during key rotation', async () => {
    const { app } = build(); const h = headers(); h['svix-signature'] = `v2,ignored v1,invalid ${h['svix-signature']}`;
    expect((await send(app, h)).status).toBe(200);
  });
  it('rejects a signed non-object JSON payload', async () => {
    const { app, handler } = build(); expect((await send(app, headers('null'), 'null')).status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
  it('fails closed if raw-body parser is missing', async () => {
    const app = express(); app.use(express.json()); app.post('/events', createResendSignatureValidator(), (_req, res) => res.sendStatus(200));
    expect((await send(app)).status).toBe(400);
  });
  it('acknowledges a completed duplicate without processing it again', async () => {
    const { app, handler } = build(); await send(app); expect((await send(app)).status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
  it('does not let invalid signatures use a cached event id', async () => {
    const { app } = build(); await send(app);
    expect((await send(app, { ...headers(), 'svix-signature': 'v1,forged' })).status).toBe(403);
  });
  it('allows retries after downstream failure', async () => {
    const app = express(); let attempts = 0; app.use(resendRawBody);
    app.post('/events', createResendSignatureValidator(), (_req, res) => res.sendStatus(++attempts === 1 ? 500 : 200));
    expect((await send(app)).status).toBe(500); expect((await send(app)).status).toBe(200); expect(attempts).toBe(2);
  });
  it('fails closed at cache capacity instead of forgetting processed ids', async () => {
    const { app, handler } = build({ maxEntries: 1 }); await send(app);
    expect((await send(app, headers(raw, 'msg_other'))).status).toBe(503); expect(handler).toHaveBeenCalledOnce();
  });
});
