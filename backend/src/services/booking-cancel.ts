import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { deleteBookingEvent } from './calendar-provider.service';
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
export type CalendarSyncState = 'removed' | 'already-gone' | 'none' | 'retained';

export type CancelOutcome =
  | {
      ok: true;
      alreadyCancelled: boolean;
      customerName: string;
      bookingDate: Date;
      bookingTime: string | null;
      /**
       * La vérité sur l'agenda, pour que l'appelant (portail, agent, pont)
       * ne lise JAMAIS un succès factice :
       *  - `removed`      — l'événement a été retiré du fournisseur ;
       *  - `already-gone` — 404 partout : rien à retirer, référence effacée ;
       *  - `none`         — la ligne n'avait aucune référence agenda ;
       *  - `retained`     — ÉCHEC de suppression (5xx) ou fournisseur
       *                     débranché : la réservation est annulée en base
       *                     mais l'événement peut subsister côté fournisseur.
       *                     La référence est conservée pour un retry ; l'état
       *                     est retryable tant que la référence existe.
       */
      calendarSync: CalendarSyncState;
    }
  | { ok: false; reason: 'not-found' };

/**
 * Retire l'événement chez le fournisseur qui l'a posé et rend l'état réel.
 * Ne lève JAMAIS : un échec fournisseur rend `retained` (la référence survit),
 * seuls les bugs de programmation passent au-dessus.
 */
async function removeEventFromProvider(clientId: string, storedRef: string): Promise<CalendarSyncState> {
  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return 'retained';
    const outcome = await deleteBookingEvent(client, storedRef);
    return outcome === 'unreachable' ? 'retained' : outcome;
  } catch (error) {
    logger.warn(`[BookingCancel] événement agenda non retiré: ${(error as Error).message}`);
    return 'retained';
  }
}

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
     échouer ni refaire les écritures, seulement redire que c'est fait.
     MAIS : si une référence agenda a survécu à un échec de suppression
     antérieur, le rejeu est LA occasion de finir le travail. Sans ce retry,
     l'événement reste dans l'agenda du gérant pour toujours, invisible de
     la base. */
  if (booking.status === 'cancelled') {
    if (!booking.googleEventId) {
      return { ok: true, alreadyCancelled: true, ...common, calendarSync: 'none' };
    }
    const sync = await removeEventFromProvider(clientId, booking.googleEventId);
    if (sync === 'removed' || sync === 'already-gone') {
      /* L'événement est réellement parti (ou n'existait plus) : la référence
         peut enfin être effacée. Écriture bornée (id, clientId). */
      await prisma.clientBooking.updateMany({
        where: { id: booking.id, clientId },
        data: { googleEventId: null, calendarSyncedAt: null },
      });
    }
    return { ok: true, alreadyCancelled: true, ...common, calendarSync: sync };
  }

  /* Suppression fournisseur-aware : `googleEventId` porte une référence
     ÉTIQUETÉE (`outlook:<id>` / `google:<id>`) ou un identifiant nu (legacy =
     fournisseur inconnu — les deux agendas disponibles sont alors tentés, et
     un 404 chez le premier ne conclut PLUS la suppression : on ne conclut
     « removed » que si un fournisseur a réellement retiré l'événement). */
  let calendarSync: CalendarSyncState = 'none';
  if (booking.googleEventId) {
    calendarSync = await removeEventFromProvider(clientId, booking.googleEventId);
  }

  /* La référence n'est nulle QUE si l'événement a véritablement été retiré
     (ou n'existait déjà plus). Échec ou fournisseur débranché = référence
     conservée : la colonne reste telle quelle, jamais remise à null. */
  await prisma.clientBooking.updateMany({
    where: { id: booking.id, clientId },
    data: {
      status: 'cancelled',
      ...(calendarSync === 'removed' || calendarSync === 'already-gone' ? { googleEventId: null } : {}),
      calendarSyncedAt: null,
    },
  });

  if (booking.customerPhone) {
    await realtimeContextService.invalidateCaller(clientId, booking.customerPhone).catch(() => undefined);
  }

  return { ok: true, alreadyCancelled: false, ...common, calendarSync };
}
