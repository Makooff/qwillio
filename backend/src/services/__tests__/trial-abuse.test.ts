import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared Prisma mock handles so each test can control "record exists or not".
const { mockFindFirst, mockCount } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    trialFingerprint: { findFirst: mockFindFirst, count: mockCount },
    accountDeletion: { findFirst: mockFindFirst },
  })),
}));

import {
  trialAbuseService,
  hashValue,
  isDisposableEmail,
  isSuspiciousEmail,
} from '../trial-abuse.service';

beforeEach(() => {
  // Default: no existing fingerprints / deletions -> clean slate.
  mockFindFirst.mockReset().mockResolvedValue(null);
  mockCount.mockReset().mockResolvedValue(0);
});

describe('hashValue', () => {
  it('is deterministic and case/whitespace-insensitive', () => {
    expect(hashValue('ABC')).toBe(hashValue('  abc '));
  });
  it('produces a 64-char sha256 hex digest', () => {
    expect(hashValue('john@example.com')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('does not return the raw value (it is hashed)', () => {
    expect(hashValue('secret@example.com')).not.toContain('secret');
  });
});

describe('isDisposableEmail', () => {
  it('flags known disposable domains', () => {
    expect(isDisposableEmail('a@mailinator.com')).toBe(true);
    expect(isDisposableEmail('a@10minutemail.net')).toBe(true);
  });
  it('passes normal providers and malformed input', () => {
    expect(isDisposableEmail('a@gmail.com')).toBe(false);
    expect(isDisposableEmail('not-an-email')).toBe(false);
  });
});

describe('isSuspiciousEmail', () => {
  it('flags all-digit, very-short, and high-entropy usernames', () => {
    expect(isSuspiciousEmail('1234567@gmail.com')).toBe(true);
    expect(isSuspiciousEmail('ab@gmail.com')).toBe(true);
    expect(isSuspiciousEmail('abcdefghijklmnop@gmail.com')).toBe(true);
  });
  it('passes ordinary usernames', () => {
    expect(isSuspiciousEmail('john.doe@gmail.com')).toBe(false);
  });
});

describe('TrialAbuseService.checkSignals', () => {
  it('blocks disposable emails outright', async () => {
    const r = await trialAbuseService.checkSignals({ email: 'spam@mailinator.com' });
    expect(r.blocked).toBe(true);
    expect(r.matchedSignals).toContain('disposable_email');
  });

  it('blocks honeypot (bot) submissions', async () => {
    const r = await trialAbuseService.checkSignals({ email: 'john@gmail.com', honeypotFilled: true });
    expect(r.blocked).toBe(true);
    expect(r.matchedSignals).toContain('honeypot');
  });

  it('allows a clean signup with no suspicious signals', async () => {
    const r = await trialAbuseService.checkSignals({ email: 'john@gmail.com' });
    expect(r).toMatchObject({ allowed: true, blocked: false, suspiciousSignals: 0, requiresCaptcha: false });
    expect(r.matchedSignals).toEqual([]);
  });

  it('flags (but allows) a single suspicious signal', async () => {
    const r = await trialAbuseService.checkSignals({ email: 'john@gmail.com', formSubmitTime: 2 });
    expect(r.allowed).toBe(true);
    expect(r.requiresCaptcha).toBe(false);
    expect(r.matchedSignals).toContain('fast_submission');
  });

  it('requires captcha once two suspicious signals stack', async () => {
    const r = await trialAbuseService.checkSignals({
      email: '1234567@gmail.com', // suspicious_email
      formSubmitTime: 2,          // fast_submission
    });
    expect(r.allowed).toBe(true);
    expect(r.requiresCaptcha).toBe(true);
    expect(r.suspiciousSignals).toBeGreaterThanOrEqual(2);
  });

  it('counts VPN + country mismatch as suspicious signals', async () => {
    const r = await trialAbuseService.checkSignals({
      email: 'john@gmail.com',
      ipAddress: '1.2.3.4',
      vpnDetected: true,
      ipCountry: 'US',
      phoneCountry: 'FR',
    });
    expect(r.matchedSignals).toEqual(expect.arrayContaining(['vpn_detected', 'country_mismatch']));
    expect(r.requiresCaptcha).toBe(true);
  });

  it('blocks when the phone already used a trial', async () => {
    // First DB lookup (phone) returns an existing fingerprint.
    mockFindFirst.mockResolvedValueOnce({ id: 'fp1' });
    const r = await trialAbuseService.checkSignals({ email: 'john@gmail.com', phone: '+15551234567' });
    expect(r.blocked).toBe(true);
    expect(r.matchedSignals).toContain('phone');
  });
});
