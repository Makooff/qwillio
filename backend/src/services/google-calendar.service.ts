import { prisma } from '../config/database';
import { logger } from '../config/logger';

// ═══════════════════════════════════════════════════════════
// GOOGLE CALENDAR SERVICE
// Syncs bookings made by AI receptionist to Google Calendar
// Enterprise plan feature
// ═══════════════════════════════════════════════════════════
export class GoogleCalendarService {
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  // ═══════════════════════════════════════════════════════════
  // CREATE CALENDAR EVENT from a booking
  // ═══════════════════════════════════════════════════════════
  async createEventFromBooking(bookingId: string, accessToken: string, calendarId = 'primary') {
    const booking = await prisma.clientBooking.findUnique({
      where: { id: bookingId },
      include: { client: true },
    });

    if (!booking) throw new Error(`Booking not found: ${bookingId}`);

    // Parse booking date and time
    const startDate = new Date(booking.bookingDate);
    if (booking.bookingTime) {
      const [hours, minutes] = booking.bookingTime.split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);
    }

    // Default 1 hour duration
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const event = {
      summary: `${booking.serviceType || 'Appointment'} - ${booking.customerName}`,
      description: [
        `Customer: ${booking.customerName}`,
        booking.customerPhone ? `Phone: ${booking.customerPhone}` : null,
        booking.customerEmail ? `Email: ${booking.customerEmail}` : null,
        booking.partySize ? `Party size: ${booking.partySize}` : null,
        booking.specialRequests ? `Special requests: ${booking.specialRequests}` : null,
        '',
        `Booked via Qwillio AI Receptionist`,
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/New_York',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      attendees: booking.customerEmail ? [{ email: booking.customerEmail }] : [],
    };

    try {
      const response = await fetch(`${this.baseUrl}/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Calendar API error (${response.status}): ${error}`);
      }

      const calendarEvent = await response.json() as any;

      // Update booking with Google event ID
      await prisma.clientBooking.update({
        where: { id: bookingId },
        data: { googleEventId: calendarEvent.id },
      });

      logger.info(`Google Calendar event created: ${calendarEvent.id} for ${booking.customerName}`);
      return calendarEvent;
    } catch (error) {
      logger.error(`Failed to create Google Calendar event:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE / CANCEL EVENT when booking is cancelled
  // ═══════════════════════════════════════════════════════════
  async cancelEvent(bookingId: string, accessToken: string, calendarId = 'primary') {
    const booking = await prisma.clientBooking.findUnique({ where: { id: bookingId } });
    if (!booking || !booking.googleEventId) return;

    try {
      await fetch(`${this.baseUrl}/calendars/${calendarId}/events/${booking.googleEventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      await prisma.clientBooking.update({
        where: { id: bookingId },
        data: { status: 'cancelled', googleEventId: null },
      });

      logger.info(`Google Calendar event cancelled: ${booking.googleEventId}`);
    } catch (error) {
      logger.error(`Failed to cancel Google Calendar event:`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SYNC ALL UNSYNC'D BOOKINGS for a client
  // ═══════════════════════════════════════════════════════════
  async syncClientBookings(clientId: string, accessToken: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.planType !== 'enterprise') {
      throw new Error('Google Calendar sync is only available for Enterprise plan');
    }

    const unsynced = await prisma.clientBooking.findMany({
      where: {
        clientId,
        googleEventId: null,
        status: 'confirmed',
        bookingDate: { gte: new Date() }, // Only future bookings
      },
      orderBy: { bookingDate: 'asc' },
    });

    let synced = 0;
    for (const booking of unsynced) {
      try {
        await this.createEventFromBooking(booking.id, accessToken);
        synced++;
      } catch (error) {
        logger.error(`Failed to sync booking ${booking.id}:`, error);
      }
    }

    logger.info(`Synced ${synced}/${unsynced.length} bookings to Google Calendar for ${client.businessName}`);
    return synced;
  }

  // ═══════════════════════════════════════════════════════════
  // GET FREE/BUSY SLOTS - Check availability
  // ═══════════════════════════════════════════════════════════
  async getAvailability(accessToken: string, calendarId = 'primary', date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    try {
      const response = await fetch(`${this.baseUrl}/freeBusy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          items: [{ id: calendarId }],
        }),
      });

      if (!response.ok) {
        throw new Error(`FreeBusy request failed: ${response.status}`);
      }

      const data = await response.json() as any;
      const busySlots = data.calendars?.[calendarId]?.busy || [];

      // Generate available slots (9am-5pm, 1 hour slots)
      const availableSlots: string[] = [];
      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(date);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        const isBusy = busySlots.some((busy: any) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        if (!isBusy) {
          availableSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        }
      }

      return availableSlots;
    } catch (error) {
      logger.error('Failed to get calendar availability:', error);
      throw error;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
