import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  client: vi.fn(), bookings: vi.fn(), token: vi.fn(), outlook: vi.fn(),
}));
vi.mock('../../../config/database', () => ({ prisma: {
  client: { findUnique: mocks.client }, clientBooking: { findMany: mocks.bookings },
} }));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {
  getAccessTokenFromRefresh: mocks.token,
} }));
vi.mock('../../outlook-calendar.service', () => ({ outlookCalendarService: {
  getBusySlots: mocks.outlook,
} }));

import { WorkerCalendarService, workerCalendarService } from '../worker-calendar.service';

const client = (extra = {}) => ({
  onboardingData: { timezone: 'Europe/Brussels' }, country: 'BE',
  googleCalendarRefreshToken: null, googleCalendarId: null,
  outlookRefreshToken: null, outlookCalendarId: null, calendarProvider: null,
  ...extra,
});
const google = (extra = {}) => client({
  googleCalendarRefreshToken: 'client-refresh', googleCalendarId: 'client-calendar', ...extra,
});
const busy = (start: string, end: string) => ({ start, end });

function fixture() {
  const request = vi.fn<typeof fetch>();
  const service = new WorkerCalendarService(request);
  const respond = (value: unknown, status = 200) => request.mockResolvedValue(
    new Response(JSON.stringify(value), { status }),
  );
  const respondBusy = (intervals: unknown[]) => respond({ calendars: {
    'client-calendar': { busy: intervals },
  } });
  return { service, request, respond, respondBusy };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue(client());
  mocks.bookings.mockResolvedValue([]);
  mocks.token.mockResolvedValue('client-access');
  mocks.outlook.mockResolvedValue([]);
});

describe('workerCalendarService.takenSlots', () => {
  it('exports the parent-facing API and supports DB-only clients', async () => {
    expect(typeof workerCalendarService.takenSlots).toBe('function');
    const { service, request } = fixture();
    mocks.bookings.mockResolvedValue([{ bookingTime: '9:30' }, { bookingTime: '09:30' }, { bookingTime: '14:00' }]);
    expect(await service.takenSlots('tenant-a', '2026-07-15')).toEqual(['09:30', '14:00']);
    expect(request).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.outlook).not.toHaveBeenCalled();
    expect(mocks.client).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tenant-a' } }));
    expect(mocks.bookings).toHaveBeenCalledWith({
      where: { clientId: 'tenant-a', status: 'confirmed', bookingTime: { not: null },
        bookingDate: { gte: new Date('2026-07-15T00:00:00Z'), lt: new Date('2026-07-16T00:00:00Z') } },
      select: { bookingTime: true },
    });
  });

  it('merges Google partial overlaps and DB, sorted and deduplicated', async () => {
    const { service, request, respondBusy } = fixture();
    mocks.client.mockResolvedValue(google());
    mocks.bookings.mockResolvedValue([{ bookingTime: '9:30' }, { bookingTime: '15:00' }]);
    respondBusy([busy('2026-07-15T07:15:00Z', '2026-07-15T08:15:00Z')]);
    expect(await service.takenSlots('tenant-a', '2026-07-15')).toEqual(['09:00', '09:30', '10:00', '15:00']);
    expect(mocks.token).toHaveBeenCalledWith('client-refresh');
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/calendar/v3/freeBusy');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ Authorization: 'Bearer client-access', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(options?.body))).toEqual({
      timeMin: '2026-07-14T22:00:00.000Z', timeMax: '2026-07-15T22:00:00.000Z',
      items: [{ id: 'client-calendar' }],
    });
  });

  it('uses half-open overlaps, including seconds and clipped overnight events', async () => {
    const { service, respondBusy } = fixture();
    mocks.client.mockResolvedValue(google());
    respondBusy([
      busy('2026-07-14T21:00:00Z', '2026-07-14T22:00:00Z'),
      busy('2026-07-14T23:59:59Z', '2026-07-15T00:00:01Z'),
      busy('2026-07-15T21:45:00Z', '2026-07-16T01:00:00Z'),
    ]);
    expect(await service.takenSlots('a', '2026-07-15')).toEqual(['01:30', '02:00', '23:30']);
  });

  it('keeps a clean half-hour boundary free after an event ends', async () => {
    const { service, respondBusy } = fixture();
    mocks.client.mockResolvedValue(google());
    respondBusy([busy('2026-07-15T07:00:00Z', '2026-07-15T07:30:00Z')]);
    expect(await service.takenSlots('a', '2026-07-15')).toEqual(['09:00']);
  });

  it('selects Outlook when both providers are connected, never the personal Google account', async () => {
    const { service, request } = fixture();
    mocks.client.mockResolvedValue(google({ calendarProvider: 'outlook', outlookRefreshToken: 'outlook-client', outlookCalendarId: 'team' }));
    mocks.outlook.mockResolvedValue([{ start: new Date('2026-07-15T07:15:00Z'), end: new Date('2026-07-15T08:15:00Z') }]);
    expect(await service.takenSlots('a', '2026-07-15')).toEqual(['09:00', '09:30', '10:00']);
    expect(mocks.outlook).toHaveBeenCalledWith('outlook-client', 'team', new Date('2026-07-15T00:00:00Z'), 'Europe/Brussels');
    expect(request).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it('defaults to primary only for a connected client and uses existing timezone inference', async () => {
    const { service, request, respond } = fixture();
    mocks.client.mockResolvedValue(google({ googleCalendarId: null, onboardingData: null }));
    respond({ calendars: { primary: { busy: [] } } });
    expect(await service.takenSlots('a', '2026-01-15')).toEqual([]);
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      timeMin: '2026-01-14T23:00:00.000Z', timeMax: '2026-01-15T23:00:00.000Z', items: [{ id: 'primary' }],
    });
  });

  it('does not share provider credentials or timezone across clients', async () => {
    const { service, request, respond } = fixture();
    mocks.client.mockImplementation(({ where }) => Promise.resolve(google({
      googleCalendarRefreshToken: where.id, googleCalendarId: where.id,
      onboardingData: { timezone: where.id === 'a' ? 'Europe/Brussels' : 'America/New_York' },
    })));
    request.mockImplementation(async (_url, options) => {
      const id = JSON.parse(String(options?.body)).items[0].id;
      return new Response(JSON.stringify({ calendars: { [id]: { busy: [busy('2026-07-15T13:00:00Z', '2026-07-15T13:30:00Z')] } } }));
    });
    expect(await Promise.all([service.takenSlots('a', '2026-07-15'), service.takenSlots('b', '2026-07-15')])).toEqual([['15:00'], ['09:00']]);
    expect(mocks.token.mock.calls).toEqual([['a'], ['b']]);
    expect(mocks.bookings.mock.calls.map(([arg]) => arg.where.clientId)).toEqual(['a', 'b']);
  });

  it.each([
    ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z', 46],
    ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z', 48],
  ])('covers the whole local DST day %s without phantom slots', async (day, start, end, count) => {
    const { service, request, respondBusy } = fixture();
    mocks.client.mockResolvedValue(google());
    respondBusy([busy(start, end)]);
    const result = await service.takenSlots('a', day);
    expect(result).toHaveLength(count);
    expect(result[0]).toBe('00:00');
    expect(result[result.length - 1]).toBe('23:30');
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({ timeMin: start, timeMax: end });
    if (day === '2026-03-29') expect(result).not.toContain('02:00');
  });

  it('blocks a repeated autumn wall-clock slot if either occurrence is occupied', async () => {
    const { service, respondBusy } = fixture();
    mocks.client.mockResolvedValue(google());
    respondBusy([busy('2026-10-25T01:10:00Z', '2026-10-25T01:20:00Z')]);
    expect(await service.takenSlots('a', '2026-10-25')).toEqual(['02:00']);
  });

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '2026-01-01T00:00:00Z', ' 2026-01-01', '0000-01-01', 'nonsense'])('rejects invalid day %s before I/O', async day => {
    const { service, request } = fixture();
    await expect(service.takenSlots('a', day)).rejects.toThrow('Invalid day');
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.bookings).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('accepts a real leap day and a year boundary', async () => {
    const { service } = fixture();
    await service.takenSlots('a', '2028-02-29');
    await service.takenSlots('a', '2026-12-31');
    expect(mocks.bookings.mock.calls[1][0].where.bookingDate.lt).toEqual(new Date('2027-01-01T00:00:00Z'));
  });

  it('does not treat a missing client as DB-only', async () => {
    const { service } = fixture();
    mocks.client.mockResolvedValue(null);
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow('Client not found');
  });

  it.each([
    { calendars: { 'client-calendar': { errors: [{ reason: 'forbidden' }], busy: [] } } },
    { calendars: {} }, {},
    { calendars: { 'client-calendar': {} } },
    { calendars: { 'client-calendar': { busy: null } } },
    { calendars: { 'client-calendar': { busy: [busy('invalid', 'invalid')] } } },
    { calendars: { 'client-calendar': { busy: [busy('2026-07-15T09:00:00', '2026-07-15T10:00:00')] } } },
    { calendars: { 'client-calendar': { busy: [busy('2026-07-15T08:00:00Z', '2026-07-15T07:00:00Z')] } } },
  ])('fails closed for incomplete or erroneous Google responses %#', async response => {
    const { service, respond } = fixture();
    mocks.client.mockResolvedValue(google());
    respond(response);
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow();
  });

  it('propagates Google HTTP, network and refresh failures without falling back to DB', async () => {
    const { service, request, respond } = fixture();
    mocks.client.mockResolvedValue(google());
    respond({}, 403);
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow();
    request.mockRejectedValueOnce(new Error('offline'));
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow('offline');
    mocks.token.mockRejectedValueOnce(new Error('refresh revoked'));
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow('refresh revoked');
  });

  it('propagates Outlook and DB failures', async () => {
    const { service } = fixture();
    mocks.client.mockResolvedValue(client({ outlookRefreshToken: 'outlook' }));
    mocks.outlook.mockRejectedValueOnce(new Error('Outlook unavailable'));
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow('Outlook unavailable');
    mocks.client.mockResolvedValue(client());
    mocks.bookings.mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow('DB unavailable');
  });

  it('fails closed for malformed confirmed DB times', async () => {
    const { service } = fixture();
    mocks.bookings.mockResolvedValue([{ bookingTime: '25:00' }]);
    await expect(service.takenSlots('a', '2026-07-15')).rejects.toThrow();
  });

  it('covers a non-grid DB booking for its 30-minute worker duration', async () => {
    const { service } = fixture();
    mocks.bookings.mockResolvedValue([{ bookingTime: '9:15' }]);
    expect(await service.takenSlots('a', '2026-07-15')).toEqual(['09:00', '09:30']);
  });
});
