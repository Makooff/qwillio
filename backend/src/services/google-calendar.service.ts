import { minutesOf } from '../utils/opening-hours';
import { createHash } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { businessTimezone, zonedInstant, ymdOf } from '../utils/zoned-time';

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

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

    /* L'heure du rendez-vous est celle de l'ENTREPRISE, pas du serveur.
       `setHours(9)` posait 9 h dans le fuseau du processus: « neuf heures »
       demandé, 15 h dans l'agenda (appel réel, 12/09/2026). */
    const clientTimezone = businessTimezone(booking.client ?? {});
    const startDate = zonedInstant(ymdOf(new Date(booking.bookingDate)), booking.bookingTime || '09:00', clientTimezone);

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
        timeZone: clientTimezone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: clientTimezone,
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

  /** Supprime un événement SANS toucher à la réservation: le déplacement recrée le sien. */
  async deleteEvent(googleEventId: string, accessToken: string, calendarId = 'primary'): Promise<void> {
    const r = await fetch(`${this.baseUrl}/calendars/${calendarId}/events/${googleEventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`Google event delete failed: ${r.status}`);
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
  async getAvailability(
    accessToken: string,
    calendarId = 'primary',
    date: Date,
    timezone = 'Europe/Brussels',
    /* La fenêtre d'ouverture DU JOUR, lue des horaires du portail. Avant, 9 h-17 h
       tous les jours: un rendez-vous a été pris un dimanche chez un commerce
       fermé le dimanche (12/09/2026). */
    window: { from: string; to: string } = { from: '09:00', to: '17:00' },
  ) {
    /* Le jour et ses créneaux sont posés dans le fuseau de l'ENTREPRISE: un
       « 09:00 » rendu ici est ce que l'appelant entendra, et il doit être 9 h
       chez le commerçant, pas chez le serveur. */
    const ymd = ymdOf(date);
    const dayStart = zonedInstant(ymd, '00:00', timezone);
    const dayEnd = new Date(zonedInstant(ymd, '23:59', timezone).getTime() + 59_999);

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

      // Créneaux d'une heure, de l'ouverture à la fermeture du jour.
      const availableSlots: string[] = [];
      const openAt = minutesOf(window.from) ?? 9 * 60;
      const closeAt = minutesOf(window.to) ?? 17 * 60;
      for (let start = openAt; start + 60 <= closeAt; start += 60) {
        const hhmm = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
        const slotStart = zonedInstant(ymd, hhmm, timezone);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

        const isBusy = busySlots.some((busy: any) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        if (!isBusy) availableSlots.push(hhmm);
      }

      return availableSlots;
    } catch (error) {
      logger.error('Failed to get calendar availability:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // OAUTH — connect a client's Google Calendar
  // ═══════════════════════════════════════════════════════════
  private getOAuthClient() {
    return new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_OAUTH_REDIRECT_URI,
    );
  }

  /** Consent URL the frontend redirects the client to. */
  getConnectUrl(state: string) {
    return this.getOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: OAUTH_SCOPES,
      include_granted_scopes: true,
      state,
    });
  }

  /** Exchange the redirect `code` for tokens; returns the refresh token. */
  async exchangeCode(code: string): Promise<string> {
    const { tokens } = await this.getOAuthClient().getToken(code);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token');
    }
    return tokens.refresh_token;
  }

  /** Short-lived access token from a stored refresh token. */
  /**
   * LE JETON D'ACCÈS, FRAPPÉ UNE FOIS PAR HEURE ET NON PAR LECTURE.
   *
   * Relevé le 17/09/2026 sur un appel réel: `checkAvailability` à 4,0 s, puis
   * 12,6 s, 13,3 s et 15,5 s. Ce que l'appelant en dit: « il met du temps à
   * répondre donc répond en même temps que moi, c'est horrible ». L'agent pose
   * une question, l'outil tourne quinze secondes, et l'appelant parle pendant
   * ce temps: la lenteur ne se contente pas de faire attendre, elle fabrique
   * le chevauchement.
   *
   * La cause était ici. `getOAuthClient()` rend un client NEUF à chaque appel,
   * donc `getAccessToken()` ne pouvait rien réutiliser et refaisait l'échange
   * complet avec Google. Chaque lecture d'agenda payait donc DEUX allers-retours
   * séquentiels vers Google depuis l'Oregon — frapper le jeton, puis lire —
   * alors que le premier vaut une heure.
   *
   * Le cache est en mémoire du processus, comme celui du spéculateur: ce jeton
   * ne doit pas s'écrire ailleurs. Il porte une MARGE, parce qu'un jeton qui
   * expire entre notre vérification et l'arrivée de la requête chez Google
   * rendrait un 401 qu'aucun appelant ne doit attendre. Et les demandes
   * concurrentes partagent la même frappe: sans ça, trois outils lancés
   * ensemble en déclenchent trois.
   */
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();
  private tokenPending = new Map<string, Promise<string>>();

  async getAccessTokenFromRefresh(refreshToken: string): Promise<string> {
    /* La clé est un condensé, jamais le secret: une Map se retrouve dans un
       vidage mémoire ou une inspection, et ce jeton ouvre l'agenda du client. */
    const key = createHash('sha256').update(refreshToken).digest('hex');
    const hit = this.tokenCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.token;

    const inFlight = this.tokenPending.get(key);
    if (inFlight) return inFlight;

    const mint = (async () => {
      const client = this.getOAuthClient();
      client.setCredentials({ refresh_token: refreshToken });
      const { token } = await client.getAccessToken();
      if (!token) throw new Error('Failed to mint Google access token');
      /* L'échéance vient de Google quand il la donne; une heure sinon, ce que
         la documentation annonce. La marge de soixante secondes est retirée
         des deux côtés: mieux vaut refrapper une fois pour rien qu'obtenir un
         401 au milieu d'un appel. */
      const expiry = client.credentials.expiry_date;
      const expiresAt = (typeof expiry === 'number' && expiry > Date.now() ? expiry : Date.now() + 3600_000) - 60_000;
      this.tokenCache.set(key, { token, expiresAt });
      return token;
    })();

    this.tokenPending.set(key, mint);
    /* Retiré que la frappe réussisse ou non: une clé restée en vol bloquerait
       toute lecture d'agenda de ce client pour la vie du processus. */
    void mint.catch(() => {}).finally(() => this.tokenPending.delete(key));
    return mint;
  }

  /** Oublie le jeton d'un client. Sert au test, et à une révocation. */
  forgetAccessToken(refreshToken: string): void {
    const key = createHash('sha256').update(refreshToken).digest('hex');
    this.tokenCache.delete(key);
    this.tokenPending.delete(key);
  }

  /** Next upcoming events — proves read access and feeds the UI preview. */
  async listUpcomingEvents(refreshToken: string, calendarId = 'primary', maxResults = 3) {
    const accessToken = await this.getAccessTokenFromRefresh(refreshToken);
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    const response = await fetch(
      `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new Error(`Calendar events request failed: ${response.status}`);
    const data = await response.json() as any;
    return (data.items || []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary || '(sans titre)',
      start: ev.start?.dateTime || ev.start?.date || null,
    }));
  }

  /** Best-effort token revocation on disconnect. */
  async revokeToken(refreshToken: string) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (error) {
      logger.warn('Google token revocation failed (continuing):', error);
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
