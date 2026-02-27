import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { discordService } from './discord.service';

export class BookingReminderService {

  // ═══════════════════════════════════════════════════════════
  // PROCESS BOOKING REMINDERS - Called by CRON every hour
  // Sends email reminders to customers 24h before their booking
  // ═══════════════════════════════════════════════════════════
  async processBookingReminders(): Promise<number> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find bookings happening in the next 24 hours that haven't been reminded
    const upcomingBookings = await prisma.clientBooking.findMany({
      where: {
        bookingDate: {
          gte: now,
          lte: tomorrow,
        },
        status: 'confirmed',
        reminderSent: false,
        customerEmail: { not: null },
      },
      include: {
        client: {
          select: {
            businessName: true,
            businessType: true,
            contactPhone: true,
            vapiPhoneNumber: true,
            planType: true,
          },
        },
      },
      take: 50,
    });

    if (upcomingBookings.length === 0) return 0;

    let sent = 0;

    for (const booking of upcomingBookings) {
      // Only PRO and ENTERPRISE clients get automatic reminders
      if (!['pro', 'enterprise'].includes(booking.client.planType)) continue;

      try {
        await emailService.sendBookingReminderEmail({
          to: booking.customerEmail!,
          customerName: booking.customerName,
          businessName: booking.client.businessName,
          bookingDate: booking.bookingDate,
          bookingTime: booking.bookingTime || '',
          serviceType: booking.serviceType || 'Appointment',
          specialRequests: booking.specialRequests || null,
          businessPhone: booking.client.contactPhone || booking.client.vapiPhoneNumber || '',
        });

        await prisma.clientBooking.update({
          where: { id: booking.id },
          data: {
            reminderSent: true,
            reminderSentAt: new Date(),
          },
        });

        sent++;
        logger.info(`Booking reminder sent: ${booking.customerName} at ${booking.client.businessName} for ${booking.bookingDate}`);
      } catch (error) {
        logger.error(`Failed to send booking reminder for ${booking.id}:`, error);
      }
    }

    if (sent > 0) {
      logger.info(`[REMINDERS] Sent ${sent} booking reminders`);
    }

    return sent;
  }

  // ═══════════════════════════════════════════════════════════
  // PROCESS NO-SHOW FOLLOW-UPS - 2h after missed bookings
  // ═══════════════════════════════════════════════════════════
  async processNoShowFollowUps(): Promise<number> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find confirmed bookings from last 24h that haven't been marked as completed
    const potentialNoShows = await prisma.clientBooking.findMany({
      where: {
        bookingDate: {
          gte: yesterday,
          lte: twoHoursAgo,
        },
        status: 'confirmed', // Still confirmed = likely no-show
        customerEmail: { not: null },
      },
      include: {
        client: {
          select: {
            businessName: true,
            planType: true,
            contactPhone: true,
            vapiPhoneNumber: true,
          },
        },
      },
      take: 20,
    });

    let processed = 0;

    for (const booking of potentialNoShows) {
      if (!['pro', 'enterprise'].includes(booking.client.planType)) continue;

      try {
        // Mark as no-show
        await prisma.clientBooking.update({
          where: { id: booking.id },
          data: { status: 'no_show' },
        });

        // Send reschedule email
        await emailService.sendRescheduleEmail({
          to: booking.customerEmail!,
          customerName: booking.customerName,
          businessName: booking.client.businessName,
          originalDate: booking.bookingDate,
          businessPhone: booking.client.contactPhone || booking.client.vapiPhoneNumber || '',
        });

        processed++;
      } catch (error) {
        logger.error(`Failed to process no-show for booking ${booking.id}:`, error);
      }
    }

    return processed;
  }
}

export const bookingReminderService = new BookingReminderService();
