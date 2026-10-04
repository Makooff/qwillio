import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const getAccessTokenFromRefresh = vi.fn();
const getAvailability = vi.fn();
const bookingFindMany = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: {
    client: { findUnique: (...a: unknown[]) => findUnique(...a) },
    /* Les réservations DÉJÀ PRISES en base. `freeSlots` ne lisait que Google :
       un créneau confirmé en base dont la synchro calendrier n'était pas encore
       passée restait annoncé libre. Voir `availability-speculator.ts`. */
    clientBooking: { findMany: (...a: unknown[]) => bookingFindMany(...a) },
  },
}));

vi.mock('../../google-calendar.service', () => ({
  googleCalendarService: {
    getAccessTokenFromRefresh: (...a: unknown[]) => getAccessTokenFromRefresh(...a),
    getAvailability: (...a: unknown[]) => getAvailability(...a),
  },
}));

const { availabilitySpeculator, detectDate } = await import('../availability-speculator');

/** Wednesday 12 August 2026, midday. */
const NOW = new Date('2026-08-12T12:00:00Z');
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe('detectDate', () => {
  it('resolves today and tomorrow in both languages', () => {
    expect(iso(detectDate('vous avez quelque chose aujourd\'hui ?', 'fr', NOW))).toBe('2026-08-12');
    expect(iso(detectDate('anything tomorrow?', 'en', NOW))).toBe('2026-08-13');
  });

  it('resolves a weekday to its NEXT occurrence, never a past one', () => {
    // Wednesday asking for Monday means the coming Monday.
    expect(iso(detectDate('plutot lundi si possible', 'fr', NOW))).toBe('2026-08-17');
    expect(iso(detectDate('how about friday', 'en', NOW))).toBe('2026-08-14');
  });

  it('treats the same weekday as next week, not today', () => {
    expect(iso(detectDate('mercredi', 'fr', NOW))).toBe('2026-08-19');
  });

  it('resolves a bare day number, rolling into next month when it has passed', () => {
    expect(iso(detectDate('le 20 si vous avez', 'fr', NOW))).toBe('2026-08-20');
    expect(iso(detectDate('le 5', 'fr', NOW))).toBe('2026-09-05');
  });

  it('returns null when no day is named — a missed detection is free', () => {
    expect(detectDate('je voudrais reserver une table', 'fr', NOW)).toBeNull();
    expect(detectDate('ok', 'en', NOW)).toBeNull();
    expect(detectDate('', 'fr', NOW)).toBeNull();
  });

  it('does not guess at vague future references', () => {
    // "the week after next" is exactly the kind of guess that costs a pointless
    // API call for no gain.
    expect(detectDate('dans deux semaines', 'fr', NOW)).toBeNull();
  });
});

describe('availabilitySpeculator', () => {
  beforeEach(() => {
    availabilitySpeculator.reset();
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ googleCalendarRefreshToken: 'token', googleCalendarId: 'primary' });
    getAccessTokenFromRefresh.mockResolvedValue('access');
    getAvailability.mockResolvedValue(['10:00', '11:00']);
    // Par défaut, aucune réservation en base : les tests existants portent sur
    // la lecture d'agenda et ne doivent pas voir un filtre s'ajouter sous eux.
    bookingFindMany.mockResolvedValue([]);
  });

  const flush = () => new Promise(r => setTimeout(r, 0));

  it('serves a second read of the same day from cache', async () => {
    await availabilitySpeculator.freeSlots('client_1', NOW);
    await availabilitySpeculator.freeSlots('client_1', NOW);
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('makes the tool call free when the day was already speculated', async () => {
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    expect(getAvailability).toHaveBeenCalledTimes(1);

    // The real tool call reads through the same path and hits the cache.
    expect(await availabilitySpeculator.freeSlots('client_1', NOW)).toEqual(['10:00', '11:00']);
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('never speculates the same day twice', async () => {
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('caps speculations per call so a caller listing days cannot flood Google', async () => {
    for (let i = 0; i < 10; i++) {
      const day = new Date(NOW);
      day.setDate(day.getDate() + i);
      availabilitySpeculator.speculate('client_1', 'call_1', day);
    }
    await flush();
    expect(getAvailability.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('gives a new call its own budget', async () => {
    for (let i = 0; i < 6; i++) {
      const day = new Date(NOW);
      day.setDate(day.getDate() + i);
      availabilitySpeculator.speculate('client_1', 'call_1', day);
    }
    await flush();
    const afterFirst = getAvailability.mock.calls.length;

    availabilitySpeculator.release('call_1');
    const other = new Date(NOW);
    other.setDate(other.getDate() + 20);
    availabilitySpeculator.speculate('client_1', 'call_2', other);
    await flush();

    expect(getAvailability.mock.calls.length).toBe(afterFirst + 1);
  });

  it('swallows a failed speculation — the real tool call runs the normal path', async () => {
    getAvailability.mockRejectedValue(new Error('google down'));
    availabilitySpeculator.speculate('client_1', 'call_1', NOW);
    await flush();
    // No unhandled rejection, and nothing cached.
    await expect(availabilitySpeculator.freeSlots('client_1', NOW)).rejects.toThrow();
  });

  it('refuses to read when no calendar is connected', async () => {
    findUnique.mockResolvedValue({ googleCalendarRefreshToken: null });
    await expect(availabilitySpeculator.freeSlots('client_1', NOW)).rejects.toThrow(/not connected/);
  });

  it('only ever reads — no write path exists on this module', () => {
    // A wrong guess must cost one wasted lookup, never a booking.
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(availabilitySpeculator));
    expect(surface).not.toContain('book');
    expect(surface).not.toContain('write');
  });
});

/**
 * La lecture EN VOL, et pourquoi elle décide de tout depuis que la spéculation
 * part sur les transcriptions partielles.
 */
describe('lectures concurrentes', () => {
  beforeEach(() => {
    availabilitySpeculator.reset();
    findUnique.mockReset();
    getAccessTokenFromRefresh.mockReset();
    getAvailability.mockReset();
    findUnique.mockResolvedValue({ googleCalendarRefreshToken: 'refresh', googleCalendarId: 'primary' });
    getAccessTokenFromRefresh.mockResolvedValue('access');
  });

  /** La lecture traverse deux `await` avant Google: un seul tick ne suffit pas. */
  const flush = () => new Promise(r => setTimeout(r, 0));

  /** Une lecture qu'on garde ouverte, pour tenir la fenêtre « en vol ». */
  function heldLookup() {
    let release: (slots: string[]) => void = () => {};
    getAvailability.mockImplementation(
      () => new Promise<string[]>(resolve => { release = resolve; }),
    );
    return { release: (slots: string[] = ['09:00']) => release(slots) };
  }

  it('ne lance QU\'UNE lecture quand la même journée revient dans dix partielles', async () => {
    const held = heldLookup();
    const date = new Date('2026-08-18T12:00:00Z');
    for (let i = 0; i < 10; i++) availabilitySpeculator.speculate('c1', 'call-1', date);
    await flush();
    /* Sans le registre des lectures en vol, le cache encore vide laissait
       passer chaque répétition: quatre requêtes identiques, et le budget de
       l'appel épuisé par un seul mot. */
    expect(getAvailability).toHaveBeenCalledTimes(1);
    held.release();
  });

  it('garde le budget de l\'appel intact pour les autres journées', async () => {
    const held = heldLookup();
    for (let i = 0; i < 10; i++) {
      availabilitySpeculator.speculate('c1', 'call-1', new Date('2026-08-18T12:00:00Z'));
    }
    await flush();
    held.release();
    await flush();

    /* Trois autres jours doivent encore passer: le budget est de quatre, et le
       mot répété n'en a dépensé qu'un. */
    getAvailability.mockResolvedValue(['10:00']);
    availabilitySpeculator.speculate('c1', 'call-1', new Date('2026-08-19T12:00:00Z'));
    availabilitySpeculator.speculate('c1', 'call-1', new Date('2026-08-20T12:00:00Z'));
    availabilitySpeculator.speculate('c1', 'call-1', new Date('2026-08-21T12:00:00Z'));
    await flush();
    expect(getAvailability).toHaveBeenCalledTimes(4);
  });

  it('fait REJOINDRE l\'appel d\'outil à la spéculation encore en vol', async () => {
    const held = heldLookup();
    const date = new Date('2026-08-18T12:00:00Z');
    availabilitySpeculator.speculate('c1', 'call-1', date);
    await flush();

    const real = availabilitySpeculator.freeSlots('c1', date);
    held.release(['14:00']);
    await expect(real).resolves.toEqual(['14:00']);
    /* C'est le cas que ce module existe pour optimiser, et celui qu'il
       manquait: l'outil arrivait pendant la lecture spéculative et en lançait
       une seconde. */
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('libère la clé après un échec, sinon la journée reste bloquée', async () => {
    getAvailability.mockRejectedValueOnce(new Error('google down'));
    const date = new Date('2026-08-18T12:00:00Z');
    await expect(availabilitySpeculator.freeSlots('c1', date)).rejects.toThrow('google down');

    getAvailability.mockResolvedValue(['11:00']);
    await expect(availabilitySpeculator.freeSlots('c1', date)).resolves.toEqual(['11:00']);
  });
});


/**
 * ── UN CRÉNEAU RÉSERVÉ N'EST PLUS ANNONCÉ LIBRE ─────────────────────────────
 *
 * `freeSlots` ne lisait QUE Google. Une réservation écrite en base dont la
 * synchronisation calendrier n'était pas encore passée — l'écriture Google est
 * en `void`, et le cache d'agenda vit trente secondes — restait annoncée
 * « libre » au tour suivant. L'agent la proposait, l'appelant acceptait, et
 * l'écriture échouait sur :
 *
 *     Unique constraint failed: (client_id, booking_date, booking_time)
 *
 * L'appelant, lui, avait entendu « c'est noté ». On propose un rendez-vous
 * qui n'existe pas — le pire résultat possible pour cette application.
 *
 * L'index qui produit l'erreur est PARTIEL et déclaré à la main dans une
 * migration (Prisma ne sait pas l'exprimer) :
 *
 *     CREATE UNIQUE INDEX ... ON "client_bookings"
 *       ("client_id", "booking_date", "booking_time")
 *       WHERE "status" = 'confirmed' AND "booking_time" IS NOT NULL;
 *
 * Ces tests suivent ces deux conditions à la lettre : ils échouent si le code
 * se met à filtrer « sauf annulé » au lieu de `= 'confirmed'`.
 */
describe('freeSlots — les créneaux pris en base', () => {
  beforeEach(() => {
    /* Le cache de l'agenda vit trente secondes et se partage par (client, jour) :
       sans ce reset, chaque test relirait la liste du précédent — même client,
       même jour — et le filtre ne serait jamais réexécuté. */
    availabilitySpeculator.reset();
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ googleCalendarRefreshToken: 'token', googleCalendarId: 'primary' });
    getAccessTokenFromRefresh.mockResolvedValue('access');
    getAvailability.mockResolvedValue(['10:00', '11:00']);
    bookingFindMany.mockResolvedValue([]);
  });

  it('retire un créneau confirmé que Google annonce encore libre', async () => {
    getAvailability.mockResolvedValue(['10:00', '11:00', '14:00']);
    bookingFindMany.mockResolvedValue([{ bookingTime: '11:00' }]);

    const slots = await availabilitySpeculator.freeSlots('client_1', NOW);

    expect(slots).toEqual(['10:00', '14:00']);
  });

  it('laisse tout passer quand la base ne porte aucune réservation', async () => {
    getAvailability.mockResolvedValue(['10:00', '11:00']);
    bookingFindMany.mockResolvedValue([]);

    expect(await availabilitySpeculator.freeSlots('client_1', NOW)).toEqual(['10:00', '11:00']);
  });

  it('ne filtre que les CONFIRMÉES — la contrainte dit `= confirmed`', async () => {
    // Le code ne décide pas de cette règle, il la lit. Un `status: { notIn:
    // ['cancelled'] }` serait plus permissif que l'index et ne retirerait rien
    // pour un statut inattendu : on vérifie donc la clause exacte.
    await availabilitySpeculator.freeSlots('client_1', NOW);
    const where = bookingFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('confirmed');
  });

  it('exige une heure — une réservation sans heure ne bloque aucun créneau', async () => {
    await availabilitySpeculator.freeSlots('client_1', NOW);
    const where = bookingFindMany.mock.calls[0][0].where;
    expect(where.bookingTime).toEqual({ not: null });
  });

  it('couvre le jour entier, sans dépendre de l’heure enregistrée', async () => {
    // `booking_date` est un TIMESTAMP(3), pas un type DATE. Une égalité
    // marcherait aujourd'hui par coïncidence (les deux côtés écrivent midi) et
    // casserait en silence sur la première ligne venue d'ailleurs.
    await availabilitySpeculator.freeSlots('client_1', NOW);
    const where = bookingFindMany.mock.calls[0][0].where;
    expect(where.bookingDate.gte).toBeInstanceOf(Date);
    expect(where.bookingDate.lt).toBeInstanceOf(Date);
    expect(where.bookingDate.lt.getTime() - where.bookingDate.gte.getTime()).toBe(86_400_000);
  });

  it('rapproche « 9:30 » et « 09:30 », qui sont le même instant', async () => {
    // Les créneaux de Google sortent en HH:MM ; `bookingTime` est écrit depuis
    // la chaîne produite par le MODÈLE, qui peut omettre le zéro. Une
    // comparaison textuelle raterait exactement les créneaux du matin — et
    // seulement eux, donc elle aurait l'air de marcher.
    getAvailability.mockResolvedValue(['09:30', '10:00']);
    bookingFindMany.mockResolvedValue([{ bookingTime: '9:30' }]);

    expect(await availabilitySpeculator.freeSlots('client_1', NOW)).toEqual(['10:00']);
  });

  it('ignore une heure illisible plutôt que de la prendre pour un créneau', async () => {
    getAvailability.mockResolvedValue(['10:00', '11:00']);
    bookingFindMany.mockResolvedValue([{ bookingTime: 'le matin' }, { bookingTime: '' }]);

    expect(await availabilitySpeculator.freeSlots('client_1', NOW)).toEqual(['10:00', '11:00']);
  });

  it('met en cache la liste FILTRÉE, pas celle de Google', async () => {
    // Le cache est relu sans repasser par la base : y ranger la liste brute
    // ferait réapparaître le créneau pris pendant les trente secondes qui
    // suivent, c'est-à-dire exactement pendant l'appel où on vient de le
    // réserver.
    getAvailability.mockResolvedValue(['10:00', '11:00']);
    bookingFindMany.mockResolvedValue([{ bookingTime: '11:00' }]);

    await availabilitySpeculator.freeSlots('client_1', NOW);
    expect(await availabilitySpeculator.freeSlots('client_1', NOW)).toEqual(['10:00']);
  });
});
