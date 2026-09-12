import { prisma } from '../config/database';
import { businessTimezone, zonedInstant, ymdOf } from '../utils/zoned-time';

/**
 * Le rendez-vous de l'appelant en fichier .ics, tel que le SMS de
 * confirmation le lie.
 *
 * Google, Apple et Outlook ouvrent tous un .ics: c'est le seul format qui
 * marche quel que soit le téléphone, là où un lien « calendar.google.com »
 * suppose un compte Google. L'instant est posé dans le fuseau de l'entreprise
 * (`zonedInstant`), puis écrit en UTC: un .ics en UTC se lit juste partout.
 */
function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export async function bookingIcs(bookingId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const booking = await prisma.clientBooking.findUnique({
    where: { id: bookingId },
    include: { client: { select: { businessName: true, address: true, city: true, postalCode: true, country: true, onboardingData: true, agentLanguage: true, contactPhone: true } } },
  });
  if (!booking || booking.status === 'cancelled') return null;

  const timezone = businessTimezone(booking.client);
  const start = zonedInstant(ymdOf(new Date(booking.bookingDate)), booking.bookingTime || '09:00', timezone);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const business = booking.client.businessName;
  const location = [booking.client.address, booking.client.postalCode, booking.client.city].filter(Boolean).join(' ');
  const summary = booking.serviceType ? `${booking.serviceType} · ${business}` : business;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Qwillio//Rendez-vous//FR',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@qwillio.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    location ? `LOCATION:${icsEscape(location)}` : null,
    `DESCRIPTION:${icsEscape(`Rendez-vous chez ${business}${booking.client.contactPhone ? ` · ${booking.client.contactPhone}` : ''}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n';
}
