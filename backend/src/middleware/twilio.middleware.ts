import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

// twilio ships CommonJS; match the require() style used elsewhere in the codebase
// eslint-disable-next-line @typescript-eslint/no-var-requires
const twilio = require('twilio');

/**
 * Verifies the `X-Twilio-Signature` header on inbound Twilio webhooks.
 *
 * No-op unless BOTH `TWILIO_VALIDATE_WEBHOOKS=true` and `TWILIO_AUTH_TOKEN` are
 * set, so enabling enforcement is an explicit opt-in once the public callback
 * URL is confirmed on Render. This keeps existing behavior unchanged on deploy.
 */
export function validateTwilioSignature(req: Request, res: Response, next: NextFunction) {
  if (!env.TWILIO_VALIDATE_WEBHOOKS || !env.TWILIO_AUTH_TOKEN) {
    return next();
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined;

  // Reconstruct the exact public URL Twilio signed. Behind Render's proxy the
  // forwarded headers carry the original scheme/host.
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.get('host');
  const url = `${proto}://${host}${req.originalUrl}`;

  const isValid = !!signature && twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body || {},
  );

  if (!isValid) {
    logger.warn(`Twilio webhook signature invalid for ${req.originalUrl}`);
    // Reply with empty TwiML so Twilio doesn't retry indefinitely.
    return res.status(403).type('text/xml').send('<Response></Response>');
  }

  next();
}
