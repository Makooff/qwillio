import { prisma } from '../../config/database';
import { businessTimezone, zonedInstant } from '../../utils/zoned-time';
import { resolveCalendar, type ResolvedCalendar } from '../calendar-provider.service';
import { googleCalendarService } from '../google-calendar.service';
import { outlookCalendarService } from '../outlook-calendar.service';

const SLOT_MS = 30 * 60_000;
type BusyInterval = { start: Date; end: Date };

function dayBounds(day: string): { start: Date; end: Date; nextDay: string } {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith('0000')) {
    throw new Error('Invalid day: expected YYYY-MM-DD');
  }
  const start = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day) {
    throw new Error('Invalid day: nonexistent date');
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, nextDay: end.toISOString().split('T')[0] };
}

function slotMinutes(raw: unknown): number {
  const match = typeof raw === 'string' ? raw.trim().match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    // Corrupt confirmed data must not silently become a free slot.
    throw new Error('Invalid confirmed booking time');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function checkedInterval(start: Date, end: Date): BusyInterval {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    throw new Error('Invalid calendar busy interval');
  }
  return { start, end };
}

function googleInstant(value: unknown): Date {
  // Never interpret a provider timestamp in the process timezone.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error('Invalid Google busy timestamp');
  }
  return new Date(value);
}

/** Read-only adapter for the worker's 30-minute grid, independent of Vapi hours.
 * No availability cache: every read checks this client's currently active agenda.
 */
export class WorkerCalendarService {
  // Local injection seam: tests replace the provider transport, never global fetch.
  constructor(private readonly request: typeof fetch = (...args) => fetch(...args)) {}

  async takenSlots(clientId: string, day: string): Promise<string[]> {
    const { start, end, nextDay } = dayBounds(day);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        googleCalendarRefreshToken: true, googleCalendarId: true,
        outlookRefreshToken: true, outlookCalendarId: true, calendarProvider: true,
        onboardingData: true, country: true, city: true, agentLanguage: true,
      },
    });
    if (!client) throw new Error('Client not found');

    // bookingDate is a day label stored as a timestamp, not a local instant.
    const bookings = await prisma.clientBooking.findMany({
      where: {
        clientId, status: 'confirmed', bookingTime: { not: null },
        bookingDate: { gte: start, lt: end },
      },
      select: { bookingTime: true },
    });
    const taken = new Set<string>();
    for (const booking of bookings) {
      const minutes = slotMinutes(booking.bookingTime);
      // Worker bookings last 30 minutes, including legacy unaligned starts.
      for (let slot = Math.floor(minutes / 30) * 30; slot < Math.min(minutes + 30, 1440); slot += 30) {
        taken.add(hhmm(slot));
      }
    }

    const target = resolveCalendar(client);
    if (!target) return [...taken].sort(); // A calendar is optional; DB is not.
    const timezone = businessTimezone(client);
    const localStart = zonedInstant(day, '00:00', timezone);
    const localEnd = zonedInstant(nextDay, '00:00', timezone);
    const busy = await this.readBusy(target, start, timezone, localStart, localEnd);

    const clock = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
    });
    // Walk real instants, not 48 assumed wall-clock slots: DST can remove or
    // repeat an hour. Either occupied occurrence blocks a repeated HH:MM label.
    for (let instant = localStart.getTime(); instant < localEnd.getTime(); instant += SLOT_MS) {
      const slotEnd = Math.min(instant + SLOT_MS, localEnd.getTime());
      if (busy.some(interval => instant < interval.end.getTime() && slotEnd > interval.start.getTime())) {
        taken.add(clock.format(new Date(instant)));
      }
    }
    return [...taken].sort();
  }

  private async readBusy(
    target: ResolvedCalendar, date: Date, timezone: string, start: Date, end: Date,
  ): Promise<BusyInterval[]> {
    if (target.provider === 'outlook') {
      const busy = await outlookCalendarService.getBusySlots(
        target.refreshToken, target.calendarId || 'primary', date, timezone,
      );
      return busy.map(interval => checkedInterval(interval.start, interval.end));
    }

    const accessToken = await googleCalendarService.getAccessTokenFromRefresh(target.refreshToken);
    const calendarId = target.calendarId || 'primary';
    // getAvailability returns one-hour FREE slots. It cannot represent partial
    // overlaps on this grid; use the same freeBusy source and existing OAuth.
    const response = await this.request('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: calendarId }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Google FreeBusy request failed: ${response.status}`);
    const data = await response.json() as {
      calendars?: Record<string, { errors?: unknown[]; busy?: Array<{ start: string; end: string }> }>;
    } | null;
    const calendar = data?.calendars?.[calendarId];
    // HTTP 200 can still carry per-calendar failures. Missing data is not free.
    if (!calendar || (calendar.errors !== undefined && (!Array.isArray(calendar.errors) || calendar.errors.length > 0)) || !Array.isArray(calendar.busy)) {
      throw new Error('Google FreeBusy calendar unavailable');
    }
    return calendar.busy.map(interval => checkedInterval(googleInstant(interval?.start), googleInstant(interval?.end)));
  }
}

export const workerCalendarService = new WorkerCalendarService();
