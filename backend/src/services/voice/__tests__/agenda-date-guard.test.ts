import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'agenda refuse une date PASSÉE en nommant le jour d'aujourd'hui.
 *
 * Appel réel du 12/09/2026: le modèle demande les créneaux du 17 juin. Lui
 * répondre « aucun créneau » le ferait proposer le 18 juin; il s'est trompé
 * de mois, pas de créneau, et la seule chose qui lui manque est la date du
 * jour. Et un jour libre est rendu AVEC son jour de semaine: « lundi 17
 * juin » annoncé pour un jour qui n'était pas un lundi.
 */
const { getProfile, freeSlots, createBooking, needsNameReadBack } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  freeSlots: vi.fn(),
  createBooking: vi.fn(),
  needsNameReadBack: vi.fn(),
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    clientBooking: { create: createBooking, update: vi.fn(() => Promise.resolve({})) },
    // Pas d'agenda lié: la synchronisation, lancée sans être attendue, s'arrête là.
    client: { findUnique: vi.fn(() => Promise.resolve(null)) },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: vi.fn(() => ({ callerNumber: null })),
    recordToolCall: vi.fn(),
    heldSlots: vi.fn(() => []),
    holdSlot: vi.fn(),
    markBooked: vi.fn(),
    recordLead: vi.fn(),
    markLeadActivity: vi.fn(),
    needsNameReadBack,
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
  /* Les horaires du portail: fermé le week-end. */
  weekHours: {
    monday: { open: true, from: '09:00', to: '18:00' }, tuesday: { open: true, from: '09:00', to: '18:00' },
    wednesday: { open: true, from: '09:00', to: '18:00' }, thursday: { open: true, from: '09:00', to: '18:00' },
    friday: { open: true, from: '09:00', to: '18:00' }, saturday: { open: false, from: '10:00', to: '16:00' },
    sunday: { open: false, from: '10:00', to: '16:00' },
  },
};

async function check(args: Record<string, unknown>) {
  const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'checkAvailability', args, toolCallId: 't1' } as never);
  return out.result;
}

async function book(args: Record<string, unknown>) {
  const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'bookAppointment', args, toolCallId: 't2' } as never);
  return out.result;
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  freeSlots.mockResolvedValue(['09:00', '10:30']);
  createBooking.mockResolvedValue({ id: 'b1' });
  needsNameReadBack.mockReturnValue(false);
});

describe('checkAvailability — la date', () => {
  it('refuse une date passée et nomme le jour d\'aujourd\'hui', async () => {
    const out = String(await check({ date: '2024-06-17' }));
    expect(out).toMatch(/^DATE PASSEE/);
    expect(out).toContain('Nous sommes le ');
    expect(freeSlots).not.toHaveBeenCalled();
  });

  it('rend un jour libre AVEC son jour de semaine', async () => {
    const out = String(await check({ date: '2099-09-16' }));
    expect(out).toMatch(/^LIBRE le mercredi 16 septembre 2099 \(2099-09-16\)/);
  });

  /* Un rendez-vous pris un DIMANCHE chez un commerce fermé le dimanche (appel
     réel, 12/09/2026): l'agenda ne lisait pas les horaires du portail. */
  it('refuse un jour fermé et nomme le prochain jour ouvert, sans lire l\'agenda', async () => {
    const out = String(await check({ date: '2099-09-13' }));
    expect(out).toMatch(/^FERME le dimanche 13 septembre 2099/);
    expect(out).toContain('lundi 14 septembre 2099 (2099-09-14)');
    expect(freeSlots).not.toHaveBeenCalled();
  });
});

describe('bookAppointment — le nom et le jour', () => {
  /* « Polle » entendu « Paul » (appel réel, 12/09/2026): le nom est relu
     AVANT d'écrire dans l'agenda, une fois par nom et par appel. */
  it('fait confirmer le nom avant de réserver, et ne réserve pas encore', async () => {
    needsNameReadBack.mockReturnValueOnce(true);
    const out = String(await book({ customerName: 'Paul Matthieu', date: '2099-09-17', time: '09:00' }));
    expect(out).toMatch(/^NOM À CONFIRMER AVANT DE RÉSERVER: « Paul Matthieu »/);
    // L'agent épelle LUI-MÊME le nom de famille: « Polle » relu se confond avec « Paul », pas ses lettres.
    expect(out).toContain('M-A-T-T-H-I-E-U');
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('réserve une fois le nom confirmé, en nommant le jour, avec un nom épelé recollé', async () => {
    const out = String(await book({ customerName: 'Mathieu P O L L E', date: '2099-09-17', time: '09:00' }));
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(createBooking.mock.calls[0][0].data.customerName).toBe('Mathieu Polle');
    expect(out).toMatch(/^RESERVE: Mathieu Polle, le jeudi 17 septembre 2099 a 09:00/);
    // Pas de SMS promis: SMS_ENABLED n'est pas posé dans les tests.
    expect(out).not.toMatch(/SMS/);
  });

  it('refuse de réserver un jour fermé ou hors horaires', async () => {
    const sunday = String(await book({ customerName: 'Mathieu Polle', date: '2099-09-13', time: '10:00' }));
    expect(sunday).toMatch(/^FERME le dimanche/);
    const late = String(await book({ customerName: 'Mathieu Polle', date: '2099-09-17', time: '20:00' }));
    expect(late).toMatch(/^HORS HORAIRES: le jeudi 17 septembre 2099, l'entreprise est ouverte de 09:00 a 18:00/);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('refuse une date passée avant même de réserver', async () => {
    const out = String(await book({ customerName: 'Mathieu Polle', date: '2024-06-17', time: '09:00' }));
    expect(out).toMatch(/^DATE PASSEE/);
    expect(createBooking).not.toHaveBeenCalled();
  });
});
