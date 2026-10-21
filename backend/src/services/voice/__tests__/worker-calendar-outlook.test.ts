import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ client: vi.fn(), bookings: vi.fn() }));
vi.mock('../../../config/database', () => ({ prisma: {
  client: { findUnique: mocks.client }, clientBooking: { findMany: mocks.bookings },
} }));
// Keep provider selection, timezone logic, Outlook mapping and worker grid real.
// Database reads, OAuth and HTTP are the only replaced boundaries.
import { outlookCalendarService } from '../../outlook-calendar.service';
import { workerCalendarService } from '../worker-calendar.service';

const request = vi.fn<typeof fetch>();
const event = (day: string, start: string, end: string, extra = {}) => ({
  showAs: 'busy', isCancelled: false,
  start: { dateTime: `${day}T${start}:00.0000000`, timeZone: 'Europe/Brussels' },
  end: { dateTime: `${day}T${end}:00.0000000`, timeZone: 'Europe/Brussels' },
  ...extra,
});
const respond = (events: unknown[]) => request.mockImplementation(async () => new Response(JSON.stringify({ value: events })));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', request);
  vi.spyOn(outlookCalendarService, 'getAccessTokenFromRefresh').mockResolvedValue('fixture-access');
  mocks.client.mockResolvedValue({
    onboardingData: { timezone: 'Europe/Brussels' }, country: 'BE',
    calendarProvider: 'outlook', outlookRefreshToken: 'fixture-refresh', outlookCalendarId: 'fixture-team',
    googleCalendarRefreshToken: null, googleCalendarId: null,
  });
  mocks.bookings.mockResolvedValue([]);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('real Outlook adapter through workerCalendarService.takenSlots', () => {
  it.each(['2026-07-15', '2026-01-15'])('filters the local day and non-blocking events on %s', async (day) => {
    const previous = day.replace('-15', '-14');
    const next = day.replace('-15', '-16');
    respond([
      event(day, '09:00', '09:30'),
      event(day, '10:00', '10:30', { isCancelled: true }),
      ...['free', 'workingElsewhere', 'tentative'].map(showAs => event(day, '11:00', '11:30', { showAs })),
      event(previous, '22:00', '23:00'), event(next, '00:00', '01:00'),
      event(previous, '23:45', '00:15', { end: { dateTime: `${day}T00:15:00.0000000`, timeZone: 'Europe/Brussels' } }),
      event(day, '23:45', '23:59'),
    ]);
    expect(await workerCalendarService.takenSlots('fixture-tenant', day)).toEqual(['00:00', '09:00', '23:30']);
    const query = new URL(String(request.mock.calls[0][0])).searchParams;
    expect(query.get('startDateTime')).toBe(`${previous}T00:00:00.000Z`);
    const afterNext = day.replace('-15', '-17');
    expect(query.get('endDateTime')).toBe(`${afterNext}T00:00:00.000Z`);
  });

  it.each([
    ['2026-07-15T07:00:30.1234567', 'UTC'],
    ['2026-07-15T07:00:30.1234567Z', 'Europe/Brussels'],
    ['2026-07-15T09:00:30.1234567+02:00', 'Europe/Brussels'],
  ])('preserves seconds and explicit instant semantics: %s', async (dateTime, timeZone) => {
    respond([event('2026-07-15', '09:00', '09:30', {
      start: { dateTime, timeZone },
    })]);
    const intervals = await outlookCalendarService.getBusySlots('fixture-refresh', null, new Date('2026-07-15T00:00:00Z'), 'Europe/Brussels');
    expect(intervals[0].start.toISOString()).toBe('2026-07-15T07:00:30.123Z');
    expect(await workerCalendarService.takenSlots('fixture-tenant', '2026-07-15')).toEqual(['09:00']);
  });
  it.each([
    ['2026-07-15', '2026-07-15T07:00:00.000Z'],
    ['2026-01-15', '2026-01-15T08:00:00.000Z'],
  ])('blocks local 09:00, not a shifted slot, on %s', async (day, expectedStart) => {
    respond([event(day, '09:00', '09:30')]);
    const intervals = await outlookCalendarService.getBusySlots('fixture-refresh', 'fixture-team', new Date(`${day}T00:00:00Z`), 'Europe/Brussels');
    expect.soft(intervals[0].start.toISOString()).toBe(expectedStart);
    expect(await workerCalendarService.takenSlots('fixture-tenant', day)).toEqual(['09:00']);
    expect(outlookCalendarService.getAccessTokenFromRefresh).toHaveBeenCalledWith('fixture-refresh');
    expect(mocks.bookings).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ clientId: 'fixture-tenant', status: 'confirmed' }) }));
    const [url, options] = request.mock.calls[0];
    expect(String(url)).toContain('/me/calendars/fixture-team/calendarView?');
    expect(options?.headers).toEqual({ Authorization: 'Bearer fixture-access', Prefer: 'outlook.timezone="Europe/Brussels"' });
  });
});
