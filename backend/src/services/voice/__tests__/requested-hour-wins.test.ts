import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'HEURE QUE L'APPELANT A DITE GAGNE, et elle revient par le résultat d'outil.
 *
 * Appel réel du 18/09/2026, déplacement d'un rendez-vous existant de 14:00.
 * Neuf créneaux lus à voix haute, l'appelant répond « 13 heures », et l'agent
 * propose « 14 heures » — son ancienne heure — TROIS fois, malgré deux
 * corrections explicites:
 *
 *   APPELANT  13 heures.
 *   IA        donc le créneau du lundi 21 septembre à 14 heures vous convient-il
 *   APPELANT  Non, 13 heures. Lundi 13 heures.
 *   IA        Donc je vous propose de déplacer à 14 heures
 *   APPELANT  Je n'ai pas dit 14 heures, j'ai dit 13 heures.
 *
 * « Propose-les un par un » était déjà écrit dans le résultat et n'a pas été
 * suivi: une consigne noyée ne gagne pas contre une liste que le modèle a sous
 * les yeux. Ce qu'il faut lui donner, c'est la PHRASE à dire.
 */
const { getProfile, freeSlots, createBooking, needsNameReadBack, findBooking, findBookings, updateBooking } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  freeSlots: vi.fn(),
  createBooking: vi.fn(),
  needsNameReadBack: vi.fn(),
  findBooking: vi.fn(),
  findBookings: vi.fn(),
  updateBooking: vi.fn(),
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    clientBooking: { create: createBooking, update: updateBooking, findFirst: findBooking, findMany: findBookings },
    client: { findUnique: vi.fn(() => Promise.resolve(null)) },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile, getCallerHistory: vi.fn(async () => ({ knownName: 'Connu' })) },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: vi.fn(() => ({ callerNumber: '32483620980' })),
    recordToolCall: vi.fn(),
    heldSlots: vi.fn(() => []),
    holdSlot: vi.fn(),
    markBooked: vi.fn(),
    recordLead: vi.fn(),
    markLeadActivity: vi.fn(),
    needsNameReadBack,
    needsNameSpelling: vi.fn(() => false),
    noteToolFailure: vi.fn(() => 1),
    noteFarDateAnnounced: vi.fn(() => 2),
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember: vi.fn() } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({
  availabilitySpeculator: { freeSlots, take: vi.fn(), speculate: vi.fn() },
}));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const { toolRuntimeService } = await import('../tool-runtime.service');

const profile = {
  clientId: 'c1', businessName: 'Demtalix', language: 'fr', country: 'BE',
  timezone: 'Europe/Brussels', bookingEnabled: true, calendarConnected: true,
  weekHours: {
    monday: { open: true, from: '09:00', to: '18:00' }, tuesday: { open: true, from: '09:00', to: '18:00' },
    wednesday: { open: true, from: '09:00', to: '18:00' }, thursday: { open: true, from: '09:00', to: '18:00' },
    friday: { open: true, from: '09:00', to: '18:00' }, saturday: { open: false, from: '10:00', to: '16:00' },
    sunday: { open: false, from: '10:00', to: '16:00' },
  },
};

/** La journée exacte de l'appel réel, projetée dans le futur pour rester valide. */
const NINE_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const MONDAY = '2099-09-21';

async function check(args: Record<string, unknown>) {
  const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'checkAvailability', args, toolCallId: 't1' } as never);
  return String(out.result);
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  findBookings.mockResolvedValue([]);
  freeSlots.mockResolvedValue(NINE_SLOTS);
  createBooking.mockResolvedValue({ id: 'b1' });
  needsNameReadBack.mockReturnValue(false);
  updateBooking.mockResolvedValue({});
  findBooking.mockResolvedValue(null);
});

describe("checkAvailability — l'heure demandée", () => {
  it("nomme l'heure de l'appelant et interdit d'en proposer une autre", async () => {
    const out = await check({ date: MONDAY, preferredTime: '13:00' });
    expect(out).toMatch(/^13:00 EST LIBRE/);
    expect(out).toContain("C'est l'heure que l'appelant vient de demander");
    expect(out).toContain('confirme 13:00');
    expect(out).toContain("ne propose AUCUNE autre heure");
  });

  it("LE DEFAUT DU 18/09: 14:00 est libre aussi, et le resultat ne le met pas dans la bouche du modele", async () => {
    /* C'est le cœur de la régression: l'ancien rendez-vous de l'appelant est à
       14:00, la liste contient 13:00 ET 14:00, et le modèle a lu son ancre.
       Le résultat ne doit nommer QUE 13:00 comme heure à confirmer. */
    const out = await check({ date: MONDAY, preferredTime: '13:00' });
    expect(out).toContain('13:00');
    expect(out).not.toContain('14:00');
    /* Et la liste entière n'est pas rendue: elle est ce qui a fait lire neuf
       créneaux à voix haute, dont celui qui a servi d'ancre. */
    expect(out).not.toContain('09:00, 10:00');
  });

  it("dit que l'heure est prise et propose la plus proche, une seule", async () => {
    freeSlots.mockResolvedValueOnce(['09:00', '12:00', '14:00', '17:00']);
    const out = await check({ date: MONDAY, preferredTime: '13:00' });
    expect(out).toMatch(/^13:00 N'EST PAS LIBRE/);
    expect(out).toContain('13:00 est deja pris');
    expect(out).toContain('propose 12:00');
    expect(out).toContain("S'il refuse: 14:00");
    expect(out).toContain('pas la liste');
  });

  it("rend les deux plus proches dans l'ordre de la JOURNEE, pas de l'ecart", async () => {
    /* « 14:00 et 12:00 » sortirait tel quel de la bouche de l'agent. */
    freeSlots.mockResolvedValueOnce(['09:00', '12:30', '14:00']);
    const out = await check({ date: MONDAY, preferredTime: '13:00' });
    expect(out.indexOf('12:30')).toBeLessThan(out.indexOf('14:00'));
  });

  it("lit « 13h », « 13h00 » et « 13 » comme 13:00", async () => {
    /* Le modèle écrit ce qu'il entend. Une heure illisible retomberait en
       silence sur la liste entière, c'est-à-dire sur le défaut lui-même. */
    for (const spoken of ['13h', '13h00', '13', '13:00']) {
      expect(await check({ date: MONDAY, preferredTime: spoken })).toMatch(/^13:00 EST LIBRE/);
    }
  });

  it("ignore une heure illisible et retombe sur la liste, sans mentir", async () => {
    const out = await check({ date: MONDAY, preferredTime: 'dans l\'apres-midi' });
    expect(out).toMatch(/^LIBRE le/);
    expect(out).not.toContain('EST LIBRE le lundi');
  });

  it("une heure hors des heures d'ouverture est traitee comme prise", async () => {
    freeSlots.mockResolvedValueOnce(['09:00', '10:00']);
    const out = await check({ date: MONDAY, preferredTime: '22:00' });
    expect(out).toMatch(/^22:00 N'EST PAS LIBRE/);
    expect(out).toContain('ouvert 09:00-18:00');
  });
});

describe('checkAvailability — sans heure demandée', () => {
  it("nomme le creneau a proposer au lieu de laisser lire la liste", async () => {
    const out = await check({ date: MONDAY });
    expect(out).toMatch(/^LIBRE le lundi 21 septembre 2099/);
    /* La connaissance reste entière (6untrigesies: une liste coupée faisait
       dire « le plus tard, c'est 11 heures »), c'est la PAROLE qui se limite. */
    expect(out).toContain('09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00');
    expect(out).toContain('NE LIS PAS CETTE LISTE A VOIX HAUTE');
    expect(out).toContain("propose 09:00 d'abord");
  });

  it('garde le jour de semaine et la fenêtre, qui ont leurs propres régressions', async () => {
    const out = await check({ date: MONDAY });
    expect(out).toContain('Ce jour est un LUNDI');
    expect(out).toContain('ouvert 09:00-18:00');
  });
});
