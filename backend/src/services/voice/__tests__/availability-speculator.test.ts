import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const getAccessTokenFromRefresh = vi.fn();
const getAvailability = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: { client: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

vi.mock('../../google-calendar.service', () => ({
  googleCalendarService: {
    getAccessTokenFromRefresh: (...a: unknown[]) => getAccessTokenFromRefresh(...a),
    getAvailability: (...a: unknown[]) => getAvailability(...a),
  },
}));

const { availabilitySpeculator, detectDate } = await import('../availability-speculator');

/** Wednesday 12 August 2026, midday. */
const NOW = new Date('2026-08-12T12:00:00Z');
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe('detectDate', () => {
  it('resolves today and tomorrow in both languages', () => {
    expect(iso(detectDate('vous avez quelque chose aujourd\'hui ?', 'fr', NOW))).toBe('2026-08-12');
    expect(iso(detectDate('anything tomorrow?', 'en', NOW))).toBe('2026-08-13');
  });

  it('resolves a weekday to its NEXT occurrence, never a past one', () => {
    // Wednesday asking for Monday means the coming Monday.
    expect(iso(detectDate('plutot lundi si possible', 'fr', NOW))).toBe('2026-08-17');
    expect(iso(detectDate('how about friday', 'en', NOW))).toBe('2026-08-14');
  });

  it('treats the same weekday as next week, not today', () => {
    expect(iso(detectDate('mercredi', 'fr', NOW))).toBe('2026-08-19');
  });

  it('resolves a bare day number, rolling into next month when it has passed', () => {
    expect(iso(detectDate('le 20 si vous avez', 'fr', NOW))).toBe('2026-08-20');
    expect(iso(detectDate('le 5', 'fr', NOW))).toBe('2026-09-05');
  });

  it('returns null when no day is named — a missed detection is free', () => {
    expect(detectDate('je voudrais reserver une table', 'fr', NOW)).toBeNull();
    expect(detectDate('ok', 'en', NOW)).toBeNull();
    expect(detectDate('', 'fr', NOW)).toBeNull();
  });

  it('does not guess at vague future references', () => {
    // "the week after next" is exactly the kind of guess that costs a pointless
    // API call for no gain.
    expect(detectDate('dans deux semaines', 'fr', NOW)).toBeNull();
  });
});

describe('availabilitySpeculator', () => {
  beforeEach(() => {
    availabilitySpeculator.reset();
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ googleCalendarRefreshToken: 'token', googleCalendarId: 'primary' });
    getAccessTokenFromRefresh.mockResolvedValue('access');
    getAvailability.mockResolvedValue(['10:00', '11:00']);
  });

  const flush = () => new Promise(r => setTimeout(r, 0));

  it('serves a second read of the same day from cache', async () => {
    await availabilitySpeculator.freeSlots('client_1', NOW);
    await availabilitySpeculator.freeSlots('client_1', NOW);
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('makes the tool call free when the day was already speculated', async () => {
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    expect(getAvailability).toHaveBeenCalledTimes(1);

    // The real tool call reads through the same path and hits the cache.
    expect(await availabilitySpeculator.freeSlots('client_1', NOW)).toEqual(['10:00', '11:00']);
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('never speculates the same day twice', async () => {
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('caps speculations per call so a caller listing days cannot flood Google', async () => {
    for (let i = 0; i < 10; i++) {
      const day = new Date(NOW);
      day.setDate(day.getDate() + i);
      availabilitySpeculator.speculate('client_1', 'call_1', day);
    }
    await flush();
    expect(getAvailability.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('gives a new call its own budget', async () => {
    for (let i = 0; i < 6; i++) {
      const day = new Date(NOW);
      day.setDate(day.getDate() + i);
      availabilitySpeculator.speculate('client_1', 'call_1', day);
    }
    await flush();
    const afterFirst = getAvailability.mock.calls.length;

    availabilitySpeculator.release('call_1');
    const other = new Date(NOW);
    other.setDate(other.getDate() + 20);
    availabilitySpeculator.speculate('client_1', 'call_2', other);
    await flush();

    expect(getAvailability.mock.calls.length).toBe(afterFirst + 1);
  });

  it('swallows a failed speculation — the real tool call runs the normal path', async () => {
    getAvailability.mockRejectedValue(new Error('google down'));
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    // No unhandled rejection, and nothing cached.
    await expect(availabilitySpeculator.freeSlots('client_1', NOW)).rejects.toThrow();
  });

  it('refuses to read when no calendar is connected', async () => {
    findUnique.mockResolvedValue({ googleCalendarRefreshToken: null });
    await expect(availabilitySpeculator.freeSlots('client_1', NOW)).rejects.toThrow(/not connected/);
  });

  it('only ever reads — no write path exists on this module', () => {
    // A wrong guess must cost one wasted lookup, never a booking.
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(availabilitySpeculator));
    expect(surface).not.toContain('book');
    expect(surface).not.toContain('write');
  });
});
