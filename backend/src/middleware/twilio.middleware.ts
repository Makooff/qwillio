import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

// twilio ships CommonJS; match the require() style used elsewhere in the codebase

const twilio = require('twilio');

/**
 * Verifies the `X-Twilio-Signature` header on inbound Twilio webhooks.
 *
 * Production always verifies, regardless of TWILIO_VALIDATE_WEBHOOKS.
 * Development/test bypass only when the flag is false; set it true to exercise
 * real signatures locally. Missing credentials under enforcement return 503.
 */
export function validateTwilioSignature(req: Request, res: Response, next: NextFunction) {
  if (env.NODE_ENV !== 'production' && !env.TWILIO_VALIDATE_WEBHOOKS) {
    return next();
  }
  if (!env.TWILIO_AUTH_TOKEN) {
    return res.status(503).json({ error: 'Webhook verification unavailable' });
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
