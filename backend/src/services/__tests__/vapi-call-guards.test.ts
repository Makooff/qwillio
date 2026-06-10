import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration harness for callNextProspect's circuit-breaker guards — the
 * revenue-critical "do NOT place a call when..." rules. Time guards are made
 * deterministic with a fixed weekday-business-hours clock + stubbed scheduling
 * helpers; Prisma and the Vapi client are mocked so no real call is placed.
 */
const { botStatusFindFirst, botStatusUpdateMany, prospectFindMany } = vi.hoisted(() => ({
  botStatusFindFirst: vi.fn(),
  botStatusUpdateMany: vi.fn(),
  prospectFindMany: vi.fn(),
}));
const { createCall } = vi.hoisted(() => ({ createCall: vi.fn() }));

vi.mock('../../config/database', () => ({
  prisma: {
    botStatus: { findFirst: botStatusFindFirst, updateMany: botStatusUpdateMany },
    prospect: { findMany: prospectFindMany, update: vi.fn() },
    call: { create: vi.fn().mockResolvedValue({ id: 'c1' }), update: vi.fn() },
    analyticsDaily: { upsert: vi.fn() },
  },
}));
vi.mock('../../config/vapi', () => ({ vapiClient: { createCall } }));
vi.mock('../../config/scheduling', () => ({
  isHoliday: () => false,
  isBlackoutPeriod: () => false,
  isWithinCallWindow: () => true,
  isPriorityDay: () => false,
  getDayHourBonus: () => 0,
  CALL_RATE_LIMIT_MS: 60_000,
  MAX_CALL_ATTEMPTS: 3,
}));

import { vapiService } from '../vapi.service';

beforeEach(() => {
  vi.useFakeTimers();
  // Tue 2026-06-09 16:00 UTC = 12:00 ET — a weekday inside business hours.
  vi.setSystemTime(new Date('2026-06-09T16:00:00Z'));
  botStatusFindFirst.mockReset();
  botStatusUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  prospectFindMany.mockReset().mockResolvedValue([]);
  createCall.mockReset().mockResolvedValue({ id: 'vapi_1' });
});

afterEach(() => vi.useRealTimers());

const activeBot = { id: 'b1', isActive: true, callsToday: 0, callsQuotaDaily: 50, lastCall: null };

describe('callNextProspect — circuit-breaker guards', () => {
  it('does not place a call when the bot is inactive', async () => {
    botStatusFindFirst.mockResolvedValue({ ...activeBot, isActive: false });
    expect(await vapiService.callNextProspect()).toBe(false);
    expect(createCall).not.toHaveBeenCalled();
  });

  it('does not place a call when the daily quota is reached', async () => {
    botStatusFindFirst.mockResolvedValue({ ...activeBot, callsToday: 50 });
    expect(await vapiService.callNextProspect()).toBe(false);
    expect(createCall).not.toHaveBeenCalled();
  });

  it('does not place a call inside the per-minute rate-limit window', async () => {
    botStatusFindFirst.mockResolvedValue({ ...activeBot, lastCall: new Date('2026-06-09T15:59:30Z') }); // 30s ago
    expect(await vapiService.callNextProspect()).toBe(false);
    expect(createCall).not.toHaveBeenCalled();
  });

  it('does not place a call when no eligible prospects exist', async () => {
    botStatusFindFirst.mockResolvedValue(activeBot);
    prospectFindMany.mockResolvedValue([]);
    expect(await vapiService.callNextProspect()).toBe(false);
    expect(createCall).not.toHaveBeenCalled();
  });
});
