import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The statistical guardrail: evaluateTestingMutations must only promote a
 * mutation to "validated" when the variant is significantly better than the
 * baseline. Otherwise it reverts (keeps the previous script). The real z-test
 * is exercised; only the DB is mocked.
 */
const { smFindMany, smUpdate, callCount } = vi.hoisted(() => ({
  smFindMany: vi.fn(),
  smUpdate: vi.fn(),
  callCount: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    scriptMutation: { findMany: smFindMany, update: smUpdate },
    call: { count: callCount },
  },
}));
vi.mock('../discord.service', () => ({ discordService: { notifySystem: vi.fn() } }));

import { scriptLearningService } from '../script-learning.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const evaluate = () => (scriptLearningService as any).evaluateTestingMutations();

/** Mock the two call.count() queries: total answered vs. converted (interestScore gte 5). */
function mockCalls(callsAfter: number, conversionsAfter: number) {
  callCount.mockImplementation((args: any) =>
    Promise.resolve(args?.where?.interestScore ? conversionsAfter : callsAfter),
  );
}

function mutation(over: Record<string, unknown> = {}) {
  return {
    id: 'm1', niche: 'plumber', language: 'en',
    callsBefore: 100, conversionBefore: 0.1, createdAt: new Date('2026-01-01'),
    ...over,
  };
}

beforeEach(() => {
  smUpdate.mockReset().mockResolvedValue({});
  callCount.mockReset();
  smFindMany.mockReset().mockResolvedValue([]);
});

describe('evaluateTestingMutations — statistical gate', () => {
  it('validates a significant, well-powered improvement', async () => {
    smFindMany.mockResolvedValue([mutation()]); // 10% baseline over 100
    mockCalls(100, 20);                          // 20% over 100 -> p ≈ 0.024

    await evaluate();

    expect(smUpdate).toHaveBeenCalledTimes(1);
    const data = smUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('validated');
    expect(data.statisticalSignificance).toBeLessThan(0.05);
  });

  it('reverts a small, non-significant improvement (noise)', async () => {
    smFindMany.mockResolvedValue([mutation()]); // 10% baseline
    mockCalls(100, 11);                          // 11% -> not significant

    await evaluate();

    const data = smUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('reverted');
    expect(data.revertReason).toMatch(/not statistically significant/i);
  });

  it('reverts a worse variant', async () => {
    smFindMany.mockResolvedValue([mutation({ conversionBefore: 0.3 })]); // 30% baseline
    mockCalls(100, 10);                                                   // 10% -> worse

    await evaluate();

    const data = smUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('reverted');
    expect(data.revertReason).toMatch(/not improved/i);
  });

  it('reverts when the baseline sample is too small to trust', async () => {
    smFindMany.mockResolvedValue([mutation({ callsBefore: 5, conversionBefore: 0 })]);
    mockCalls(100, 50); // big apparent jump, but baseline n=5

    await evaluate();

    const data = smUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('reverted');
    expect(data.revertReason).toMatch(/too small/i);
  });

  it('skips mutations without enough post-change calls yet', async () => {
    smFindMany.mockResolvedValue([mutation()]);
    mockCalls(10, 3); // below TRACKING_CALLS (50)

    await evaluate();

    expect(smUpdate).not.toHaveBeenCalled();
  });
});
