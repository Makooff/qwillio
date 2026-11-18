import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { googleCalendarService } from './google-calendar.service';
import { outlookCalendarService } from './outlook-calendar.service';
import { businessTimezone, zonedInstant, ymdOf } from '../utils/zoned-time';

/**
 * ── QUEL AGENDA FAIT FOI ────────────────────────────────────────────────────
 *
 * Un client peut désormais avoir Google ET Outlook connectés. Il faut donc
 * décider lequel reçoit les rendez-vous, et le décider UNE fois, au même
 * endroit — sinon chaque appelant choisit selon son humeur et les deux agendas
 * divergent sans que personne ne s'en aperçoive.
 *
 * ── LA RÈGLE, ET POURQUOI CELLE-LÀ ──────────────────────────────────────────
 *
 * `calendarProvider` sur la fiche client dit lequel est actif. Il est posé à la
 * connexion d'un agenda et remis à null à la déconnexion. On ne le DEVINE pas :
 * un client qui branche Outlook après Google veut manifestement Outlook, mais
 * un client qui a gardé les deux jetons (parce qu'une déconnexion a échoué, ou
 * parce qu'il hésite) doit garder le choix qu'il a fait, pas celui qu'on
 * suppose.
 *
 * Le repli, lui, se déduit de ce qui existe : un client qui n'a jamais touché à
 * `calendarProvider` mais possède un jeton Google est un client Google — c'est
 * l'état de tous les comptes créés avant ce jour. Exiger la colonne aurait
 * débranché chaque client existant du jour au lendemain.
 */

export type CalendarProvider = 'google' | 'outlook';

export interface ResolvedCalendar {
  provider: CalendarProvider;
  /** Le jeton de rafraîchissement, à passer au service concerné. */
  refreshToken: string;
  /** L'identifiant de calendrier propre au fournisseur (`primary` par défaut). */
  calendarId: string | null;
}

/** Les colonnes d'agenda d'un client, telles qu'on les lit en base. */
export interface ClientCalendarFields {
  calendarProvider?: string | null;
  googleCalendarRefreshToken?: string | null;
  googleCalendarId?: string | null;
  outlookRefreshToken?: string | null;
  outlookCalendarId?: string | null;
}

/**
 * Rend l'agenda actif d'un client, ou `null` s'il n'en a branché aucun.
 *
 * `null` n'est pas une erreur : beaucoup de clients n'ont pas d'agenda, et tout
 * le code appelant sait déjà travailler sans.
 */
export function resolveCalendar(client: ClientCalendarFields | null | undefined): ResolvedCalendar | null {
  if (!client) return null;

  const stored = (client.calendarProvider || '').trim().toLowerCase();
  const google = client.googleCalendarRefreshToken
    ? { provider: 'google' as const, refreshToken: client.googleCalendarRefreshToken, calendarId: client.googleCalendarId ?? 'primary' }
    : null;
  const outlook = client.outlookRefreshToken
    ? { provider: 'outlook' as const, refreshToken: client.outlookRefreshToken, calendarId: client.outlookCalendarId ?? 'primary' }
    : null;

  /* Le choix explicite d'abord. S'il désigne un fournisseur dont le jeton a
     disparu — déconnexion à moitié faite, jeton effacé à la main — on retombe
     sur l'autre plutôt que de rendre `null` : mieux vaut écrire dans le mauvais
     agenda du client que n'écrire nulle part, parce que le premier cas se voit
     et se corrige, le second laisse un rendez-vous fantôme. */
  if (stored === 'google') return google ?? outlook ?? null;
  if (stored === 'outlook') return outlook ?? google ?? null;

  return google ?? outlook ?? null;
}

/** Vrai quand le client a au moins un agenda exploitable. */
export function hasCalendar(client: ClientCalendarFields | null | undefined): boolean {
  return resolveCalendar(client) !== null;
}

/**
 * Le libellé affiché au client, et le nom du fournisseur au sens du catalogue
 * d'intégrations (`google-calendar` / `outlook-calendar`).
 */
export function calendarProviderLabel(provider: CalendarProvider): string {
  return provider === 'outlook' ? 'Outlook / Microsoft 365' : 'Google Agenda';
}

export function calendarIntegrationId(provider: CalendarProvider): string {
  return provider === 'outlook' ? 'outlook-calendar' : 'google-calendar';
}

/**
 * ── Les quatre gestes, en miroir des deux fournisseurs ──────────────────────
 *
 * Chacun rend la même chose quel que soit l'agenda, pour que l'appelant n'ait
 * jamais à écrire `if (provider === 'outlook')`. C'est la raison d'être de ce
 * fichier : le jour où un troisième agenda arrive, il n'y a qu'ici à toucher.
 */

/** Un identifiant d'évènement rangé en base n'a de sens que pour SON agenda. */
export interface StoredEventRef {
  /** L'identifiant tel que le fournisseur le connaît. */
  eventId: string;
  /** Chez qui il a été créé. Absent = écrit avant ce jour, fournisseur inconnu. */
  provider?: string | null;
}

/* ── Référence étiquetée ─────────────────────────────────────────────────────
 *
 * Une seule colonne `googleEventId` sert aux deux fournisseurs. Sans
 * attribution, une annulation après bascule de fournisseur visait le mauvais
 * agenda (404 silencieux) et l'événement survivait. On étiquette donc la
 * référence : `outlook:<id>` chez Outlook, `google:<id>` chez Google, et
 * l'identifiant nu ne désigne désormais QUE les lignes écrites avant
 * l'étiquetage (fournisseur inconnu). Aucune migration de schéma requise :
 * toutes les lignes existantes restent décodées comme « legacy » et sont
 * traitées en tournant chez les fournisseurs disponibles. */
const OUTLOOK_EVENT_TAG = 'outlook:';
const GOOGLE_EVENT_TAG = 'google:';

/** Range l'identifiant rendu par un fournisseur dans la colonne partagée. */
export function storeEventRef(eventId: string, provider: CalendarProvider): string {
  return provider === 'outlook' ? `${OUTLOOK_EVENT_TAG}${eventId}` : `${GOOGLE_EVENT_TAG}${eventId}`;
}

/** Lit la colonne partagée. `provider: null` = legacy, fournisseur inconnu. */
export function parseStoredEventRef(stored: string): { eventId: string; provider: CalendarProvider | null } {
  if (stored.startsWith(OUTLOOK_EVENT_TAG)) {
    return { eventId: stored.slice(OUTLOOK_EVENT_TAG.length), provider: 'outlook' };
  }
  if (stored.startsWith(GOOGLE_EVENT_TAG)) {
    return { eventId: stored.slice(GOOGLE_EVENT_TAG.length), provider: 'google' };
  }
  return { eventId: stored, provider: null };
}

/**
 * L'agenda où un évènement donné a été posé.
 *
 * Un rendez-vous créé sous Google puis relu alors que le client a basculé sur
 * Outlook doit être supprimé CHEZ GOOGLE. Utiliser l'agenda actif pour cela
 * ferait un 404 silencieux, et le rendez-vous resterait dans l'ancien agenda
 * après annulation — l'appelant croirait avoir annulé.
 */
export function calendarForEvent(
  client: ClientCalendarFields | null | undefined,
  event: StoredEventRef,
): ResolvedCalendar | null {
  const active = resolveCalendar(client);
  if (!client) return null;
  const owner = (event.provider || '').trim().toLowerCase();

  if (owner === 'outlook' && client.outlookRefreshToken) {
    return { provider: 'outlook', refreshToken: client.outlookRefreshToken, calendarId: client.outlookCalendarId ?? 'primary' };
  }
  if (owner === 'google' && client.googleCalendarRefreshToken) {
    return { provider: 'google', refreshToken: client.googleCalendarRefreshToken, calendarId: client.googleCalendarId ?? 'primary' };
  }
  /* Pas de propriétaire connu (lignes écrites avant l'étiquetage). On ne
     devine PAS Google : les lignes Outlook d'avant ce jour stockent aussi un
     identifiant nu. C'est deleteBookingEvent qui tente les agendas
     disponibles, dans l'ordre, au lieu de parier sur un seul. */
  return active;
}

export interface BookingLike {
  bookingDate: Date | string;
  bookingTime?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceType?: string | null;
  partySize?: number | null;
  specialRequests?: string | null;
}

/**
 * Les instants d'un rendez-vous, dans le fuseau de l'ENTREPRISE.
 *
 * Exporté et partagé : Google et Outlook doivent voir exactement le même
 * créneau. Deux calculs séparés finiraient par diverger d'une heure le jour où
 * quelqu'un corrige un seul des deux — et c'est le genre d'écart qui ne se voit
 * qu'en production, sur un rendez-vous manqué.
 */
export function bookingInstants(
  booking: BookingLike,
  client: Record<string, unknown> | null | undefined,
  durationMinutes = 60,
): { startIso: string; endIso: string; timeZone: string } {
  /* L'heure du rendez-vous est celle de l'ENTREPRISE, pas du serveur.
     `setHours(9)` posait 9 h dans le fuseau du processus: « neuf heures »
     demandé, 15 h dans l'agenda (appel réel, 12/09/2026). */
  const timeZone = businessTimezone(client ?? {});
  const start = zonedInstant(ymdOf(new Date(booking.bookingDate)), booking.bookingTime || '09:00', timeZone);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { startIso: start.toISOString(), endIso: end.toISOString(), timeZone };
}

/** Le corps de l'évènement, identique chez les deux fournisseurs. */
export function bookingDescription(booking: BookingLike): string {
  return [
    booking.customerName ? `Client : ${booking.customerName}` : null,
    booking.customerPhone ? `Téléphone : ${booking.customerPhone}` : null,
    booking.customerEmail ? `Email : ${booking.customerEmail}` : null,
    booking.partySize ? `Personnes : ${booking.partySize}` : null,
    booking.specialRequests ? `Demandes : ${booking.specialRequests}` : null,
    '',
    'Pris par la réceptionniste Qwillio',
  ].filter(Boolean).join('\n');
}

/** Le titre de l'évènement, identique chez les deux fournisseurs. */
export function bookingSubject(booking: BookingLike): string {
  return `${booking.serviceType || 'Rendez-vous'} - ${booking.customerName || 'Client'}`;
}

/**
 * Pose le rendez-vous dans l'agenda actif du client, et rend l'identifiant
 * rangé avec son propriétaire.
 *
 * Rend `null` quand le client n'a pas d'agenda : ce n'est pas un échec, c'est
 * une absence d'intégration.
 */
export async function createBookingEvent(
  client: ClientCalendarFields & Record<string, unknown>,
  booking: BookingLike,
): Promise<{ eventId: string; provider: CalendarProvider } | null> {
  const target = resolveCalendar(client);
  if (!target) return null;

  const { startIso, endIso, timeZone } = bookingInstants(booking, client);
  const subject = bookingSubject(booking);
  const description = bookingDescription(booking);

  if (target.provider === 'outlook') {
    const accessToken = await outlookCalendarService.getAccessTokenFromRefresh(target.refreshToken);
    const eventId = await outlookCalendarService.createEvent(accessToken, {
      subject,
      bodyText: description,
      startIso,
      endIso,
      timeZone,
      attendees: booking.customerEmail ? [booking.customerEmail] : [],
    }, target.calendarId);
    return { eventId, provider: 'outlook' };
  }

  /* Google garde son implémentation d'origine (`createEventFromBooking`), qui
     relit le rendez-vous en base et range elle-même son identifiant. On ne la
     double pas ici: deux écritures pour un même rendez-vous seraient deux
     occasions de divergence. */
  const { googleCalendarService: gcal } = await import('./google-calendar.service');
  const accessToken = await gcal.getAccessTokenFromRefresh(target.refreshToken);
  const created = await gcal.createEventFromBooking(String((booking as any).id), accessToken, target.calendarId || 'primary');
  const eventId = typeof created === 'string' ? created : (created as any)?.id;
  if (!eventId) return null;
  return { eventId, provider: 'google' };
}

/**
 * Le résultat d'une suppression fournisseur-aware :
 *  - `removed`        — l'événement a été retiré (chez le propriétaire, ou chez
 *                       un des fournisseurs tentés pour une référence legacy) ;
 *  - `already-gone`   — 404/410 chez TOUS les fournisseurs tentés : plus rien à
 *                       retirer, la référence peut être effacée sans risque ;
 *  - `unreachable`    — le fournisseur d'origine est connu mais son jeton a
 *                       disparu : aucun appel n'a été fait, la référence doit
 *                       survivre pour un nettoyage manuel futur.
 *
 * Un vrai échec (5xx, réseau) PROPAGE l'erreur : l'appelant décide, et la
 * référence n'est jamais effacée sur un échec.
 */
export type DeleteEventOutcome = 'removed' | 'already-gone' | 'unreachable';

/**
 * Retire le rendez-vous, en s'adressant à l'agenda qui l'a posé.
 *
 * Accepte une référence étiquetée brute (la valeur de `googleEventId`) ou un
 * `StoredEventRef`. Propriétaire connu → un SEUL agenda visé : on ne touche
 * jamais l'autre, donc pas de suppression large quand le propriétaire est
 * certain. Propriétaire inconnu (lignes legacy) → seul l'agenda unique connecté
 * peut être tenté. Si les deux sont connectés, refus sûr `unreachable` : une
 * référence opaque ne permet pas de choisir ni de supprimer chez les deux.
 *
 * La rotation du jeton Outlook est réécrite en base pendant la suppression :
 * Microsoft tourne son refresh token à chaque renouvellement, et l'oublier
 * tue l'intégration à l'heure suivante sur TOUS les chemins qui passent ici
 * (annulation portail, agent, voice-core, déplacement).
 */
export async function deleteBookingEvent(
  client: ClientCalendarFields,
  event: StoredEventRef | string,
): Promise<DeleteEventOutcome> {
  const ref = typeof event === 'string' ? parseStoredEventRef(event) : event;
  const owner = (ref.provider || '').trim().toLowerCase();

  const google = client?.googleCalendarRefreshToken
    ? { provider: 'google' as const, refreshToken: client.googleCalendarRefreshToken, calendarId: client.googleCalendarId ?? 'primary' }
    : null;
  const outlook = client?.outlookRefreshToken
    ? { provider: 'outlook' as const, refreshToken: client.outlookRefreshToken, calendarId: client.outlookCalendarId ?? 'primary' }
    : null;

  const targets: Array<{ provider: 'google' | 'outlook'; refreshToken: string; calendarId: string }> = [];
  if (owner === 'outlook') {
    if (outlook) targets.push(outlook);
  } else if (owner === 'google') {
    if (google) targets.push(google);
  } else {
    // Opaque IDs do not establish ownership when both calendars are connected.
    if (google && outlook) return 'unreachable';
    if (google) targets.push(google);
    if (outlook) targets.push(outlook);
  }

  if (targets.length === 0) return 'unreachable';

  /* Le renouvellement du jeton Outlook rend un NOUVEAU refresh token qu'il
     faut réécrire immédiatement, sinon l'intégration meurt à l'heure. Le
     service Outlook appelle ce callback dès qu'il en reçoit un. */
  const clientId = typeof (client as { id?: unknown }).id === 'string' ? (client as { id: string }).id : null;
  const persistRotatedToken = async (next: string): Promise<void> => {
    if (!clientId) return;
    await prisma.client.update({ where: { id: clientId }, data: { outlookRefreshToken: next } });
  };

  let lastError: unknown = null;
  for (const target of targets) {
    try {
      if (target.provider === 'outlook') {
        const accessToken = await outlookCalendarService.getAccessTokenFromRefresh(target.refreshToken, persistRotatedToken);
        const deleted = await outlookCalendarService.deleteEvent(accessToken, ref.eventId, target.calendarId);
        if (deleted) return 'removed';
        /* 404 : l'événement n'est pas chez Outlook — l'agenda suivant reste
           tenté pour une référence legacy. */
      } else {
        const { googleCalendarService: gcal } = await import('./google-calendar.service');
        const accessToken = await gcal.getAccessTokenFromRefresh(target.refreshToken);
        const deleted = await gcal.deleteEvent(ref.eventId, accessToken, target.calendarId || 'primary');
        if (deleted) return 'removed';
      }
    } catch (error) {
      /* Un vrai échec (5xx, réseau) est mémorisé. Pour une référence legacy,
         l'agenda suivant reste tenté : l'événement peut être chez lui. Si
         aucun agenda ne l'a retiré, l'erreur est propagée. */
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  /* Tous les fournisseurs tentés ont répondu 404/410 : l'événement n'existe
     plus nulle part, la référence peut être effacée sans risque. */
  return 'already-gone';
}

/** Delete the original event before recreating a moved booking. A failed delete
 * retains the reference and leaves the row pending for the reconciliation job. */
export async function moveBookingEvent(
  clientId: string,
  bookingId: string,
  oldEventId: string | null,
  synchronize: () => Promise<boolean>,
): Promise<boolean> {
  try {
    if (oldEventId) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) throw new Error('Calendar owner unavailable');
      const deleted = await deleteBookingEvent(client, oldEventId);
      if (deleted === 'unreachable') throw new Error('Calendar event owner unresolved or disconnected');
      const cleared = await prisma.clientBooking.updateMany({
        where: { id: bookingId, clientId, status: 'confirmed', googleEventId: oldEventId },
        data: { googleEventId: null },
      });
      // An intervening cancellation/move must not recreate an event.
      if (cleared.count !== 1) return false;
    }
    return await synchronize();
  } catch (error) {
    logger.warn(`[Calendar] move pending (${bookingId}): ${(error as Error).message}`);
    await prisma.clientBooking.updateMany({
      where: { id: bookingId, clientId, status: 'confirmed' },
      data: { calendarSyncAttempts: { increment: 1 } },
    }).catch(() => undefined);
    return false;
  }
}

/** Les prochains rendez-vous, pour l'aperçu du portail. */
export async function listUpcoming(
  client: ClientCalendarFields,
  maxResults = 3,
): Promise<OutlookEventLike[]> {
  const target = resolveCalendar(client);
  if (!target) return [];

  if (target.provider === 'outlook') {
    return outlookCalendarService.listUpcomingEvents(target.refreshToken, target.calendarId || 'primary', maxResults);
  }
  const { googleCalendarService: gcal } = await import('./google-calendar.service');
  return gcal.listUpcomingEvents(target.refreshToken, target.calendarId || 'primary', maxResults) as Promise<OutlookEventLike[]>;
}

export interface OutlookEventLike {
  id: string;
  summary: string;
  start: string | null;
}

export const calendarProviderService = {
  resolveCalendar,
  hasCalendar,
  calendarForEvent,
  createBookingEvent,
  deleteBookingEvent,
  storeEventRef,
  parseStoredEventRef,
  listUpcoming,
  calendarProviderLabel,
  calendarIntegrationId,
  bookingInstants,
  bookingSubject,
  bookingDescription,
};
