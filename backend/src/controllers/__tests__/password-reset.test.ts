import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Security-critical: the password reset flow must not leak account existence,
 * must reject expired/invalid tokens, and must consume the token one-time.
 */
const { userFindUnique, userUpdate, sendPasswordResetEmail } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate } },
}));
vi.mock('../../services/email.service', () => ({
  emailService: { sendPasswordResetEmail },
}));
// Constructed at import in the controller — stub so the module loads.
vi.mock('google-auth-library', () => ({ OAuth2Client: class {} }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('new_hash'), compare: vi.fn() } }));

import { authController } from '../auth.controller';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: any) => { res.body = b; return res; });
  return res;
}

beforeEach(() => {
  userFindUnique.mockReset().mockResolvedValue(null);
  userUpdate.mockReset().mockResolvedValue({});
  sendPasswordResetEmail.mockReset().mockResolvedValue({ success: true });
});

describe('forgotPassword — no enumeration', () => {
  it('returns the generic message and sends NO email for an unknown address', async () => {
    userFindUnique.mockResolvedValue(null);
    const res = mockRes();
    await authController.forgotPassword({ body: { email: 'nobody@x.com' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/un lien de réinitialisation/i);
  });

  it('stores a hashed token (never the raw token) and emails a known user', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', email: 'a@x.com', name: 'Ann' });
    const res = mockRes();
    await authController.forgotPassword({ body: { email: 'a@x.com' } } as any, res);

    expect(userUpdate).toHaveBeenCalledTimes(1);
    const data = userUpdate.mock.calls[0][0].data;
    expect(data.resetToken).toMatch(/^[a-f0-9]{64}$/); // sha256 hex, not the raw token
    expect(data.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now());
    // The emailed URL carries the RAW token, which must differ from the stored hash.
    const sentUrl = sendPasswordResetEmail.mock.calls[0][0].resetUrl as string;
    const rawToken = new URL(sentUrl).searchParams.get('token')!;
    const crypto = await import('crypto');
    expect(crypto.createHash('sha256').update(rawToken).digest('hex')).toBe(data.resetToken);
  });

  it('still returns 200 for an invalid email (no leak via validation)', async () => {
    const res = mockRes();
    await authController.forgotPassword({ body: { email: 'not-an-email' } } as any, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('resetPassword — token validation', () => {
  it('rejects an expired token', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', email: 'a@x.com', resetTokenExpiry: new Date(Date.now() - 1000) });
    const res = mockRes();
    await authController.resetPassword({ body: { token: 'a'.repeat(40), password: 'longenough' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    userFindUnique.mockResolvedValue(null);
    const res = mockRes();
    await authController.resetPassword({ body: { token: 'a'.repeat(40), password: 'longenough' } } as any, res);
    expect(res.statusCode).toBe(400);
  });

  it('accepts a valid token, sets the new hash and clears the token (one-time)', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', email: 'a@x.com', resetTokenExpiry: new Date(Date.now() + 60_000) });
    const res = mockRes();
    await authController.resetPassword({ body: { token: 'a'.repeat(40), password: 'longenough' } } as any, res);
    expect(res.statusCode).toBe(200);
    const data = userUpdate.mock.calls[0][0].data;
    expect(data.passwordHash).toBe('new_hash');
    expect(data.resetToken).toBeNull();
    expect(data.resetTokenExpiry).toBeNull();
  });

  it('rejects a too-short password', async () => {
    const res = mockRes();
    await authController.resetPassword({ body: { token: 'a'.repeat(40), password: 'short' } } as any, res);
    expect(res.statusCode).toBe(400);
  });
});
