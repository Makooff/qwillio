import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export interface SetupSessionIdentity {
  sessionId: string;
  clientId: string;
  mode: 'config' | 'onboarding';
}
const AUDIENCE = 'qwillio-web-setup';
const ISSUER = 'qwillio-bridge';
function signingKey(): string {
  // Never turn a missing deployment secret into a publicly forgeable capability.
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || env.JWT_SECRET === 'change-me-in-production') {
    throw new Error('web_setup_not_configured');
  }
  return env.JWT_SECRET;
}

/** Opaque capability: the worker can use it, but has no server signing key. */
export function issueSetupTicket(identity: SetupSessionIdentity): string {
  return jwt.sign({ sessionId: identity.sessionId, mode: identity.mode }, signingKey(), {
    algorithm: 'HS256', audience: AUDIENCE, issuer: ISSUER,
    subject: identity.clientId, expiresIn: 180,
  });
}

export function verifySetupTicket(ticket: string, expected: SetupSessionIdentity): SetupSessionIdentity {
  const decoded = jwt.verify(ticket, signingKey(), {
    algorithms: ['HS256'], audience: AUDIENCE, issuer: ISSUER,
    subject: expected.clientId, maxAge: 180,
  });
  if (typeof decoded === 'string' || decoded.sessionId !== expected.sessionId || decoded.mode !== expected.mode) {
    throw new Error('invalid_setup_ticket');
  }
  return expected;
}
