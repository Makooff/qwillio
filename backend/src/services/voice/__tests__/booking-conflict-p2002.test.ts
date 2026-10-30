import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * LE CRÉNEAU PEUT ÊTRE PRIS ENTRE LA VÉRIFICATION ET L'ÉCRITURE.
 *
 * Les « holds » de créneau vivent en mémoire DU PROCESSUS: ils empêchent deux
 * tours d'un MÊME appel de réserver deux fois, et rien d'autre. Deux appels
 * simultanés — ou deux instances — passent donc tous deux la vérification de
 * disponibilité, et la course ne se tranche qu'à l'écriture, par l'index
 * unique partiel `client_bookings_slot_unique` (migration
 * 20260813170000_booking_no_double_and_calendar_reconcile). Prisma la signale
 * par P2002.
 *
 * Ce que ça coûte si l'outil se tait mal: l'agent annonce « c'est réservé »
 * pour une ligne qui n'existe pas, un SMS de confirmation part pour un
 * rendez-vous fantôme, et le hold local bloque un créneau que la base a refusé.
 *
 * RAPPEL DE MÉTHODE, et il est important: ces tests bouchonnent Prisma. Ils
 * prouvent le COMPORTEMENT de la branche P2002 du runtime, pas que la
 * migration a été appliquée sur la base de production — la contrainte réelle
 * ne se vérifie que contre Postgres. (Voir le rapport: validation live à
 * conditionner côté parent.)
 */

const h = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getCallerHistory: vi.fn(),
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
  findClient: vi.fn(),
  holdSlot: vi.fn(),
  markBooked: vi.fn(),
  recordToolCall: vi.fn(),
  senderFor: vi.fn(),
  sendConfirmSms: vi.fn(),
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    clientBooking: {
      create: h.createBooking,
      update: h.updateBooking,
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    client: { findUnique: h.findClient },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: h.getProfile, getCallerHistory: h.getCallerHistory },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: vi.fn(() => ({ callerNumber: '+32483600000', clientCallId: 'cc1' })),
    holdSlot: h.holdSlot,
    markBooked: h.markBooked,
    recordToolCall: h.recordToolCall,
    needsNameReadBack: vi.fn(() => false),
    needsNameSpelling: vi.fn(() => false),
    noteFarDateAnnounced: vi.fn(() => 2),
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember: vi.fn() } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({
  availabilitySpeculator: { freeSlots: vi.fn(), take: vi.fn(), speculate: vi.fn(), invalidate: vi.fn() },
}));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));
vi.mock('../../outlook-calendar.service', () => ({ outlookCalendarService: {} }));
vi.mock('../../sms-ready', () => ({ smsReadiness: () => ({ ok: true }) }));
vi.mock('../../sms.service', () => ({
  smsService: { senderFor: h.senderFor, sendBookingConfirmationSMS: h.sendConfirmSms },
}));

const { toolRuntimeService } = await import('../tool-runtime.service');

/** Semaine entièrement ouverte: aucune garde « jour fermé / hors horaires ». */
const weekHours = Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map(d => [d, { open: true, from: '08:00', to: '20:00' }]),
);

const profile = {
  clientId: 'c1', businessName: 'Garage Leblanc', language: 'fr', country: 'BE',
  timezone: 'Europe/Brussels', weekHours, bookingEnabled: true, calendarConnected: true,
};

/** Un jour de la SEMAINE, dans l'année EN COURS (garde « date lointaine »). */
function nextWeekdayYmd(from = new Date()): string {
  for (let i = 3; i < 10; i++) {
    const d = new Date(from.getTime() + i * 24 * 3600 * 1000);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) return d.toISOString().slice(0, 10);
  }
  throw new Error('no weekday found');
}

const DATE = nextWeekdayYmd();
const ARGS = { date: DATE, time: '14:00', customerName: 'Jean Dupont' };

/** Laisse les `void this.sendBookingSms(...)` / `void this.syncBookingToCalendar(...)` se vider. */
const flush = async () => { await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); };

const p2002 = () => Object.assign(new Error('Unique constraint failed on the fields: (`client_id`,`booking_date`,`booking_time`)'), { code: 'P2002' });

const book = (language = 'fr') =>
  toolRuntimeService.execute('c1', 'call_1', {
    name: 'bookAppointment', args: ARGS, toolCallId: 't1',
  } as never).then(r => ({ reply: String(r.result), lang: language }));

beforeEach(() => {
  vi.clearAllMocks();
  h.getProfile.mockResolvedValue(profile);
  h.getCallerHistory.mockResolvedValue({ knownName: 'Jean Dupont' });
  h.findClient.mockResolvedValue(null);
  h.senderFor.mockResolvedValue('+32483600000');
  h.sendConfirmSms.mockResolvedValue(true);
  h.updateBooking.mockResolvedValue({});
});

describe('bookAppointment — le créneau est pris entre la lecture et l’écriture (P2002)', () => {
  it('propose un autre créneau au lieu d’annoncer une réservation', async () => {
    h.createBooking.mockRejectedValue(p2002());
    const { reply } = await book();
    expect(reply).toContain('CRENEAU DEJA PRIS');
    expect(reply).toMatch(/autre cr[eé]neau/);
    /* Le pire scénario, gelé: « c'est réservé » pour une ligne qui n'existe pas. */
    expect(reply).not.toContain('RESERVE:');
  });

  it('pose le hold ET le SMS de confirmation uniquement quand la ligne EXISTE', async () => {
    h.createBooking.mockRejectedValue(p2002());
    await book();
    await flush();
    expect(h.holdSlot).not.toHaveBeenCalled();
    expect(h.markBooked).not.toHaveBeenCalled();
    expect(h.sendConfirmSms).not.toHaveBeenCalled();
    expect(h.updateBooking).not.toHaveBeenCalled();
  });

  it('dit la même chose en anglais', async () => {
    h.getProfile.mockResolvedValue({ ...profile, language: 'en' });
    h.createBooking.mockRejectedValue(p2002());
    const { reply } = await book('en');
    expect(reply).toContain('SLOT TAKEN');
    expect(reply).toMatch(/another slot/);
    expect(reply).not.toContain('BOOKED:');
  });

  it('ne laisse pas la création partielle se lire comme un succès', async () => {
    /* create a levé APRÈS avoir écrit: peu probable avec une contrainte unique,
       mais la branche catch doit couvrir toute erreur Prisma. On vérifie que
       la réponse ne contient AUCUN marqueur de confirmation. */
    h.createBooking.mockRejectedValue(Object.assign(new Error('connection reset'), { code: undefined }));
    const { reply } = await book();
    expect(reply).not.toContain('RESERVE:');
    expect(reply).not.toContain('CRENEAU DEJA PRIS'); // ce n'est PAS un conflit
    expect(h.holdSlot).not.toHaveBeenCalled();
    await flush();
    expect(h.sendConfirmSms).not.toHaveBeenCalled();
  });

  it('témoin: création OK → hold, marquage ET SMS de confirmation partent', async () => {
    /* Sans ce témoin, les assertions négatives ci-dessus pourraient passer
       parce que le chemin du succès est tout simplement cassé. */
    h.createBooking.mockResolvedValue({ id: 'bk1' });
    const { reply } = await book();
    expect(reply).toContain('RESERVE:');
    expect(h.holdSlot).toHaveBeenCalledWith('c1', expect.any(Date), '14:00');
    expect(h.markBooked).toHaveBeenCalledWith('call_1', 'bk1');
    await flush();
    expect(h.sendConfirmSms).toHaveBeenCalledOnce();
  });
});

describe('la branche P2002 est branchée AVANT tout effet de bord', () => {
  it('le catch P2002 précède holdSlot, markBooked et le SMS, sur les deux outils qui écrivent', async () => {
    const src = (await import('fs')).readFileSync(
      (await import('path')).join(__dirname, '..', 'tool-runtime.service.ts'), 'utf8',
    );
    const p2002Branches = src.match(/code === 'P2002'/g) ?? [];
    /* bookAppointment ET rescheduleBooking écrivent le même créneau: les deux
       doivent passer par la même branche. */
    expect(p2002Branches.length).toBeGreaterThanOrEqual(2);

    const bookRegion = src.slice(src.indexOf('private async bookAppointment'), src.indexOf('// ── lookupBooking'));
    const conflict = bookRegion.indexOf("code === 'P2002'");
    expect(conflict).toBeGreaterThan(-1);
    expect(conflict).toBeLessThan(bookRegion.indexOf('holdSlot'));
    expect(conflict).toBeLessThan(bookRegion.indexOf('sendBookingSms'));
    expect(conflict).toBeLessThan(bookRegion.indexOf('syncBookingToCalendar'));
  });
});
