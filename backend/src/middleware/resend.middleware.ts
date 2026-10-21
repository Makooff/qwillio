import express, { RequestHandler } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

export const resendRawBody = express.raw({ type: 'application/json', limit: '1mb' });

/** Official algorithm: https://docs.svix.com/receiving/verifying-payloads/how-manual
 * Resend v4 installed here has no webhooks.verify. Verify raw bytes in ALL environments.
 * Dedup is bounded and PROCESS-LOCAL, not durable exactly-once across restarts/instances.
 * Successful ids retained 24h; concurrent retries receive 503; failures release the id.
 */
export function createResendSignatureValidator(options: { maxEntries?: number } = {}): RequestHandler {
  const entries = new Map<string, { completed: boolean; expires: number }>();
  const maxEntries = options.maxEntries ?? 10_000;
  return (req, res, next) => {
    const secret = env.RESEND_WEBHOOK_SECRET;
    const encoded = secret?.startsWith('whsec_') ? secret.slice(6) : '';
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || !Buffer.from(encoded, 'base64').length) {
      res.status(503).json({ error: 'Webhook verification unavailable' }); return;
    }
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'Raw webhook body required' }); return;
    }
    const id = req.headers['svix-id'];
    const timestamp = req.headers['svix-timestamp'];
    const signature = req.headers['svix-signature'];
    const now = Date.now();
    if (typeof id !== 'string' || !id || id.length > 256 ||
        typeof timestamp !== 'string' || !/^\d+$/.test(timestamp) ||
        !Number.isSafeInteger(Number(timestamp)) || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300 ||
        typeof signature !== 'string') {
      res.status(403).json({ error: 'Invalid webhook signature' }); return;
    }
    const expected = createHmac('sha256', Buffer.from(encoded, 'base64'))
      .update(`${id}.${timestamp}.`).update(req.body).digest();
    const valid = signature.split(' ').some(part => {
      const [version, value] = part.split(',');
      if (version !== 'v1' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
      const supplied = Buffer.from(value, 'base64');
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
    if (!valid) { res.status(403).json({ error: 'Invalid webhook signature' }); return; }
    let event: unknown;
    try { event = JSON.parse(req.body.toString('utf8')); }
    catch { res.status(400).json({ error: 'Invalid webhook payload' }); return; }
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        typeof (event as { type?: unknown }).type !== 'string') {
      res.status(400).json({ error: 'Invalid webhook payload' }); return;
    }
    for (const [key, entry] of entries) {
      if (entry.completed && entry.expires <= now) entries.delete(key);
    }
    const previous = entries.get(id);
    if (previous) {
      if (previous.completed) res.json({ received: true });
      else res.status(503).json({ error: 'Webhook processing in progress' });
      return;
    }
    if (entries.size >= maxEntries) {
      res.status(503).json({ error: 'Webhook processing capacity reached' }); return;
    }
    const entry = { completed: false, expires: now + 24 * 60 * 60 * 1000 };
    entries.set(id, entry);
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) entry.completed = true;
      else entries.delete(id);
    });
    res.once('close', () => { if (!res.writableFinished) entries.delete(id); });
    req.body = event;
    next();
  };
}
export const validateResendSignature = createResendSignatureValidator();
