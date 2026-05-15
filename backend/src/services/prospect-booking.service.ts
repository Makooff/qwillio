/**
 * Prospect Auto-Booking Service
 * Generates time-slot offers, tracks confirmation, and expires stale tokens.
 */
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { smsService } from './sms.service';
import crypto from 'crypto';

export interface BookingSlot {
  label: string; // e.g. "Lundi 9h" / "Monday 9am"
  iso: string;   // ISO date string
}

// ─── Helpers ─────────────────────────────────────────────

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Build a Date set to the given hour (0-23) in a specific IANA timezone.
 * We approximate by constructing the ISO string directly — works for display
 * purposes and for round-trip ISO matching.
 */
function dayAtHour(base: Date, daysOffset: number, hour: number, timezone: string): Date {
  const d = addDays(base, daysOffset);
  // Use Intl to get the local date parts in the prospect's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value ?? String(d.getFullYear());
  const mo = parts.find(p => p.type === 'month')?.value ?? String(d.getMonth() + 1).padStart(2, '0');
  const da = parts.find(p => p.type === 'day')?.value ?? String(d.getDate()).padStart(2, '0');
  // Build a UTC-offset-aware ISO string by parsing locale midnight + hour
  const localIso = `${y}-${mo}-${da}T${String(hour).padStart(2, '0')}:00:00`;
  // Convert back to UTC via a temporary Date
  const tzDate = new Date(
    new Date(localIso).toLocaleString('en-US', { timeZone: 'UTC' }) // treat as UTC first
  );
  // Re-interpret: create date from parts directly as UTC then adjust for timezone offset
  const reference = new Date(`${y}-${mo}-${da}T${String(hour).padStart(2, '0')}:00:00`);
  // Get the offset of the target timezone at this moment
  const utcMs = reference.getTime();
  const tzOffset = getTimezoneOffset(timezone, reference);
  return new Date(utcMs - tzOffset * 60 * 1000);
}

/** Returns the UTC offset in minutes for the given timezone at a given date */
function getTimezoneOffset(timezone: string, date: Date): number {
  const utcStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    hour12: false,
  }).format(date);
  const tzStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(date);
  const utcHour = parseInt(utcStr, 10);
  const tzHour = parseInt(tzStr, 10);
  return (utcHour - tzHour) * 60;
}

function formatSlotLabel(iso: string, lang: 'en' | 'fr', timezone: string): string {
  const date = new Date(iso);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  return date.toLocaleString(locale, {
    timeZone: timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: lang === 'en',
  });
}

// ─── Service ─────────────────────────────────────────────

export class ProspectBookingService {
  /**
   * Generate 3 booking slot options for a prospect and return the booking URL.
   */
  async createBookingSlots(prospectId: string, lang: 'en' | 'fr'): Promise<string> {
    const prospect = await prisma.prospect.findUniqueOrThrow({
      where: { id: prospectId },
      select: { id: true, phone: true, businessName: true, niche: true, timezone: true },
    });

    const timezone = prospect.timezone || 'America/Chicago';
    const now = new Date();

    // 3 slots: tomorrow 9am, tomorrow 2pm, day-after 10am
    const slotConfigs: Array<{ daysOffset: number; hour: number }> = [
      { daysOffset: 1, hour: 9 },
      { daysOffset: 1, hour: 14 },
      { daysOffset: 2, hour: 10 },
    ];

    const slots: BookingSlot[] = slotConfigs.map(({ daysOffset, hour }) => {
      const slotDate = dayAtHour(now, daysOffset, hour, timezone);
      const iso = slotDate.toISOString();
      return {
        label: formatSlotLabel(iso, lang, timezone),
        iso,
      };
    });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = addHours(now, 48);

    await prisma.prospectBookingSlot.create({
      data: {
        prospectId,
        token,
        slots: slots as unknown as import('@prisma/client').Prisma.InputJsonValue,
        expiresAt,
        status: 'pending',
      },
    });

    const baseUrl = env.FRONTEND_URL?.split(',')[0] ?? 'http://localhost:5173';
    const bookingUrl = `${baseUrl}/book/${token}`;

    logger.info(`[ProspectBooking] Created slots for prospect ${prospectId}, url=${bookingUrl}`);
    return bookingUrl;
  }

  /**
   * Confirm a specific slot by its ISO string.
   */
  async confirmSlot(token: string, selectedIso: string): Promise<boolean> {
    const slotRecord = await prisma.prospectBookingSlot.findUnique({
      where: { token },
      include: { prospect: { select: { phone: true, businessName: true } } },
    });

    if (!slotRecord) {
      logger.warn(`[ProspectBooking] Token not found: ${token}`);
      return false;
    }

    if (slotRecord.status !== 'pending') {
      logger.warn(`[ProspectBooking] Token already ${slotRecord.status}: ${token}`);
      return false;
    }

    if (slotRecord.expiresAt < new Date()) {
      logger.warn(`[ProspectBooking] Token expired: ${token}`);
      return false;
    }

    const slotsArray = slotRecord.slots as unknown as BookingSlot[];
    const matchedSlot = slotsArray.find(s => s.iso === selectedIso);
    if (!matchedSlot) {
      logger.warn(`[ProspectBooking] ISO not in offered slots: ${selectedIso}`);
      return false;
    }

    await prisma.prospectBookingSlot.update({
      where: { token },
      data: {
        selectedSlot: new Date(selectedIso),
        confirmedAt: new Date(),
        status: 'confirmed',
      },
    });

    // Send confirmation SMS if phone available
    if (slotRecord.prospect.phone) {
      const body = `✅ Confirmed! Our team will call you on ${matchedSlot.label}. — Qwillio`;
      await smsService.sendSMS(slotRecord.prospect.phone, body, {
        messageType: 'booking_confirmed',
        prospectId: slotRecord.prospectId,
      });
    }

    logger.info(`[ProspectBooking] Confirmed slot ${selectedIso} for token ${token}`);
    return true;
  }

  /**
   * Get slot info with prospect details (public endpoint).
   */
  async getSlot(token: string) {
    return prisma.prospectBookingSlot.findUnique({
      where: { token },
      include: {
        prospect: {
          select: { businessName: true, niche: true, city: true },
        },
      },
    });
  }

  /**
   * Expire all pending slots past their expiry date.
   */
  async expireOldSlots(): Promise<number> {
    const result = await prisma.prospectBookingSlot.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    });
    logger.info(`[ProspectBooking] Expired ${result.count} stale slots`);
    return result.count;
  }
}

export const prospectBookingService = new ProspectBookingService();
