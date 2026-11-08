import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findMany, count, syncBookingToCalendar, moveBookingEvent, cancelBooking } = vi.hoisted(() => ({
  findMany: vi.fn(),
  moveBookingEvent: vi.fn(),
  cancelBooking: vi.fn(),
  count: vi.fn(),
  syncBookingToCalendar: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: { clientBooking: { findMany, count } },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../voice/tool-runtime.service', () => ({
  toolRuntimeService: { syncBookingToCalendar },
}));

vi.mock('../calendar-provider.service', () => ({moveBookingEvent}));
vi.mock('../booking-cancel', () => ({cancelBooking}));

import { bookingCalendarReconcileService, MAX_SYNC_ATTEMPTS } from '../booking-calendar-reconcile.service';

const NOW = new Date('2026-08-13T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(0);
});

describe('réconciliation des synchronisations calendrier', () => {
  it('retente la suppression de l’ancien événement avant toute recréation', async () => {
    findMany.mockResolvedValue([{id:'b1',clientId:'c1',status:'confirmed',googleEventId:'outlook:old'}]);
    moveBookingEvent.mockResolvedValue(false);
    expect(await bookingCalendarReconcileService.reconcilePendingSyncs(NOW)).toMatchObject({stillFailing:1,repaired:0});
    expect(moveBookingEvent).toHaveBeenCalledWith('c1','b1','outlook:old',expect.any(Function));
    expect(syncBookingToCalendar).not.toHaveBeenCalled();
  });
  it('reprend les annulations dont la référence a survécu à un échec', async () => {
    findMany.mockResolvedValue([{id:'b1',clientId:'c1',status:'cancelled',googleEventId:'outlook:old'}]);
    cancelBooking.mockResolvedValue({ok:true,calendarSync:'removed'});
    expect(await bookingCalendarReconcileService.reconcilePendingSyncs(NOW)).toMatchObject({repaired:1});
    expect(cancelBooking).toHaveBeenCalledWith('c1','b1');
    expect(syncBookingToCalendar).not.toHaveBeenCalled();
  });
  it('ne cherche que les rendez-vous À VENIR et non encore synchronisés', async () => {
    findMany.mockResolvedValue([]);

    await bookingCalendarReconcileService.reconcilePendingSyncs(NOW);

    const where = findMany.mock.calls[0][0].where;
    expect(where.calendarSyncedAt).toBeNull();
    expect(where.OR).toEqual(expect.arrayContaining([{status:'confirmed',bookingDate:{gte:NOW}},{status:'cancelled',googleEventId:{not:null}}]));
    // Recréer un événement pour un rendez-vous passé ne rend service à
    // personne et polluerait l'agenda du client.
    expect(where.OR[0].bookingDate).toEqual({ gte: NOW });
    expect(where.calendarSyncAttempts).toEqual({ lt: MAX_SYNC_ATTEMPTS });
  });

  it('compte les rattrapages et les échecs persistants', async () => {
    findMany.mockResolvedValue([
      { id: 'b1', clientId: 'c1' },
      { id: 'b2', clientId: 'c1' },
      { id: 'b3', clientId: 'c2' },
    ]);
    syncBookingToCalendar
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const report = await bookingCalendarReconcileService.reconcilePendingSyncs(NOW);

    expect(report).toMatchObject({ examined: 3, repaired: 2, stillFailing: 1 });
  });

  it('ne laisse pas une exception interrompre le lot', async () => {
    // Un rendez-vous qui explose ne doit pas empêcher les suivants d'être
    // rattrapés: c'est tout l'intérêt d'un job de reprise.
    findMany.mockResolvedValue([
      { id: 'b1', clientId: 'c1' },
      { id: 'b2', clientId: 'c1' },
    ]);
    syncBookingToCalendar
      .mockRejectedValueOnce(new Error('Google 500'))
      .mockResolvedValueOnce(true);

    const report = await bookingCalendarReconcileService.reconcilePendingSyncs(NOW);

    expect(report.repaired).toBe(1);
    expect(report.stillFailing).toBe(1);
  });

  it('signale les rendez-vous abandonnés après le plafond de tentatives', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(2);

    const report = await bookingCalendarReconcileService.reconcilePendingSyncs(NOW);

    // Un abandon est un rendez-vous que le client croit dans son agenda et qui
    // n'y sera jamais: il doit ressortir du rapport.
    expect(report.givenUp).toBe(2);
    expect(count.mock.calls[0][0].where.calendarSyncAttempts).toEqual({ gte: MAX_SYNC_ATTEMPTS });
  });

  it('ne touche à rien quand il n’y a rien à reprendre', async () => {
    findMany.mockResolvedValue([]);

    const report = await bookingCalendarReconcileService.reconcilePendingSyncs(NOW);

    expect(syncBookingToCalendar).not.toHaveBeenCalled();
    expect(report.examined).toBe(0);
  });
});
