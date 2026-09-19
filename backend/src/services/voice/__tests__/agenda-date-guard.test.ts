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
    /* Le compteur d'échecs par outil (16/09/2026). Absent du bouchon, l'appel
       levait et l'outil rendait « AGENDA INDISPONIBLE »: un repli sûr, mais
       qui masquait le vrai message. */
    noteToolFailure: vi.fn(() => 1),
    /* Le compteur d'annonce d'une année AUTRE (17/09/2026). Le défaut du
       bouchon est 2 = « déjà annoncée, l'appelant a confirmé », parce que les
       fixtures de ce fichier datent en 2099 pour être toujours dans le futur:
       sans ça le garde-fou répondrait à leur place. Le test qui le vise le
       remet à 1. */
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
const { callSessionStore } = await import('../call-session.store');

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

  it('une liste FILTREE dit sur quoi elle est filtree, et interdit d\'inventer une fermeture', async () => {
    /* Appel réel du 16/09/2026, cabinet ouvert 9 h-18 h le vendredi.
       L'appelant veut « plus tôt », le modèle appelle avec
       `partOfDay: 'morning'`, et l'ancien résultat disait « TOUS les creneaux
       libres de la plage » sans nommer la plage. L'agent a répondu « on est
       fermé l'après-midi », puis l'a CONFIRMÉ quand l'appelant l'a répété.
       Une fermeture inventée est un fait FAUX sur l'entreprise, dit à un
       client qui voulait venir. */
    freeSlots.mockResolvedValueOnce(['09:00', '09:30', '11:00', '14:00', '16:00']);
    const out = String(await check({ date: '2099-09-18', partOfDay: 'morning' }));
    expect(out).toContain('ouvert 09:00-18:00');
    expect(out).toContain('le MATIN');
    expect(out).toMatch(/filtree/i);
    expect(out).toContain("le reste de la journee n'a pas ete regarde");
    expect(out).toMatch(/N'annonce JAMAIS une fermeture/);
    /* Et la formulation qui a produit le défaut ne revient pas sur une liste
       filtrée: elle dirait que la journée entière tient dans ces créneaux. */
    expect(out).not.toContain('TOUS les creneaux libres de la journee');
    expect(out).not.toContain('14:00');
  });

  it('sans filtre, la liste est celle de la JOURNEE, et le dit', async () => {
    freeSlots.mockResolvedValueOnce(['09:00', '14:00']);
    const out = String(await check({ date: '2099-09-18' }));
    expect(out).toContain('TOUS les creneaux libres de la journee');
    expect(out).toMatch(/N'annonce JAMAIS une fermeture/);
  });

  it('un agenda PLEIN n\'est pas une fermeture, et le resultat le dit', async () => {
    /* « Tout est pris » se transforme en « on est fermé » dans la bouche du
       modèle si le résultat ne tranche pas. */
    freeSlots.mockResolvedValueOnce([]);
    const out = String(await check({ date: '2099-09-18' }));
    expect(out).toMatch(/^AUCUN CRENEAU/);
    expect(out).toContain('OUVERTE ce jour-la');
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

  /* Ce que le docteur a montré sur cet appel: `customerName: "client"`.
     Le modèle a rempli le champ obligatoire avec un mot, et l'outil l'a
     pris pour un inconnu à faire épeler. */
  it('« client » n\'est pas un nom: rien n\'est réservé, et le résultat le dit', async () => {
    const out = await book({ customerName: 'client', date: '2099-09-16', time: '09:00' });
    expect(out).toMatch(/^RIEN N'EST RESERVE: il manque un vrai nom \(« client » n'est pas un nom, ne l'invente pas\)\./);
    expect(out).toMatch(/ne raccroche pas/);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('un prénom seul: il manque le nom de famille, et rien n\'est réservé', async () => {
    const out = await book({ customerName: 'Marc', date: '2099-09-16', time: '09:00' });
    expect(out).toMatch(/^RIEN N'EST RESERVE: il manque le NOM DE FAMILLE \(tu n'as que « Marc »\)\./);
    expect(out).toMatch(/Demande à l'appelant son nom de famille/);
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

  it('la relecture du nom commence par « rien n\'est encore réservé »', async () => {
    needsNameReadBack.mockReturnValue(true);
    const out = await book({ customerName: 'Mathieu Polle', date: '2099-09-16', time: '09:00' });
    expect(out).toMatch(/^RIEN N'EST ENCORE RESERVE, ne l'annonce pas et ne raccroche pas\. NOM À CONFIRMER AVANT DE RÉSERVER/);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('fait confirmer le nom avant de réserver, et ne réserve pas encore', async () => {
    needsNameReadBack.mockReturnValueOnce(true);
    const out = String(await book({ customerName: 'Paul Matthieu', date: '2099-09-17', time: '09:00' }));
    expect(out).toMatch(/NOM À CONFIRMER AVANT DE RÉSERVER: « Paul Matthieu »/);
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

  /**
   * Le garde de boucle (16/09/2026).
   *
   * Appel réel: `rescheduleBooking` appelé NEUF fois avec les mêmes arguments,
   * 2,4 à 9,4 secondes chacun, pendant que l'appelant entendait « je déplace
   * votre rendez-vous » à chaque tour. Deux causes: le résultat INVITAIT le
   * rappel (« puis rappelle rescheduleBooking avec ce nom »), et rien ne
   * comptait les essais. Puis l'agent a promis « je note et je transmets à
   * l'équipe » sans un seul appel à captureLead: personne n'a jamais rappelé.
   *
   * La règle vient de 6septies, payée sur les numéros dictés: au DEUXIÈME
   * échec on change de canal. La cause ne bouge pas entre deux essais.
   */
  it('invite UN seul rappel, puis coupe court', async () => {
    const { callSessionStore } = await import('../call-session.store');
    let essais = 0;
    (callSessionStore.noteToolFailure as any).mockImplementation(() => ++essais);

    const premier = await move({ date: '2099-10-05', time: '09:00' });
    expect(premier).toMatch(/rappelle rescheduleBooking/);
    expect(premier).toMatch(/une seule fois/i);

    const second = await move({ date: '2099-10-05', time: '09:00' });
    // Au deuxième, le résultat cesse d'inviter le rappel et le nomme.
    expect(second).toMatch(/N'appelle PLUS rescheduleBooking/);
    expect(second).not.toMatch(/rappelle rescheduleBooking avec ce nom/);
    // Et il exige l'outil qui enregistre le message, pas la seule promesse:
    // « je transmets à l'équipe » sans captureLead ne rappelle personne.
    expect(second).toMatch(/captureLead/);
    expect(updateBooking).not.toHaveBeenCalled();

    (callSessionStore.noteToolFailure as any).mockImplementation(() => 1);
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
    expect(out).toMatch(/RESERVATION\(S\) DE CE CORRESPONDANT: 1\) Lucas van Devel/);
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
    expect(out).toMatch(/RESERVATION\(S\) DE CE CORRESPONDANT: 1\) Jean-Luc de la forge/);
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

/**
 * UN DÉPLACEMENT DE PLUSIEURS MOIS SE CONFIRME, AVEC L'ANNÉE (17/09/2026).
 *
 * Appel réel. L'appelant dit « le 22 MARDI ». Le modèle entend « le 22 MARS »,
 * constate que mars 2026 est passé, et projette sur 2027. Il annonce même
 * « lundi 22 mars », exact pour 2027 — l'appelant disait mardi, et personne n'a
 * relevé. Le rendez-vous du 24 septembre est parti six mois plus loin et a
 * DISPARU de la vue du gérant, puisque le calendrier ne charge qu'un mois.
 *
 * Le garde-fou « date passée » ne pouvait rien: 2027 est dans le futur. Ce qui
 * manquait est une borne sur l'ÉCART.
 */
describe('date lointaine — confirmer avant d\'écrire', () => {
  const FAR = '2027-03-22';

  async function move(args: Record<string, unknown>) {
    const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'rescheduleBooking', args, toolCallId: 'tf' } as never);
    return String(out.result);
  }
  async function book(args: Record<string, unknown>) {
    const out = await toolRuntimeService.execute('c1', 'call_1', { name: 'bookAppointment', args, toolCallId: 'tf' } as never);
    return String(out.result);
  }

  beforeEach(() => {
    getProfile.mockResolvedValue(profile);
    /* 1 = première annonce, le cas que ce bloc mesure. */
    (callSessionStore.noteFarDateAnnounced as ReturnType<typeof vi.fn>).mockReturnValue(1);
  });

  it('ne déplace RIEN et fait dire l\'année à voix haute', async () => {
    const out = await move({ date: FAR, time: '17:00', customerName: 'Jean-Luc de la Forge' });
    expect(out).toMatch(/RIEN N'EST ENCORE ENREGISTRE/);
    expect(out).toMatch(/2027/);
    expect(out).toMatch(/AVEC L'ANNEE/);
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('nomme la cause probable: un JOUR DE LA SEMAINE pris pour un mois', async () => {
    const out = await move({ date: FAR, time: '17:00', customerName: 'Jean-Luc de la Forge' });
    expect(out).toMatch(/JOUR DE LA SEMAINE/);
  });

  it('protège aussi la PRISE de rendez-vous, pas seulement le déplacement', async () => {
    const out = await book({ date: FAR, time: '17:00', customerName: 'Jean-Luc de la Forge' });
    expect(out).toMatch(/RIEN N'EST ENCORE ENREGISTRE/);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('laisse passer une date de la même année, même LOINTAINE', async () => {
    /* Un premier essai bornait l'ÉCART à deux mois, et c'était faux: un
       contrôle dentaire à six mois est la norme du métier. Le signal est
       l'ANNÉE, pas la distance. */
    const thisYear = new Date().getFullYear();
    const out = await move({ date: `${thisYear}-12-28`, time: '10:00', customerName: 'Jean-Luc de la Forge' });
    expect(out).not.toMatch(/RIEN N'EST ENCORE ENREGISTRE/);
  });
});

/**
 * LE DOUBLON DANS L'AGENDA GOOGLE (17/09/2026).
 *
 * Capture d'écran du gérant: DEUX événements « Appointment - Jean-Luc de la
 * forge » sur le même créneau, mardi 22 à 14 h, pour UNE seule ligne en base.
 * L'audit du même appel montre `rescheduleBooking` appelé deux fois, à 141 s
 * et à 145 s, avec les mêmes arguments.
 *
 * La course: la mise à jour posait `googleEventId: null` AVANT un
 * `moveCalendarEvent` qui n'est pas attendu. Le second appel relisait donc
 * `null`, n'avait plus rien à supprimer, et créait un second événement.
 *
 * Deux gardes, et il faut les deux: l'idempotence ferme la CAUSE (un modèle
 * qui rappelle un outil avec les mêmes arguments est le comportement connu de
 * ce chemin, 6sexquadragesies), et garder `googleEventId` ferme la course.
 */
describe('rescheduleBooking — déplacer deux fois au même endroit', () => {
  beforeEach(() => {
    /* Les fixtures datent en 2099 pour rester dans le futur, donc le garde-fou
       d'ANNÉE répondrait à leur place. 2 = « déjà annoncée, l'appelant a
       confirmé », le défaut du bouchon en tête de fichier, qu'un describe
       précédent a pu ramener à 1. */
    (callSessionStore.noteFarDateAnnounced as unknown as { mockReturnValue: (v: number) => void }).mockReturnValue(2);
  });

  const upcoming = {
    id: 'b-move', customerName: 'Jean-Luc de la Forge', customerPhone: '32483620980',
    bookingDate: new Date('2099-01-13T12:00:00.000Z'), bookingTime: '14:00',
    serviceType: null, googleEventId: 'evt-old',
  };

  it("ne retouche RIEN quand le rendez-vous y est déjà, et dit de ne plus rappeler", async () => {
    findBookings.mockResolvedValue([upcoming]);
    const out = String((await toolRuntimeService.execute('c1', 'call_1', {
      name: 'rescheduleBooking', args: { date: '2099-01-13', time: '14:00' }, toolCallId: 't9',
    } as never)).result);
    expect(out).toMatch(/^DEJA FAIT/);
    expect(out).toMatch(/N'appelle PLUS rescheduleBooking/);
    /* Rien n'est écrit: pas de seconde écriture, donc pas de second
       événement Google. C'est la ligne qui ferme le doublon. */
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it('un VRAI déplacement écrit toujours', async () => {
    findBookings.mockResolvedValue([upcoming]);
    const out = String((await toolRuntimeService.execute('c1', 'call_1', {
      name: 'rescheduleBooking', args: { date: '2099-01-13', time: '15:00' }, toolCallId: 't10',
    } as never)).result);
    expect(out).toMatch(/^DEPLACE/);
    expect(updateBooking).toHaveBeenCalled();
  });

  it("n'efface PAS `googleEventId` en écrivant: c'est la seule référence de l'ancien événement", async () => {
    findBookings.mockResolvedValue([upcoming]);
    await toolRuntimeService.execute('c1', 'call_1', {
      name: 'rescheduleBooking', args: { date: '2099-01-13', time: '16:00' }, toolCallId: 't11',
    } as never);
    const data = updateBooking.mock.calls[0][0].data;
    expect(data.bookingTime).toBe('16:00');
    /* La forme fautive: `googleEventId: null` ici perdait l'ancien événement
       pour tout appel concurrent, qui n'avait alors plus rien à supprimer. */
    expect(data).not.toHaveProperty('googleEventId');
  });
});

/**
 * LE JOUR DE LA SEMAINE FAIT FOI (17/09/2026).
 *
 * « J'avais demandé lundi prochain, et il a dit lundi 22 septembre. Sauf que
 * le 22 septembre, c'est un mardi. » Le résultat disait pourtant « mardi »:
 * le jour y est depuis 6novovicies. Ce qui manquait n'est pas le FAIT, c'est
 * la consigne de s'y tenir, le modèle ayant déjà une phrase à lui.
 */
describe('checkAvailability — le jour de la semaine', () => {
  it('nomme le jour en capitales et interdit d\'en annoncer un autre', async () => {
    const out = String(await check({ date: '2099-01-13' }));
    expect(out).toMatch(/Ce jour est un [A-ZÉÛ]+/);
    expect(out).toMatch(/fait foi/);
    expect(out).toMatch(/N'annonce jamais un jour de semaine different/);
  });
});
