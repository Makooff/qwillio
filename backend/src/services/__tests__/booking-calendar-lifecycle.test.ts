import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * CYCLE DE VIE AGENDA FOURNISSEUR-AWARE — Google + Outlook.
 *
 * Bug confirmé : `googleEventId` stocke les identifiants Google ET Outlook
 * sans attribution de fournisseur, et `booking-cancel.ts` ne supprimait que
 * chez Google. Résultat : un événement Outlook survivait à une annulation
 * (portail, chemin agent, voice-core), et une bascule de fournisseur pouvait
 * viser le mauvais agenda.
 *
 * Correctif : référence d'événement ÉTIQUETÉE (`outlook:<id>` vs identifiant
 * nu = Google, rétrocompatible), suppression via `deleteBookingEvent` (s'adresse
 * à l'agenda qui a POSÉ l'événement), et référence JAMAIS effacée après un
 * échec de suppression réel (pas de doublon silencieux).
 */

const {
  bookingFindFirst, bookingUpdateMany, bookingUpdate, bookingFindUnique, clientFindUnique, clientUpdate,
  googleToken, googleDelete, googleCreateFromBooking,
  outlookToken, outlookCreate, outlookDelete,
  invalidateCaller,
} = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  bookingUpdateMany: vi.fn(async () => ({ count: 1 })),
  bookingUpdate: vi.fn(async () => ({})),
  clientFindUnique: vi.fn(),
  clientUpdate: vi.fn(),
  bookingFindUnique: vi.fn(),
  googleToken: vi.fn(async () => 'google-access'),
  /* NOUVEAU CONTRAT : `true` = événement réellement retiré, `false` = 404/410
     (déjà absent). C'est ce qui permet à un référence legacy de passer chez
     le fournisseur suivant au lieu de conclure trop tôt. */
  googleDelete: vi.fn(async () => true),
  googleCreateFromBooking: vi.fn(async () => ({ id: 'g-ev-1' })),
  outlookToken: vi.fn(async () => 'outlook-access'),
  outlookCreate: vi.fn(async () => 'o-ev-1'),
  /* Même contrat que Google : `true` = retiré, `false` = déjà absent (404). */
  outlookDelete: vi.fn(async () => true),
  invalidateCaller: vi.fn(async () => undefined),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    clientBooking: {
      findFirst: bookingFindFirst,
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: bookingUpdate,
      updateMany: bookingUpdateMany,
    },
    client: { findUnique: clientFindUnique, update: clientUpdate },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../google-calendar.service', () => ({
  googleCalendarService: {
    getAccessTokenFromRefresh: googleToken,
    deleteEvent: googleDelete,
    createEventFromBooking: googleCreateFromBooking,
  },
}));
vi.mock('../outlook-calendar.service', () => ({
  outlookCalendarService: {
    getAccessTokenFromRefresh: outlookToken,
    createEvent: outlookCreate,
    deleteEvent: outlookDelete,
  },
}));
vi.mock('../voice/realtime-context.service', () => ({
  realtimeContextService: { invalidateCaller },
}));

const { cancelBooking } = await import('../booking-cancel');
const { deleteBookingEvent, moveBookingEvent, parseStoredEventRef, calendarForEvent } = await import('../calendar-provider.service');

const GOOGLE_CLIENT = {
  id: 'c1',
  calendarProvider: 'google',
  googleCalendarRefreshToken: 'g-refresh',
  googleCalendarId: 'primary',
  outlookRefreshToken: null,
  outlookCalendarId: null,
};
const OUTLOOK_CLIENT = {
  id: 'c1',
  calendarProvider: 'outlook',
  googleCalendarRefreshToken: null,
  googleCalendarId: null,
  outlookRefreshToken: 'o-refresh',
  outlookCalendarId: 'primary',
};
const BOTH_CLIENT = {
  id: 'c1',
  calendarProvider: 'outlook',
  googleCalendarRefreshToken: 'g-refresh',
  googleCalendarId: 'primary',
  outlookRefreshToken: 'o-refresh',
  outlookCalendarId: 'primary',
};

const bookingRow = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  status: 'confirmed',
  googleEventId: 'g-ev-1',
  customerPhone: '3248000000',
  customerName: 'Jean Test',
  bookingDate: new Date(Date.now() + 3 * 86400_000),
  bookingTime: '14:00',
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  invalidateCaller.mockResolvedValue(undefined);
  googleToken.mockResolvedValue('google-access');
  outlookToken.mockResolvedValue('outlook-access');
  googleDelete.mockResolvedValue(true);
  outlookDelete.mockResolvedValue(true);
  bookingUpdateMany.mockResolvedValue({ count: 1 });
});

describe('moveBookingEvent — suppression confirmée avant recréation', () => {
  it.each(['missing-credentials', 'supplier-error'])('ne recrée pas après %s et garde la référence', async (failure) => {
    clientFindUnique.mockResolvedValue(failure === 'missing-credentials' ? GOOGLE_CLIENT : BOTH_CLIENT);
    if (failure === 'supplier-error') outlookDelete.mockRejectedValueOnce(new Error('Graph 503'));
    const sync = vi.fn(async () => true);
    expect(await moveBookingEvent('c1', 'b1', 'outlook:old-event', sync)).toBe(false);
    expect(sync).not.toHaveBeenCalled();
    expect(bookingUpdateMany.mock.calls.some(([arg]) => arg.data.googleEventId === null)).toBe(false);
  });
  it('efface la référence seulement après confirmation puis recrée', async () => {
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);
    const sync = vi.fn(async () => {
      expect(outlookDelete).toHaveBeenCalledTimes(1);
      expect(bookingUpdateMany).toHaveBeenCalledWith(expect.objectContaining({where: {id:'b1',clientId:'c1',status:'confirmed',googleEventId:'outlook:old-event'}, data:{googleEventId:null}}));
      return true;
    });
    expect(await moveBookingEvent('c1','b1','outlook:old-event',sync)).toBe(true);
    expect(sync).toHaveBeenCalledTimes(1);
  });
  it('ne recrée pas si la réservation a été annulée ou modifiée entre-temps', async () => {
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);
    bookingUpdateMany.mockResolvedValueOnce({count:0});
    const sync = vi.fn(async () => true);
    expect(await moveBookingEvent('c1','b1','outlook:old-event',sync)).toBe(false);
    expect(sync).not.toHaveBeenCalled();
  });
});

describe('cancelBooking — cycle de vie fournisseur-aware', () => {
  it('retente vraiment la suppression après annulation locale sur une panne fournisseur', async () => {
    let row = bookingRow({ googleEventId: 'outlook:retry-event' });
    bookingFindFirst.mockImplementation(async () => row);
    bookingUpdateMany.mockImplementation(async ({ data }: any) => {
      row = { ...row, ...data };
      return { count: 1 };
    });
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);
    outlookDelete.mockRejectedValueOnce(new Error('Graph 503'));
    expect(await cancelBooking('c1', 'b1')).toMatchObject({ ok: true, calendarSync: 'retained' });
    expect(row.status).toBe('cancelled');
    expect(row.googleEventId).toBe('outlook:retry-event');
    expect(await cancelBooking('c1', 'b1')).toMatchObject({ ok: true, alreadyCancelled: true, calendarSync: 'removed' });
    expect(outlookDelete).toHaveBeenCalledTimes(2);
    expect(row.googleEventId).toBeNull();
  });

  it('Google : crée (id nu) → annule → supprime chez Google et efface la référence', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'g-ev-1' }));
    clientFindUnique.mockResolvedValue(GOOGLE_CLIENT);

    const out = await cancelBooking('c1', 'b1');

    expect(out.ok).toBe(true);
    expect(googleDelete).toHaveBeenCalledWith('g-ev-1', 'google-access', 'primary');
    expect(outlookDelete).not.toHaveBeenCalled();
    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: { id: 'b1', clientId: 'c1' },
      data: { status: 'cancelled', googleEventId: null, calendarSyncedAt: null },
    });
  });

  it('Outlook : référence étiquetée → annule chez Outlook (pas Google) et efface la référence', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'outlook:o-ev-1' }));
    clientFindUnique.mockResolvedValue(OUTLOOK_CLIENT);

    const out = await cancelBooking('c1', 'b1');

    expect(out.ok).toBe(true);
    expect(outlookDelete).toHaveBeenCalledWith('outlook-access', 'o-ev-1', 'primary');
    expect(googleDelete).not.toHaveBeenCalled();
    expect(bookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleEventId: null }) }),
    );
  });

  it('Bascule de fournisseur : référence étiquetée Google, client désormais Outlook → suppression chez Google uniquement', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'google:g-ev-1' }));
    // The stored owner, not the currently active provider, determines deletion.
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);

    await cancelBooking('c1', 'b1');

    expect(googleDelete).toHaveBeenCalledWith('g-ev-1', expect.any(String), 'primary');
    expect(outlookDelete).not.toHaveBeenCalled();
  });

  it('Idempotent : statut déjà annulé → pas de suppression, pas d\'écriture, alreadyCancelled', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ status: 'cancelled', googleEventId: null }));

    const out = await cancelBooking('c1', 'b1');

    expect(out).toMatchObject({ ok: true, alreadyCancelled: true });
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
    expect(bookingUpdateMany).not.toHaveBeenCalled();
  });

  it('Identifiant absent → not-found, aucune écriture', async () => {
    bookingFindFirst.mockResolvedValue(null);

    const out = await cancelBooking('c1', 'b1');

    expect(out).toEqual({ ok: false, reason: 'not-found' });
    expect(bookingUpdateMany).not.toHaveBeenCalled();
    expect(googleDelete).not.toHaveBeenCalled();
  });

  it('Référence sans événement → annulation base seule, aucun appel fournisseur', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: null }));
    clientFindUnique.mockResolvedValue(GOOGLE_CLIENT);

    const out = await cancelBooking('c1', 'b1');

    expect(out.ok).toBe(true);
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
    expect(bookingUpdateMany).toHaveBeenCalledWith(
      // The stored reference is already null: no redundant write is required.
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) }),
    );
  });

  it('Échec réel de suppression (500) → statut annulé MAIS référence conservée, pas de succès factice', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'outlook:o-ev-1' }));
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);
    outlookDelete.mockRejectedValueOnce(new Error('Graph delete event failed (500)'));

    const out = await cancelBooking('c1', 'b1');

    /* Best-effort préservé : la réservation est annulée en base. */
    expect(out.ok).toBe(true);
    const data = bookingUpdateMany.mock.calls[0][0].data;
    expect(data.status).toBe('cancelled');
    /* La référence DOIT survivre : l'update ne la touche pas (colonne
       conservée telle quelle), et surtout ne la remet PAS à null. */
    expect(data.googleEventId).not.toBe(null);
  });

  it('Identifiants du fournisseur manquants (Outlook révoqué) → pas de fausse suppression, référence conservée', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'outlook:o-ev-1' }));
    /* Le client n\'a plus que Google : l\'événement Outlook est inatteignable. */
    clientFindUnique.mockResolvedValue(GOOGLE_CLIENT);

    const out = await cancelBooking('c1', 'b1');

    expect(out.ok).toBe(true);
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
    const data = bookingUpdateMany.mock.calls[0][0].data;
    expect(data.status).toBe('cancelled');
    /* Inatteignable : la colonne n'est pas remise à null, la référence
       survit pour un nettoyage futur. */
    expect(data.googleEventId).not.toBe(null);
  });
});

describe('deleteBookingEvent / parseStoredEventRef — référence étiquetée', () => {

  it('parse : id nu = fournisseur inconnu (legacy), préfixe outlook: = Outlook, id natif préservé', () => {
    expect(parseStoredEventRef('g-ev-1')).toEqual({ eventId: 'g-ev-1', provider: null });
    expect(parseStoredEventRef('outlook:o-ev-1')).toEqual({ eventId: 'o-ev-1', provider: 'outlook' });
  });

  it('parse : préfixe google: = Google (les NOUVELLES écritures Google sont étiquetées, pas seulement Outlook)', () => {
    expect(parseStoredEventRef('google:g-ev-9')).toEqual({ eventId: 'g-ev-9', provider: 'google' });
  });

  it('delete : chaîne étiquetée Outlook → suppression Outlook avec l\'id natif', async () => {
    await deleteBookingEvent(BOTH_CLIENT as any, 'outlook:o-ev-1');
    expect(outlookDelete).toHaveBeenCalledWith('outlook-access', 'o-ev-1', 'primary');
    expect(googleDelete).not.toHaveBeenCalled();
  });

  it('legacy avec deux fournisseurs : aucun DELETE sans propriétaire établi', async () => {
    expect(await deleteBookingEvent(BOTH_CLIENT as any, 'opaque-legacy-id')).toBe('unreachable');
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
  });

  it('delete : référence legacy → Google supprime VRAIMENT → Outlook n\'est JAMAIS tenté (pas de suppression large)', async () => {
    const out = await deleteBookingEvent(GOOGLE_CLIENT as any, { eventId: 'g-ev-1' });
    expect(googleDelete).toHaveBeenCalledTimes(1);
    expect(outlookDelete).not.toHaveBeenCalled();
    expect(out).toBe('removed');
  });

  it('delete : 404 chez les deux fournisseurs → « already-gone », la référence peut être effacée sans risque', async () => {
    googleDelete.mockResolvedValueOnce(false);
    outlookDelete.mockResolvedValueOnce(false);
    const out = await deleteBookingEvent(BOTH_CLIENT as any, 'google:fantome');
    expect(out).toBe('already-gone');
  });

  it('delete : référence étiquetée google: → SEUL Google est visé, même quand Outlook est le provider actif', async () => {
    const out = await deleteBookingEvent(BOTH_CLIENT as any, 'google:g-ev-9');
    expect(googleDelete).toHaveBeenCalledWith('g-ev-9', 'google-access', 'primary');
    expect(outlookDelete).not.toHaveBeenCalled();
    expect(out).toBe('removed');
  });

  it('delete : référence Outlook mais jeton Outlook disparu → « unreachable », AUCUN appel fournisseur', async () => {
    const out = await deleteBookingEvent(GOOGLE_CLIENT as any, 'outlook:o-ev-1');
    expect(out).toBe('unreachable');
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
  });

  it('delete : la rotation du jeton Outlook est PERSISTÉE pendant la suppression', async () => {
    /* Microsoft tourne son refresh token à chaque renouvellement. Sans
       réécriture, la suppression fonctionne une fois puis l'intégration meurt
       à l'heure suivante — et tous les chemins d'annulation/déplacement
       empruntent celui-ci. */
    outlookToken.mockImplementationOnce(async (_refresh: string, onRefresh?: (next: string) => Promise<void>) => {
      await onRefresh?.('o-refresh-ROTATED');
      return 'outlook-access';
    });
    const out = await deleteBookingEvent(BOTH_CLIENT as any, 'outlook:o-ev-1');
    expect(out).toBe('removed');
    expect(clientUpdate).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { outlookRefreshToken: 'o-refresh-ROTATED' },
    });
  });

  it('calendarForEvent : référence étiquetée prime sur le provider actif', () => {
    /* Client passé sur Outlook, mais l\'événement a été posé chez Google. */
    const cal = calendarForEvent(BOTH_CLIENT, { eventId: 'g-ev-1', provider: 'google' });
    expect(cal?.provider).toBe('google');
  });
});

describe('cancelBooking — rejeu sur annulation avec référence conservée (le retry doit VRAIMENT retenter)', () => {

  it('statut déjà annulé + référence conservée → RETENTE la suppression et efface la référence quand elle réussit', async () => {
    /* Avant ce garde-fou, le rejeu rendait `alreadyCancelled` SANS regarder la
       référence : un échec de suppression antérieur laissait l'événement dans
       l'agenda pour toujours, invisible depuis la base. Le rejeu (le modèle
       rappelle l'outil, ou un re-clic portail) est précisément le moment de
       finir le travail. */
    bookingFindFirst.mockResolvedValue(bookingRow({ status: 'cancelled', googleEventId: 'outlook:o-ev-1' }));
    clientFindUnique.mockResolvedValue(OUTLOOK_CLIENT);

    const out = await cancelBooking('c1', 'b1');

    expect(out).toMatchObject({ ok: true, alreadyCancelled: true, calendarSync: 'removed' });
    expect(outlookDelete).toHaveBeenCalledWith('outlook-access', 'o-ev-1', 'primary');
    /* La référence n'est effacée QUE maintenant que l'événement est réellement
       parti. */
    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: { id: 'b1', clientId: 'c1' },
      data: { googleEventId: null, calendarSyncedAt: null },
    });
  });

  it('statut déjà annulé + suppression qui RE-échoue → référence conservée, état structuré « retained »', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ status: 'cancelled', googleEventId: 'outlook:o-ev-1' }));
    clientFindUnique.mockResolvedValue(OUTLOOK_CLIENT);
    outlookDelete.mockRejectedValueOnce(new Error('Graph delete event failed (503)'));

    const out = await cancelBooking('c1', 'b1');

    expect(out).toMatchObject({ ok: true, alreadyCancelled: true, calendarSync: 'retained' });
    /* Pas d'écriture inutile : la ligne est déjà annulée, la référence survit. */
    expect(bookingUpdateMany).not.toHaveBeenCalled();
  });

  it('statut déjà annulé SANS référence → aucun appel fournisseur, état « none »', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ status: 'cancelled', googleEventId: null }));

    const out = await cancelBooking('c1', 'b1');

    expect(out).toMatchObject({ ok: true, alreadyCancelled: true, calendarSync: 'none' });
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
    expect(bookingUpdateMany).not.toHaveBeenCalled();
  });
});

describe('cancelBooking — état structuré de synchronisation (pas de succès factice)', () => {

  it('succès Google → calendarSync « removed »', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'g-ev-1' }));
    clientFindUnique.mockResolvedValue(GOOGLE_CLIENT);

    const out = await cancelBooking('c1', 'b1');

    expect(out.ok).toBe(true);
    expect(out).toMatchObject({ calendarSync: 'removed' });
  });

  it('legacy ambigu : annulation locale, référence conservée et aucun DELETE exploratoire', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'o-ev-legacy' }));
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);
    expect(await cancelBooking('c1', 'b1')).toMatchObject({ok:true,calendarSync:'retained'});
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
    expect(bookingUpdateMany.mock.calls.some(([arg]) => arg.data.googleEventId === null)).toBe(false);
  });

  it('404 chez les deux fournisseurs → « already-gone », référence effacée (rien à retirer)', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'google:fantome' }));
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);
    googleDelete.mockResolvedValueOnce(false);
    outlookDelete.mockResolvedValueOnce(false);

    const out = await cancelBooking('c1', 'b1');

    expect(out).toMatchObject({ calendarSync: 'already-gone' });
    expect(bookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleEventId: null }) }),
    );
  });

  it('échec 500 → « retained » : statut annulé en base MAIS avertissement structuré retryable', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'outlook:o-ev-1' }));
    clientFindUnique.mockResolvedValue(BOTH_CLIENT);
    outlookDelete.mockRejectedValueOnce(new Error('Graph delete event failed (500)'));

    const out = await cancelBooking('c1', 'b1');

    expect(out).toMatchObject({ ok: true, calendarSync: 'retained' });
    const data = bookingUpdateMany.mock.calls[0][0].data;
    expect(data.status).toBe('cancelled');
    expect(data.googleEventId).not.toBe(null);
  });

  it('fournisseur d\'origine débranché (jeton manquant) → « retained » sans appel fournisseur, référence conservée', async () => {
    bookingFindFirst.mockResolvedValue(bookingRow({ googleEventId: 'outlook:o-ev-1' }));
    clientFindUnique.mockResolvedValue(GOOGLE_CLIENT);

    const out = await cancelBooking('c1', 'b1');

    expect(out).toMatchObject({ calendarSync: 'retained' });
    expect(googleDelete).not.toHaveBeenCalled();
    expect(outlookDelete).not.toHaveBeenCalled();
  });
});
