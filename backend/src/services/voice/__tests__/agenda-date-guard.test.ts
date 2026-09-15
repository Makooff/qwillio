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
    // Pas d'agenda lié: la synchronisation, lancée sans être attendue, s'arrête là.
    client: { findUnique: vi.fn(() => Promise.resolve(null)) },
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../realtime-context.service', () => ({
  // Appelant CONNU: l'épellation du nom a son propre test (first-caller-spells).
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
  findBookings.mockResolvedValue([]);
  freeSlots.mockResolvedValue(['09:00', '10:30']);
  createBooking.mockResolvedValue({ id: 'b1' });
  needsNameReadBack.mockReturnValue(false);
  updateBooking.mockResolvedValue({});
  findBooking.mockResolvedValue(null);
});

describe('checkAvailability — la date', () => {
  it('refuse une date passée et nomme le jour d\'aujourd\'hui', async () => {
    const out = String(await check({ date: '2024-06-17' }));
    expect(out).toMatch(/^DATE PASSEE/);
    expect(out).toContain('Nous sommes le ');
    expect(freeSlots).not.toHaveBeenCalled();
  });

  it('rend un jour libre AVEC son jour de semaine, la fenêtre d\'ouverture et TOUS les créneaux', async () => {
    /* « Le plus tard, c'est 11 heures » pour un cabinet ouvert jusqu'à 18 h
       (13/09/2026): la liste était coupée à trois. */
    freeSlots.mockResolvedValueOnce(['09:00', '10:00', '11:00', '14:00', '16:00']);
    const out = String(await check({ date: '2099-09-16' }));
    expect(out).toMatch(/^LIBRE le mercredi 16 septembre 2099 \(2099-09-16, ouvert 09:00-18:00\) a: 09:00, 10:00, 11:00, 14:00, 16:00\./);
    expect(out).toContain('TOUS les creneaux');
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
  /* Appel réel du 15/09/2026: « oui je confirme » → « je vous réserve ça »,
     sans nom, donc sans réservation ni SMS. Le résultat dit que RIEN n'est
     pris, ce qui manque, et quoi faire. */
  it('sans nom: dit que rien n\'est réservé, demande prénom et nom, et n\'écrit rien', async () => {
    const out = await book({ date: '2099-09-16', time: '09:00' });
    expect(out).toMatch(/^RIEN N'EST RESERVE: il manque le prénom et le NOM DE FAMILLE\./);
    expect(out).toMatch(/rappelle bookAppointment/);
    expect(out).toMatch(/Ne dis pas « je vous réserve »/);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('sans heure: nomme l\'heure, pas le nom', async () => {
    const out = await book({ customerName: 'Marc Dupont', date: '2099-09-16' });
    expect(out).toMatch(/^RIEN N'EST RESERVE: il manque l'heure exacte\./);
    expect(out).not.toMatch(/NOM DE FAMILLE/);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('les créneaux disent que réserver demande prénom et nom de famille', async () => {
    freeSlots.mockResolvedValue(['09:00', '11:00']);
    const out = await check({ date: '2099-09-16' });
    expect(out).toMatch(/prenom et nom de famille .*puis bookAppointment; c'est reserve seulement apres son retour RESERVE\.$/);
  });

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

/* « Je dois modifier la date » finissait en bookAppointment: un second
   rendez-vous, l'ancien toujours dans l'agenda (appel réel, 12/09/2026). */
describe('rescheduleBooking — déplacer, pas dupliquer', () => {
  async function move(args: Record<string, unknown>) {
    const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'rescheduleBooking', args, toolCallId: 't3' } as never);
    return String(out.result);
  }

  it('retrouve la réservation par le numéro et la déplace, sans en créer une autre', async () => {
    findBookings.mockResolvedValueOnce([{
      id: 'b1', customerName: 'Stéphane Van Hold', customerPhone: '32483620980', bookingDate: new Date('2099-10-04T12:00:00Z'),
      bookingTime: '14:00', serviceType: 'extraction', googleEventId: null,
    }]);
    const out = await move({ date: '2099-10-05', time: '09:00' });
    expect(out).toMatch(/^DEPLACE: Stéphane Van Hold, du dimanche 4 octobre 2099 14:00 au lundi 5 octobre 2099 a 09:00/);
    // La première écriture est le déplacement; la synchronisation d'agenda (sans agenda lié) en ajoute une.
    expect(updateBooking.mock.calls[0][0].where).toEqual({ id: 'b1' });
    expect(updateBooking.mock.calls[0][0].data.bookingTime).toBe('09:00');
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('refuse un jour fermé avant même de chercher la réservation', async () => {
    const out = await move({ date: '2099-10-04', time: '14:00' });
    expect(out).toMatch(/^FERME le dimanche/);
    expect(findBookings).not.toHaveBeenCalled();
  });

  it("dit qu'il n'y a rien à déplacer quand aucune réservation n'existe", async () => {
    const out = await move({ date: '2099-10-05', time: '09:00' });
    expect(out).toMatch(/^AUCUNE RESERVATION/);
    expect(updateBooking).not.toHaveBeenCalled();
  });
});

/* Appel réel du 13/09/2026: deux rendez-vous à venir pour le même numéro, et
   `findFirst` rendait toujours le premier par date (« Lucas van Devel,
   aujourd'hui 9 h »). Le modèle en concluait que celui du 14 n'existait pas,
   et a fait répéter le nom cinq fois: « de la Ford », « Delaforde », « de la
   foireux », « de la foire », « de la forge ». */
describe('lookupBooking — toutes les réservations de l\'appelant, le nom en ressemblance', () => {
  const rows = [
    { id: 'b0', customerName: 'Lucas van Devel', customerPhone: '32483620980', bookingDate: new Date('2099-09-13T07:00:00Z'), bookingTime: '09:00', serviceType: 'douleur', googleEventId: null },
    { id: 'b1', customerName: 'Jean-Luc de la forge', customerPhone: '32483620980', bookingDate: new Date('2099-09-14T15:00:00Z'), bookingTime: '17:00', serviceType: 'opération dents de sagesse', googleEventId: null },
  ];
  async function lookup(args: Record<string, unknown>) {
    const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'lookupBooking', args, toolCallId: 't4' } as never);
    return String(out.result);
  }

  it('liste les deux rendez-vous du numéro, sans nom', async () => {
    findBookings.mockResolvedValueOnce(rows);
    const out = await lookup({});
    expect(out).toMatch(/^RESERVATION\(S\) DE CE CORRESPONDANT: 1\) Lucas van Devel/);
    expect(out).toContain('2) Jean-Luc de la forge');
  });

  it('met en premier celui dont le nom RESSEMBLE, même mal transcrit', async () => {
    for (const heard of ['Jean-Luc de la Ford', 'Jean-Luc Delaforde', 'Jean-Luc de la foireux']) {
      findBookings.mockResolvedValueOnce(rows);
      const out = await lookup({ customerName: heard });
      expect(out, heard).toMatch(/1\) Jean-Luc de la forge, le .*14 septembre 2099 a 17:00/);
    }
  });

  it('la date dite par l\'appelant départage', async () => {
    findBookings.mockResolvedValueOnce(rows);
    const out = await lookup({ currentDate: '2099-09-14' });
    expect(out).toMatch(/1\) Jean-Luc de la forge/);
  });

  it('retrouve par le nom seul quand le numéro est un autre', async () => {
    findBookings.mockResolvedValueOnce(rows.map(r => ({ ...r, customerPhone: '32400000000' })));
    const out = await lookup({ customerName: 'de la forge' });
    expect(out).toMatch(/^RESERVATION\(S\) DE CE CORRESPONDANT: 1\) Jean-Luc de la forge/);
    expect(out).not.toContain('Lucas van Devel');
  });
});

describe('rescheduleBooking — deux rendez-vous, on demande lequel', () => {
  it('ne déplace pas au hasard', async () => {
    findBookings.mockResolvedValueOnce([
      { id: 'b0', customerName: 'A', customerPhone: '32483620980', bookingDate: new Date('2099-10-06T07:00:00Z'), bookingTime: '09:00', serviceType: null, googleEventId: null },
      { id: 'b1', customerName: 'B', customerPhone: '32483620980', bookingDate: new Date('2099-10-07T07:00:00Z'), bookingTime: '09:00', serviceType: null, googleEventId: null },
    ]);
    const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'rescheduleBooking', args: { date: '2099-10-08', time: '10:00' }, toolCallId: 't5' } as never);
    expect(String(out.result)).toMatch(/^PLUSIEURS RESERVATIONS/);
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('currentDate désigne celui à déplacer', async () => {
    findBookings.mockResolvedValueOnce([
      { id: 'b0', customerName: 'A', customerPhone: '32483620980', bookingDate: new Date('2099-10-06T07:00:00Z'), bookingTime: '09:00', serviceType: null, googleEventId: null },
      { id: 'b1', customerName: 'B', customerPhone: '32483620980', bookingDate: new Date('2099-10-07T07:00:00Z'), bookingTime: '09:00', serviceType: null, googleEventId: null },
    ]);
    const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'rescheduleBooking', args: { date: '2099-10-08', time: '10:00', currentDate: '2099-10-07' }, toolCallId: 't6' } as never);
    expect(String(out.result)).toMatch(/^DEPLACE: B/);
    expect(updateBooking.mock.calls[0][0].where).toEqual({ id: 'b1' });
  });
});
