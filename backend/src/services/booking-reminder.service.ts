import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { discordService } from './discord.service';
import { smsService } from './sms.service';
import { whatsAppService } from './whatsapp.service';

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
        OR: [
          { reminderSent: false, customerEmail: { not: null } },
          { smsReminderSent: false, customerPhone: { not: null } },
        ],
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
        // Send email reminder if not already sent
        if (booking.customerEmail && !booking.reminderSent) {
          await emailService.sendBookingReminderEmail({
            to: booking.customerEmail,
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
        }

        /* Rappel sur le téléphone: WhatsApp D'ABORD, SMS en repli.
         *
         * Les deux ne partent jamais ensemble. Un client qui reçoit le même
         * rappel deux fois ne se dit pas qu'on est prévenant, il se dit qu'on
         * bricole — et le SMS est facturé au segment.
         *
         * WhatsApp passe en premier parce qu'en Belgique c'est le canal du
         * quotidien, qu'il affiche l'identité de l'expéditeur, et qu'il ne
         * coûte rien à l'unité. Mais il ne remplace pas le SMS: un message
         * WhatsApp n'arrive que si le destinataire a WhatsApp et a déjà une
         * conversation ouverte avec nous. D'où le repli, silencieux et
         * automatique.
         *
         * `smsReminderSent` garde son nom mais signifie désormais « rappel
         * téléphone envoyé, quel qu'en soit le canal »; `reminderChannel` dit
         * lequel, ce qui est la première question du support quand un client
         * affirme n'avoir rien reçu. */
        if (booking.customerPhone && !booking.smsReminderSent) {
          const payload = {
            customerPhone: booking.customerPhone,
            customerName: booking.customerName,
            businessName: booking.client.businessName,
            bookingDate: booking.bookingDate.toISOString(),
            bookingTime: booking.bookingTime || null,
            serviceType: booking.serviceType || null,
          };

          let channel: 'whatsapp' | 'sms' | null = null;

          if (await whatsAppService.sendBookingReminder(payload)) {
            channel = 'whatsapp';
          } else if (await smsService.sendBookingReminderSMS(payload)) {
            channel = 'sms';
          }

          if (channel) {
            await prisma.clientBooking.update({
              where: { id: booking.id },
              data: { smsReminderSent: true, reminderChannel: channel },
            });
          }
        }

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
