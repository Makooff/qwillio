import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * LE RENDEZ-VOUS DE L'APPELANT N'A PAS D'HORIZON (17/09/2026).
 *
 * Appel réel: « j'avais pris un rendez-vous, je voudrais le modifier », le nom
 * donné puis épelé, le bon numéro appelant, et `lookupBooking` répond trois
 * fois « AUCUNE RESERVATION trouvee ». L'appelant a raccroché avec un rappel
 * promis, pour une réservation qui existait.
 *
 * La cause n'avait rien à voir avec le moteur vocal: la lecture bornait à
 * 90 jours, avec un `take: 300` pris sur les plus PROCHES. Ce rendez-vous
 * était au 22 mars 2027, poussé là par la dérive d'année de
 * 6octoquadragesies — mais 90 jours coupent aussi un simple contrôle dentaire
 * à six mois, qui est la NORME du métier (douze tests l'ont dit le jour où on
 * a essayé de borner `farDateReply` à deux mois).
 *
 * La borne était une commodité de lecture, jamais une règle métier. Le numéro
 * de l'appelant est indexé et exact: il se lit sans fenêtre.
 */
const { getProfile, findBookings } = vi.hoisted(() => ({ getProfile: vi.fn(), findBookings: vi.fn() }));

vi.mock('../../../config/database', () => ({
  prisma: {
    clientBooking: { findMany: findBookings, create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    client: { findUnique: vi.fn(async () => null) },
  },
}));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile, getCallerHistory: vi.fn(async () => ({ knownName: 'Jean-Luc de la Forge' })) },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: vi.fn(() => ({ callerNumber: '32483620980' })),
    recordToolCall: vi.fn(), heldSlots: vi.fn(() => []), holdSlot: vi.fn(), markBooked: vi.fn(),
    recordLead: vi.fn(), markLeadActivity: vi.fn(),
    needsNameReadBack: vi.fn(() => false), needsNameSpelling: vi.fn(() => false),
    noteToolFailure: vi.fn(() => 1), noteFarDateAnnounced: vi.fn(() => 2),
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember: vi.fn() } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({ availabilitySpeculator: { freeSlots: vi.fn(), take: vi.fn(), speculate: vi.fn() } }));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const { toolRuntimeService } = await import('../tool-runtime.service');

const profile = {
  clientId: 'c1', businessName: 'Demtalix', language: 'fr', country: 'BE',
  timezone: 'Europe/Brussels', bookingEnabled: true, calendarConnected: true, weekHours: {},
};

/** Six mois devant: hors des 90 jours, et parfaitement banal. */
const farBooking = {
  id: 'b1', customerName: 'Jean-Luc de la Forge', customerPhone: '32483620980',
  bookingDate: new Date(Date.now() + 186 * 24 * 3600 * 1000),
  bookingTime: '17:00', serviceType: 'controle', googleEventId: null,
};

const lookup = async (args: Record<string, unknown> = {}) =>
  String((await toolRuntimeService.execute('c1', 'call_1', { name: 'lookupBooking', args, toolCallId: 't1' } as never)).result);

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  findBookings.mockResolvedValue([]);
});

describe('findCallerBookings — la fenêtre', () => {
  it('lit les rendez-vous du NUMÉRO sans borne haute', async () => {
    findBookings.mockResolvedValue([farBooking]);
    await lookup({});
    const where = findBookings.mock.calls[0][0].where;
    expect(where.customerPhone).toBeDefined();
    expect(where.bookingDate.gte).toBeInstanceOf(Date);
    /* LA LIGNE QUI COMPTE: pas de `lte`. C'est elle qui rendait invisible un
       rendez-vous à six mois. */
    expect(where.bookingDate.lte).toBeUndefined();
  });

  it('retrouve un rendez-vous à six mois, que les 90 jours cachaient', async () => {
    findBookings.mockResolvedValue([farBooking]);
    const out = await lookup({});
    expect(out).toMatch(/RESERVATION\(S\) DE CE CORRESPONDANT/);
    expect(out).toMatch(/Jean-Luc de la Forge/);
  });

  it('compare le numéro par ses ÉCRITURES: « +32… » et « 32… » sont le même', async () => {
    /* `normalizeNumber` ne garde que les chiffres pour servir de clé, mais
       Vapi et Twilio livrent du E.164 avec le « + ». Une égalité exacte ratait
       donc le même numéro sans rien dire. */
    findBookings.mockResolvedValue([{ ...farBooking, customerPhone: '+32483620980' }]);
    const out = await lookup({});
    expect(out).toMatch(/RESERVATION\(S\) DE CE CORRESPONDANT/);
    const where = findBookings.mock.calls[0][0].where;
    expect(where.customerPhone.in).toEqual(expect.arrayContaining(['32483620980', '+32483620980']));
  });

  it("la recherche par NOM garde une fenêtre: elle relit tout le commerce, pas un appelant", async () => {
    findBookings.mockResolvedValue([]);
    await lookup({ customerName: 'de la Forge' });
    const byName = findBookings.mock.calls.find(c => c[0].where.bookingDate?.lte);
    expect(byName).toBeDefined();
    /* Un an, pas quatre-vingt-dix jours: c'est ce que prend un client qui
       réserve à l'avance. */
    const span = byName![0].where.bookingDate.lte.getTime() - byName![0].where.bookingDate.gte.getTime();
    expect(Math.round(span / (24 * 3600 * 1000))).toBe(366);
  });

  it("sans nom, la lecture par nom n'a pas lieu du tout", async () => {
    await lookup({});
    expect(findBookings.mock.calls.every(c => !c[0].where.bookingDate?.lte)).toBe(true);
  });
});
