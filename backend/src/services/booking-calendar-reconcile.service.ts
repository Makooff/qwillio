import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Rattrape les rendez-vous restés en base sans jamais atteindre le calendrier.
 *
 * L'écriture Google se fait volontairement hors du chemin de l'appel: le
 * correspondant a déjà sa confirmation, et faire attendre la ligne téléphonique
 * pour une API lente serait pire que l'échec lui-même. Le code annonçait donc
 * qu'un échec relevait « d'un travail de réconciliation ». Ce travail n'existait
 * pas: le rendez-vous restait en base, absent du calendrier, et le client ne
 * l'apprenait qu'en voyant personne se présenter.
 *
 * Deux garde-fous délibérés:
 *  - **seuls les rendez-vous à venir** sont repris. Recréer un événement pour
 *    un rendez-vous passé ne rend service à personne et polluerait l'agenda;
 *  - **cinq tentatives au plus**. Au-delà, l'échec n'est plus transitoire (jeton
 *    Google révoqué, calendrier supprimé) et réessayer chaque heure ne ferait
 *    que consommer du quota. La ligne est alors signalée, pas retentée.
 */

export const MAX_SYNC_ATTEMPTS = 5;

export interface ReconcileReport {
  examined: number;
  repaired: number;
  stillFailing: number;
  givenUp: number;
}

class BookingCalendarReconcileService {
  async reconcilePendingSyncs(now: Date = new Date()): Promise<ReconcileReport> {
    const report: ReconcileReport = { examined: 0, repaired: 0, stillFailing: 0, givenUp: 0 };

    const pending = await prisma.clientBooking.findMany({
      where: {
        calendarSyncedAt: null,
        status: 'confirmed',
        bookingDate: { gte: now },
        calendarSyncAttempts: { lt: MAX_SYNC_ATTEMPTS },
      },
      select: { id: true, clientId: true },
      orderBy: { bookingDate: 'asc' },
      take: 200,
    });

    report.examined = pending.length;

    /* Les abandons se comptent AVANT toute sortie anticipée. Ce sont les
       rendez-vous qui n'atteindront jamais l'agenda, donc ceux qu'il faut le
       plus signaler — et ils sont justement invisibles les jours où plus rien
       n'est en attente de reprise. */
    report.givenUp = await prisma.clientBooking.count({
      where: {
        calendarSyncedAt: null,
        status: 'confirmed',
        bookingDate: { gte: now },
        calendarSyncAttempts: { gte: MAX_SYNC_ATTEMPTS },
      },
    });

    if (!pending.length) {
      if (report.givenUp > 0) this.warnAboutGivenUp(report.givenUp);
      return report;
    }

    const { toolRuntimeService } = await import('./voice/tool-runtime.service');

    for (const booking of pending) {
      // Séquentiel, et c'est voulu: une rafale parallèle vers l'API Google
      // déclencherait la limitation de débit, ce qui transformerait un retard
      // rattrapable en échecs comptabilisés.
      const ok = await toolRuntimeService
        .syncBookingToCalendar(booking.clientId, booking.id)
        .catch(() => false);
      if (ok) report.repaired += 1;
      else report.stillFailing += 1;
    }

    if (report.repaired || report.stillFailing || report.givenUp) {
      logger.info(
        `[BookingReconcile] ${report.repaired} rattrapé(s), ${report.stillFailing} encore en échec, ` +
        `${report.givenUp} abandonné(s) après ${MAX_SYNC_ATTEMPTS} tentatives`,
      );
    }
    if (report.givenUp > 0) this.warnAboutGivenUp(report.givenUp);
    return report;
  }

  /** Un abandon mérite mieux qu'une ligne d'info: le client croit ce rendez-vous
   *  dans son agenda, et il n'y sera jamais. */
  private warnAboutGivenUp(count: number): void {
    logger.warn(
      `[BookingReconcile] ${count} rendez-vous à venir n'atteindront pas le calendrier ` +
      '(jeton Google probablement révoqué): reconnexion du calendrier nécessaire.',
    );
  }
}

export const bookingCalendarReconcileService = new BookingCalendarReconcileService();
