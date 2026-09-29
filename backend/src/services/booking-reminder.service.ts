import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { discordService } from './discord.service';
import { smsService } from './sms.service';
import { businessTimezone, ymdOf, zonedInstant } from '../utils/zoned-time';

/**
 * L'INSTANT réel d'un rendez-vous, ou null si l'heure est illisible.
 *
 * `bookingDate` porte le JOUR, posé à MIDI UTC — une convention voulue, qui
 * fait que l'index unique anti-double-réservation compare des dates
 * comparables. L'heure vit à part, en chaîne, et elle est MURALE: « 14:30 »
 * veut dire 14 h 30 chez le client, pas en UTC.
 *
 * Comparer `bookingDate` à `Date.now()` — ce que faisait la fenêtre de rappel
 * — revient donc à comparer midi à l'heure qu'il est. Conséquence mesurable:
 * un rendez-vous AUJOURD'HUI à 20 h porte une date à midi, déjà passée dès
 * 13 h, et ne reçoit JAMAIS de rappel. Dans l'autre sens, un rendez-vous
 * après-demain matin peut entrer dans la fenêtre trop tôt. Le décalage va
 * jusqu'à douze heures, et personne ne s'en aperçoit: un rappel qui manque
 * ne fait aucun bruit.
 *
 * `null` plutôt qu'une heure par défaut: rappeler à midi un rendez-vous dont
 * on ignore l'heure, c'est affirmer quelque chose de faux à quelqu'un qui
 * nous croira.
 */
export function bookingInstant(
  booking: { bookingDate: Date; bookingTime: string | null },
  timezone: string,
): Date | null {
  const raw = (booking.bookingTime ?? '').trim();
  /* « 14:30 », « 9:05 », et la forme parlée « 14h30 » que le portail laisse
     parfois passer. Le reste est illisible, et le dire vaut mieux que le
     deviner. */
  const m = /^(\d{1,2})[:hH](\d{2})$/.exec(raw);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const hhmm = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const instant = zonedInstant(ymdOf(booking.bookingDate), hhmm, timezone);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Au-delà, il est trop tôt pour rappeler. */
const WINDOW_MS = 24 * 60 * 60 * 1000;
/** En deçà, le rappel ne ferait que doubler la confirmation qui vient de partir. */
const FLOOR_MS = 2 * 60 * 60 * 1000;

/** Avant ce délai APRÈS l'heure dite, l'absence n'est pas constatée. */
const NO_SHOW_FLOOR_MS = 2 * 60 * 60 * 1000;
/** Au-delà, le rendez-vous est trop vieux pour qu'une relance ait du sens. */
const NO_SHOW_WINDOW_MS = 24 * 60 * 60 * 1000;

export class BookingReminderService {

  // ═══════════════════════════════════════════════════════════
  // PROCESS BOOKING REMINDERS - Called by CRON every hour
  // Sends email reminders to customers 24h before their booking
  // ═══════════════════════════════════════════════════════════
  async processBookingReminders(now: Date = new Date()): Promise<number> {
    /* LA PRÉSÉLECTION PORTE SUR LE JOUR, LARGE.
       Le jour est à midi UTC et l'heure est murale, donc un rendez-vous à
       portée de rappel peut porter la date d'hier comme celle de demain selon
       le fuseau du commerce. On ratisse donc ±36 h et on tranche en mémoire,
       une fois l'instant reconstruit: filtrer finement en SQL demanderait au
       moteur de connaître le fuseau de chaque client. */
    const margin = 36 * 60 * 60 * 1000;

    const upcomingBookings = await prisma.clientBooking.findMany({
      where: {
        bookingDate: {
          gte: new Date(now.getTime() - margin),
          lte: new Date(now.getTime() + margin),
        },
        status: 'confirmed',
        /* PLUS AUCUN FILTRE DE FORFAIT: LE RAPPEL EST DANS LE SOCLE.
           Il était réservé à Pro et Enterprise par un tableau écrit ici
           même, dans le service d'envoi — pas dans `plan-features.ts`, le
           seul endroit où un droit de forfait a le droit de vivre. La
           restriction ne figurait donc ni dans ce qui est vendu ni dans ce
           qui est autorisé, et un commerce en Solo perdait le message qui
           fait revenir ses clients sans l'avoir jamais vu proposé.
           Le plafond n'est plus le forfait mais le `take` plus bas:
           cinquante rappels par passage horaire, et les lignes servies
           sortent du `OR` au passage suivant. */
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
            /* Ce qu'il faut pour connaître le fuseau du commerce, et donc
               l'heure réelle du rendez-vous. */
            onboardingData: true,
            country: true,
            city: true,
            agentLanguage: true,
          },
        },
      },
      take: 50,
      orderBy: { bookingDate: 'asc' },
    });

    if (upcomingBookings.length === 0) return 0;

    let sent = 0;

    for (const booking of upcomingBookings) {
      /* LA FENÊTRE, SUR L'INSTANT RÉEL ET PLUS SUR LA DATE À MIDI.
         Au-dessus de 24 h: trop tôt. En dessous de 2 h: trop tard, et surtout
         inutile — un rendez-vous pris le matin pour l'après-midi vient de
         déclencher une confirmation, et un « rappel » une heure après double
         le message sans rien apprendre à personne. */
      const start = bookingInstant(booking, businessTimezone(booking.client));
      if (!start) {
        logger.warn(`[REMINDERS] ${booking.id}: heure illisible (${booking.bookingTime}), pas de rappel`);
        continue;
      }
      const remaining = start.getTime() - now.getTime();
      if (remaining > WINDOW_MS || remaining <= FLOOR_MS) continue;

      try {
        /* ON RÉSERVE AVANT D'ENVOYER, ET ON REND SI L'ENVOI RATE.
           Deux instances lisent les mêmes rendez-vous à la même minute: sans
           réservation gardée sur le drapeau, le client reçoit son rappel en
           double. `updateMany` avec le drapeau dans le `where` fait que la
           seconde instance ne compte aucune ligne et n'envoie rien.
           Et si l'envoi échoue, on rend la ligne: sans ça, une panne d'une
           minute effacerait les rappels de la journée — marqués envoyés,
           jamais partis. */
        if (booking.customerEmail && !booking.reminderSent) {
          const claimed = await prisma.clientBooking.updateMany({
            where: { id: booking.id, reminderSent: false },
            data: { reminderSent: true, reminderSentAt: new Date() },
          });
          if (claimed.count > 0) {
            try {
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
            } catch (error) {
              await prisma.clientBooking
                .updateMany({ where: { id: booking.id }, data: { reminderSent: false, reminderSentAt: null } })
                .catch(() => {});
              throw error;
            }
          }
        }

        if (booking.customerPhone && !booking.smsReminderSent) {
          const claimed = await prisma.clientBooking.updateMany({
            where: { id: booking.id, smsReminderSent: false },
            data: { smsReminderSent: true },
          });
          if (claimed.count > 0) {
            let smsSent = false;
            try {
              smsSent = await smsService.sendBookingReminderSMS({
                customerPhone: booking.customerPhone,
                customerName: booking.customerName,
                businessName: booking.client.businessName,
                bookingDate: booking.bookingDate.toISOString(),
                bookingTime: booking.bookingTime || null,
                serviceType: booking.serviceType || null,
              });
            } catch (error) {
              logger.error(`[REMINDERS] SMS refusé pour ${booking.id}: ${(error as Error).message}`);
            }
            if (!smsSent) {
              await prisma.clientBooking
                .updateMany({ where: { id: booking.id }, data: { smsReminderSent: false } })
                .catch(() => {});
            }
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
  async processNoShowFollowUps(now: Date = new Date()): Promise<number> {
    /* MÊME PRÉSÉLECTION LARGE QUE LES RAPPELS, ET POUR LA MÊME RAISON.
       Le jour est à midi UTC, l'heure est murale: on ratisse ±36 h et on
       tranche en mémoire, une fois l'instant reconstruit. */
    const margin = 36 * 60 * 60 * 1000;

    const potentialNoShows = await prisma.clientBooking.findMany({
      where: {
        bookingDate: {
          gte: new Date(now.getTime() - margin),
          lte: new Date(now.getTime() + margin),
        },
        status: 'confirmed', // Toujours confirmé = absence probable
        customerEmail: { not: null },
        /* PLUS DE FILTRE DE FORFAIT, ET IL ÉTAIT DOUBLEMENT NUISIBLE.
           Il vivait en mémoire, APRÈS le `take: 20`: vingt rendez-vous Solo
           dans les dernières heures remplissaient le lot et aucun client Pro
           n'était relancé. Et comme le `continue` sautait aussi le passage
           en `no_show`, un rendez-vous manqué chez un client Solo restait
           « confirmé » pour toujours: son taux d'absence affichait zéro. */
      },
      include: {
        client: {
          select: {
            businessName: true,
            planType: true,
            contactPhone: true,
            vapiPhoneNumber: true,
            /* De quoi connaître le fuseau, donc l'heure réelle. */
            onboardingData: true,
            country: true,
            city: true,
            agentLanguage: true,
          },
        },
      },
      take: 20,
      orderBy: { bookingDate: 'asc' },
    });

    let processed = 0;

    for (const booking of potentialNoShows) {
      /* ON COMPARAIT MIDI À L'HEURE QU'IL EST, ET ON ACCUSAIT DES GENS À TORT.
         La fenêtre lisait « il y a plus de deux heures » sur `bookingDate`,
         qui porte le JOUR posé à midi UTC — pas sur le rendez-vous. Un
         rendez-vous AUJOURD'HUI à 20 h basculait donc en `no_show` dès 14 h,
         et son client recevait un mail lui proposant de reprendre un
         rendez-vous qu'il n'avait pas encore manqué, six heures avant
         l'heure dite. Le commerce, lui, voyait son créneau libéré.
         La fenêtre porte maintenant sur l'instant réel. */
      const start = bookingInstant(booking, businessTimezone(booking.client));
      if (!start) {
        logger.warn(`[NO-SHOW] ${booking.id}: heure illisible (${booking.bookingTime}), pas de relance`);
        continue;
      }
      const elapsed = now.getTime() - start.getTime();
      if (elapsed < NO_SHOW_FLOOR_MS || elapsed > NO_SHOW_WINDOW_MS) continue;

      try {
        /* LE STATUT SERT DE RÉSERVATION: `updateMany` gardé sur `confirmed`.
           Deux instances à la même minute, et le client reçoit deux fois le
           même mail; la seconde ne compte aucune ligne et s'arrête.
           On ne REND pas la ligne si le mail échoue, contrairement aux
           rappels: `no_show` est un fait constaté, le mail n'est qu'une
           courtoisie. Repasser le rendez-vous en « confirmé » pour un
           incident Resend mentirait sur ce qui s'est passé. */
        const claimed = await prisma.clientBooking.updateMany({
          where: { id: booking.id, status: 'confirmed' },
          data: { status: 'no_show' },
        });
        if (claimed.count === 0) continue;

        try {
          await emailService.sendRescheduleEmail({
            to: booking.customerEmail!,
            customerName: booking.customerName,
            businessName: booking.client.businessName,
            originalDate: booking.bookingDate,
            businessPhone: booking.client.contactPhone || booking.client.vapiPhoneNumber || '',
          });
        } catch (error) {
          logger.error(`[NO-SHOW] ${booking.id} marqué absent, mail de relance non parti: ${(error as Error).message}`);
        }

        processed++;
      } catch (error) {
        logger.error(`Failed to process no-show for booking ${booking.id}:`, error);
      }
    }

    return processed;
  }
}

export const bookingReminderService = new BookingReminderService();
