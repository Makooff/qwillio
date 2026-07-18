import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the inbound spam shield's scoring. Prisma is mocked so the
 * classifier is exercised deterministically: blocklist lookups and the
 * repeat-frequency count are stubbed per case.
 */
const { spamNumberFindUnique, spamNumberCreate, spamNumberUpdate, clientCallCount } = vi.hoisted(() => ({
  spamNumberFindUnique: vi.fn(),
  spamNumberCreate: vi.fn(),
  spamNumberUpdate: vi.fn(),
  clientCallCount: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    spamNumber: {
      findUnique: spamNumberFindUnique,
      create: spamNumberCreate,
      update: spamNumberUpdate,
    },
    clientCall: { count: clientCallCount },
  },
}));

import { spamDetectionService } from '../spam-detection.service';

const CLIENT = 'client-1';
const REAL_TRANSCRIPT =
  'Assistant: Hello, how can I help you? Customer: Hi, I would like to book an appointment for Tuesday afternoon please.';

beforeEach(() => {
  spamNumberFindUnique.mockReset().mockResolvedValue(null);
  spamNumberCreate.mockReset().mockResolvedValue({});
  spamNumberUpdate.mockReset().mockResolvedValue({});
  clientCallCount.mockReset().mockResolvedValue(0);
});

describe('spamDetectionService.classifyInboundCall', () => {
  it('does NOT flag a normal customer call', async () => {
    const r = await spamDetectionService.classifyInboundCall({
      clientId: CLIENT,
      callerNumber: '+32470000001',
      transcript: REAL_TRANSCRIPT,
      durationSeconds: 45,
    });
    expect(r.isSpam).toBe(false);
    expect(r.score).toBeLessThan(60);
  });

  it('flags a silent, instant-hangup call as spam', async () => {
    const r = await spamDetectionService.classifyInboundCall({
      clientId: CLIENT,
      callerNumber: '+32470000002',
      transcript: '',
      durationSeconds: 3,
    });
    expect(r.isSpam).toBe(true);
    expect(r.reasons).toContain('no_meaningful_speech');
    expect(r.reasons).toContain('instant_hangup');
  });

  it('treats a blocklisted number as decisive spam', async () => {
    spamNumberFindUnique.mockResolvedValue({ id: 'x', phoneNumber: '+32470000003' });
    const r = await spamDetectionService.classifyInboundCall({
      clientId: CLIENT,
      callerNumber: '+32470000003',
      transcript: REAL_TRANSCRIPT,
      durationSeconds: 60,
    });
    expect(r.isSpam).toBe(true);
    expect(r.reasons).toContain('blocklisted_number');
    expect(r.score).toBe(100);
  });

  it('flags a number flooding the line as spam', async () => {
    clientCallCount.mockResolvedValue(5); // 5 prior calls in the window
    const r = await spamDetectionService.classifyInboundCall({
      clientId: CLIENT,
      callerNumber: '+32470000004',
      transcript: '', // short too, combined signals
      durationSeconds: 30,
    });
    expect(r.isSpam).toBe(true);
    expect(r.reasons).toContain('repeat_flooding');
  });

  it('does not flag a short call that still had a real conversation', async () => {
    const r = await spamDetectionService.classifyInboundCall({
      clientId: CLIENT,
      callerNumber: '+32470000005',
      transcript: REAL_TRANSCRIPT,
      durationSeconds: 30,
    });
    expect(r.isSpam).toBe(false);
  });
});

describe('spamDetectionService.registerSpamHit', () => {
  it('auto-blocks a number once it crosses the repeat-offender threshold', async () => {
    clientCallCount.mockResolvedValue(3); // >= AUTO_BLOCK_SPAM_HITS
    await spamDetectionService.registerSpamHit(CLIENT, '+32470000006', ['no_meaningful_speech']);
    expect(spamNumberCreate).toHaveBeenCalledOnce();
  });

  it('does not block a first-time spam number', async () => {
    clientCallCount.mockResolvedValue(1);
    await spamDetectionService.registerSpamHit(CLIENT, '+32470000007', ['instant_hangup']);
    expect(spamNumberCreate).not.toHaveBeenCalled();
  });

  it('increments the hit count for an already-blocked number', async () => {
    spamNumberFindUnique.mockResolvedValue({ id: 'y', phoneNumber: '+32470000008' });
    await spamDetectionService.registerSpamHit(CLIENT, '+32470000008', ['repeat_flooding']);
    expect(spamNumberUpdate).toHaveBeenCalledOnce();
    expect(spamNumberCreate).not.toHaveBeenCalled();
  });
});
