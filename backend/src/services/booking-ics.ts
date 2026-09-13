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

export interface BookingEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  timezone: string;
}

/** Le rendez-vous tel qu'un agenda le reçoit, quel que soit le format. */
export async function bookingEvent(bookingId: string): Promise<BookingEvent | null> {
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
  const description = `Rendez-vous chez ${business}${booking.client.contactPhone ? ` · ${booking.client.contactPhone}` : ''}`;
  return { id: booking.id, summary, start, end, location, description, timezone };
}

/**
 * Le lien « ajouter à Google Agenda », gabarit public de Google: il ouvre
 * l'application Agenda du téléphone avec le rendez-vous pré-rempli, ce qu'un
 * fichier .ics ne fait pas sur Android (« c'est comme ça », 13/09: le lien
 * .ics reçu par SMS téléchargeait un fichier au lieu d'ouvrir l'agenda).
 * Les instants sont en UTC (suffixe Z) et `ctz` donne le fuseau d'affichage.
 */
export function googleCalendarTemplateUrl(event: Omit<BookingEvent, 'id'>): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${icsStamp(event.start)}/${icsStamp(event.end)}`,
    details: event.description,
    ctz: event.timezone,
  });
  if (event.location) q.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export async function bookingIcs(bookingId: string): Promise<string | null> {
  const event = await bookingEvent(bookingId);
  if (!event) return null;
  const { start, end, summary, location, description } = event;
  const booking = { id: event.id };

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
    `DESCRIPTION:${icsEscape(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n';
}
