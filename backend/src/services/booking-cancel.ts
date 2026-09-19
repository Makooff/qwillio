import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { googleCalendarService } from './google-calendar.service';
import { realtimeContextService } from './voice/realtime-context.service';

/**
 * ANNULER UN RENDEZ-VOUS: une seule règle, pour le portail ET pour l'agent.
 *
 * ── Pourquoi ce fichier existe ─────────────────────────────────────────────
 *
 * Le portail savait annuler depuis le 13/09/2026. L'agent, lui, n'avait AUCUN
 * outil d'annulation: six outils, dont `rescheduleBooking`, et rien pour
 * annuler. Relevé sur un appel réel du 19/09/2026:
 *
 *   Appelant: « Je voudrais ANNULER celui du 22. »
 *   Agent:    « Votre rendez-vous du 22 septembre est DEPLACE au vendredi 25
 *               septembre à 14 heures. »
 *
 * Le modèle n'a pas désobéi: il a fait la chose la plus proche qu'il avait
 * sous la main, et l'a annoncée comme faite. C'est 6quindecies mot pour mot,
 * où l'agent sans outil de transfert proposait de prendre un message, « ce qui
 * ressemble à un choix ». Un agent privé d'un outil ne dit pas « je ne peux
 * pas »: il fait autre chose et le présente comme un succès.
 *
 * Pire que le geste manquant: la description de `lookupBooking` annonce
 * elle-même « to confirm, move or CANCEL one ». La surface d'outils PROMETTAIT
 * l'annulation. Et le retour de cet outil ne décrivait que le déplacement
 * (« S'IL VEUT LA DEPLACER... rescheduleBooking »), donc le seul chemin écrit
 * sous les yeux du modèle, au moment où il lit, était le mauvais.
 *
 * Ce que ça coûte quand personne ne regarde: le commerce garde un créneau que
 * le client croyait libéré, et le client reçoit un SMS de confirmation pour un
 * rendez-vous qu'il vient d'annuler.
 *
 * ── Pourquoi une fonction PARTAGÉE, et pas une copie ───────────────────────
 *
 * Parce que l'annulation n'est pas une écriture, c'en est QUATRE, et en oublier
 * une ne se voit pas tout de suite:
 *
 *   1. l'événement Google, sinon le gérant voit encore le rendez-vous;
 *   2. le statut en base, qui est ce que l'agent relit pour reconnaître un
 *      appelant (`findCallerBookings` filtre `status: 'confirmed'`);
 *   3. `googleEventId` remis à null, sinon une synchronisation ultérieure
 *      croit devoir déplacer un événement qui n'existe plus;
 *   4. le cache de l'appelant, sinon l'agent redit le nom et le rendez-vous
 *      pendant une minute.
 *
 * Deux copies d'une même décision divergent en moins d'un mois: c'est la leçon
 * de 6vicies, payée ici sur la langue, sur la voix, sur le niveau et sur les
 * outils. Le portail passe donc par cette fonction, et l'agent aussi.
 */
export type CancelOutcome =
  | { ok: true; alreadyCancelled: boolean; customerName: string; bookingDate: Date; bookingTime: string | null }
  | { ok: false; reason: 'not-found' };

export async function cancelBooking(clientId: string, bookingId: string): Promise<CancelOutcome> {
  const booking = await prisma.clientBooking.findFirst({
    /* `clientId` dans le WHERE, jamais l'identifiant seul: c'est la règle que
       le test de source du contrôleur client impose, faute de RLS Postgres. */
    where: { id: bookingId, clientId },
    select: { id: true, status: true, googleEventId: true, customerPhone: true, customerName: true, bookingDate: true, bookingTime: true },
  });
  if (!booking) return { ok: false, reason: 'not-found' };

  const common = {
    customerName: booking.customerName,
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
  };

  /* IDEMPOTENT, et ce n'est pas du confort: le modèle rappelle un outil avec
     les mêmes arguments, c'est le comportement connu de ce chemin
     (6sexquadragesies, neuf appels d'affilée). Un second appel ne doit ni
     échouer ni refaire les écritures, seulement redire que c'est fait. */
  if (booking.status === 'cancelled') return { ok: true, alreadyCancelled: true, ...common };

  if (booking.googleEventId) {
    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { googleCalendarRefreshToken: true, googleCalendarId: true },
      });
      if (client?.googleCalendarRefreshToken) {
        const accessToken = await googleCalendarService.getAccessTokenFromRefresh(client.googleCalendarRefreshToken);
        await googleCalendarService.deleteEvent(booking.googleEventId, accessToken, client.googleCalendarId || 'primary');
      }
    } catch (error) {
      /* MEILLEUR EFFORT, et l'ordre porte la raison: l'agenda d'abord, la base
         ensuite. Si Google refuse, la ligne est quand même annulée, parce
         qu'une ligne « confirmée » que le client croit annulée est le pire des
         deux états: c'est elle que l'agent relit, elle qui tient le créneau, et
         elle qui fera promettre un SMS au prochain appel. */
      logger.warn(`[BookingCancel] événement Google non retiré (${booking.id}): ${(error as Error).message}`);
    }
  }

  await prisma.clientBooking.updateMany({
    where: { id: booking.id, clientId },
    data: { status: 'cancelled', googleEventId: null, calendarSyncedAt: null },
  });

  if (booking.customerPhone) {
    await realtimeContextService.invalidateCaller(clientId, booking.customerPhone).catch(() => undefined);
  }

  return { ok: true, alreadyCancelled: false, ...common };
}
