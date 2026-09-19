import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * L'AGENT DEPLAÇAIT CE QU'ON LUI DEMANDAIT D'ANNULER (19/09/2026).
 *
 * Appel réel, mot pour mot:
 *
 *   Appelant: « Je voudrais ANNULER celui du 22. »
 *   Agent:    « Votre rendez-vous du 22 septembre est DEPLACE au vendredi
 *               25 septembre à 14 heures. »
 *
 * Le modèle n'a pas désobéi: il avait six outils, dont `rescheduleBooking`, et
 * AUCUN pour annuler. Il a fait la chose la plus proche qu'il avait sous la
 * main, et l'a annoncée comme faite. C'est 6quindecies mot pour mot, où
 * l'agent sans outil de transfert proposait de prendre un message, « ce qui
 * ressemble à un choix »: un agent privé d'un outil ne dit jamais « je ne peux
 * pas ».
 *
 * Pire que le geste manquant, et c'est ce qui rend le défaut si dur à voir en
 * lisant le code: la description de `lookupBooking` annonçait elle-même « to
 * confirm, move or CANCEL one ». La surface d'outils PROMETTAIT l'annulation.
 *
 * Ce que ça coûte quand personne ne regarde: le commerce garde un créneau que
 * le client croyait libéré, et le client reçoit un SMS de confirmation pour un
 * rendez-vous qu'il vient d'annuler.
 */

const { getProfile, findBookings, cancelRecord, markCancelled, noteToolFailure, invalidateDay } = vi.hoisted(() => ({
  getProfile: vi.fn(),
  findBookings: vi.fn(),
  cancelRecord: vi.fn(),
  markCancelled: vi.fn(),
  noteToolFailure: vi.fn(() => 1),
  invalidateDay: vi.fn(),
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    clientBooking: { findMany: findBookings, create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    client: { findUnique: vi.fn(async () => null) },
  },
}));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile, getCallerHistory: vi.fn(async () => ({})) },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: vi.fn(() => ({ callerNumber: '32483620980' })),
    recordToolCall: vi.fn(), heldSlots: vi.fn(() => []), holdSlot: vi.fn(),
    markBooked: vi.fn(), markCancelled,
    recordLead: vi.fn(), markLeadActivity: vi.fn(),
    needsNameReadBack: vi.fn(() => false), needsNameSpelling: vi.fn(() => false),
    noteToolFailure, noteFarDateAnnounced: vi.fn(() => 2),
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember: vi.fn() } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({
  availabilitySpeculator: { freeSlots: vi.fn(), take: vi.fn(), speculate: vi.fn(), invalidate: invalidateDay },
}));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));
vi.mock('../../booking-cancel', () => ({ cancelBooking: cancelRecord }));

const { toolRuntimeService } = await import('../tool-runtime.service');
const { buildVoiceTools } = await import('../voice-tools');

const profile = {
  clientId: 'c1', businessName: 'Demtalix', language: 'fr', country: 'BE',
  timezone: 'Europe/Brussels', bookingEnabled: true, calendarConnected: true, weekHours: {},
};

const inDays = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1', customerName: 'Jean-Luc de la Forge', customerPhone: '32483620980',
  bookingDate: inDays(3), bookingTime: '14:00', serviceType: 'controle', googleEventId: 'g1',
  ...over,
});

const cancel = async (args: Record<string, unknown> = {}) =>
  String((await toolRuntimeService.execute('c1', 'call_1', { name: 'cancelBooking', args, toolCallId: 't1' } as never)).result);

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  findBookings.mockResolvedValue([]);
  noteToolFailure.mockReturnValue(1);
  cancelRecord.mockResolvedValue({
    ok: true, alreadyCancelled: false,
    customerName: 'Jean-Luc de la Forge', bookingDate: inDays(3), bookingTime: '14:00',
  });
});

describe("l'outil existe, et la surface ne promet plus ce qu'elle n'a pas", () => {
  it('cancelBooking est offert dès que le client peut réserver', () => {
    const names = buildVoiceTools(profile as never)
      .map(t => (t as { function?: { name?: string } }).function?.name)
      .filter(Boolean);
    expect(names).toContain('cancelBooking');
  });

  it("lookupBooking promettait l'annulation: la promesse est désormais tenue", () => {
    /* La description disait « to confirm, move or cancel one » AVANT qu'aucun
       outil ne sache annuler. Une surface qui promet plus qu'elle ne porte est
       ce qui fait improviser le modèle. */
    const tools = buildVoiceTools(profile as never) as Array<{ function?: { name?: string; description?: string } }>;
    const lookup = tools.find(t => t.function?.name === 'lookupBooking');
    expect(lookup?.function?.description?.toLowerCase()).toContain('cancel');
    expect(tools.some(t => t.function?.name === 'cancelBooking')).toBe(true);
  });

  it("n'apparaît pas quand le client n'a pas d'agenda", () => {
    // Un outil qui promet de libérer un créneau qu'on ne sait pas lire est pire
    // que pas d'outil: c'est la règle déjà posée sur checkAvailability.
    const names = buildVoiceTools({ ...profile, calendarConnected: false } as never)
      .map(t => (t as { function?: { name?: string } }).function?.name);
    expect(names).not.toContain('cancelBooking');
  });
});

describe('annuler annule, et le dit tout de suite', () => {
  it('passe par la MÊME fonction que le portail', async () => {
    /* L'annulation est QUATRE écritures (événement Google, statut,
       `googleEventId`, cache appelant). Deux copies divergent en moins d'un
       mois (6vicies), et ici une écriture oubliée ne se voit qu'au prochain
       appel. */
    findBookings.mockResolvedValue([booking()]);
    await cancel({ currentDate: undefined });
    expect(cancelRecord).toHaveBeenCalledWith('c1', 'b1');
  });

  it('mène par la phrase à dire, avant toute procédure', async () => {
    /* 19/09: un fait suivi de cinq phrases de procédure a fait tenir la
       réponse soixante-huit secondes, le modèle lisant la procédure au lieu
       du fait. */
    findBookings.mockResolvedValue([booking()]);
    const reply = await cancel();
    const dire = reply.indexOf('DIS CECI MAINTENANT');
    expect(dire).toBeGreaterThanOrEqual(0);
    expect(reply.indexOf('checkAvailability')).toBeGreaterThan(dire);
    expect(reply).toMatch(/annul/i);
  });

  it("n'offre JAMAIS le déplacement comme issue d'une annulation", async () => {
    // Le défaut exact du 19/09, gelé: « annulez » a produit un déplacement.
    findBookings.mockResolvedValue([booking()]);
    expect(await cancel()).not.toMatch(/rescheduleBooking/);
  });

  it('rend le créneau à la lecture d\'agenda du jour', async () => {
    /* Le cache tient 30 s, soit la durée d'une fin de conversation: sans ce
       retrait, « finalement, ce créneau, c'est possible ? » s'entend refuser
       par une lecture faite avant l'annulation. */
    const b = booking();
    findBookings.mockResolvedValue([b]);
    await cancel();
    expect(invalidateDay).toHaveBeenCalledWith('c1', b.bookingDate);
  });

  it('marque la session pour que le post-appel ne le recrée pas', async () => {
    findBookings.mockResolvedValue([booking()]);
    await cancel();
    expect(markCancelled).toHaveBeenCalledWith('call_1', 'b1');
  });
});

describe("l'ambiguïté ARRÊTE, parce qu'une annulation ne se défait pas", () => {
  const deux = [booking(), booking({ id: 'b2', bookingDate: inDays(9), bookingTime: '10:00' })];

  it('avec deux rendez-vous et aucun jour nommé, rien n\'est annulé', async () => {
    findBookings.mockResolvedValue(deux);
    const reply = await cancel();
    expect(cancelRecord).not.toHaveBeenCalled();
    expect(reply).toContain("RIEN N'EST ANNULE");
  });

  it('le jour nommé par l\'appelant tranche, et lui seul', async () => {
    findBookings.mockResolvedValue(deux);
    const ymd = deux[1].bookingDate.toISOString().slice(0, 10);
    await cancel({ currentDate: ymd });
    expect(cancelRecord).toHaveBeenCalledWith('c1', 'b2');
  });

  it('un jour qui ne désigne aucun des deux n\'annule rien', async () => {
    findBookings.mockResolvedValue(deux);
    await cancel({ currentDate: '2027-01-04' });
    expect(cancelRecord).not.toHaveBeenCalled();
  });

  it('avec UN seul rendez-vous, le jour n\'est pas exigé', async () => {
    // Le cas courant ne doit pas coûter un tour de parole de plus.
    findBookings.mockResolvedValue([booking()]);
    await cancel();
    expect(cancelRecord).toHaveBeenCalledWith('c1', 'b1');
  });
});

describe('les deux issues que le modèle sait produire', () => {
  it('rappelé avec les mêmes arguments, il redit que c\'est fait', async () => {
    /* Le modèle rappelle un outil avec les mêmes arguments: c'est le
       comportement connu de ce chemin (6sexquadragesies, neuf appels
       d'affilée). Un second appel ne doit pas se lire comme un échec, sinon
       le modèle cherche une autre voie pour un geste déjà accompli. */
    findBookings.mockResolvedValue([booking()]);
    cancelRecord.mockResolvedValue({
      ok: true, alreadyCancelled: true,
      customerName: 'Jean-Luc de la Forge', bookingDate: inDays(3), bookingTime: '14:00',
    });
    const reply = await cancel();
    expect(reply).toContain('DEJA ANNULE');
    expect(reply).toMatch(/N'appelle PLUS cancelBooking/);
  });

  it('aucune réservation: on le dit, on n\'invente pas', async () => {
    findBookings.mockResolvedValue([]);
    const reply = await cancel();
    expect(cancelRecord).not.toHaveBeenCalled();
    expect(reply).toContain('AUCUNE RESERVATION');
  });

  it('au deuxième échec, il change de canal au lieu de réessayer', async () => {
    // 6septies appliqué aux outils: la cause ne bouge pas entre deux essais.
    findBookings.mockResolvedValue([]);
    noteToolFailure.mockReturnValue(2);
    const reply = await cancel();
    expect(reply).toMatch(/N'appelle PLUS cancelBooking/);
    expect(reply).toContain('captureLead');
  });
});

describe("un inconnu n'annule pas le rendez-vous d'un autre", () => {
  /* `findCallerBookings` cherche aussi par RESSEMBLANCE de nom, seuil 0,6,
     sur toutes les réservations à venir du commerce: il le faut pour
     retrouver « de la forge » derrière « de la Ford ». C'est beaucoup trop
     lâche pour en SUPPRIMER un. Le numéro appelant, lui, n'est pas choisi par
     celui qui parle. */
  const autrui = booking({ id: 'b9', customerPhone: '32499111222' });

  /* Les deux lectures de `findCallerBookings` s'excluent en production (l'une
     filtre SUR le numéro de l'appelant, l'autre l'exclut). Le bouchon doit
     faire pareil, sinon la même ligne revient deux fois et c'est l'ambiguïté
     qui répond, pas la garde qu'on mesure. */
  const parNomSeulement = ({ where }: { where: Record<string, any> }) =>
    where.customerPhone?.in ? [] : [autrui];

  it("depuis un autre numéro et sans date, rien n'est annulé", async () => {
    findBookings.mockImplementation(parNomSeulement);
    const reply = await cancel({ customerName: 'Jean-Luc de la Forge' });
    expect(cancelRecord).not.toHaveBeenCalled();
    expect(reply).toContain("RIEN N'EST ANNULE");
  });

  it('la date exacte suffit à prouver que c\'est bien le sien', async () => {
    // Le cas légitime: on rappelle depuis une autre ligne. Il coûte une phrase.
    findBookings.mockImplementation(parNomSeulement);
    const ymd = autrui.bookingDate.toISOString().slice(0, 10);
    await cancel({ customerName: 'Jean-Luc de la Forge', currentDate: ymd });
    expect(cancelRecord).toHaveBeenCalledWith('c1', 'b9');
  });

  it("depuis le numéro de la réservation, aucune date n'est exigée", async () => {
    findBookings.mockResolvedValue([booking()]);
    await cancel();
    expect(cancelRecord).toHaveBeenCalledWith('c1', 'b1');
  });
});

describe("quand l'écriture échoue, surtout ne pas dire que c'est fait", () => {
  it("le repli dit que RIEN n'est annulé, et prend les coordonnées", async () => {
    /* Le message d'agenda générique parle de « confirmer un créneau », ce qui
       ne veut rien dire pour quelqu'un qui annule et ne dit pas l'essentiel.
       Un appelant qui raccroche en croyant son rendez-vous annulé ne
       rappellera pas, et le commerce l'attendra. */
    findBookings.mockResolvedValue([booking()]);
    cancelRecord.mockRejectedValue(new Error('neon down'));
    const reply = await cancel();
    expect(reply).toContain("RIEN N'EST ANNULE");
    expect(reply).toContain('captureLead');
    expect(reply).not.toMatch(/creneau/i);
  });
});

describe('le chemin est nommé là où le modèle décide', () => {
  const source = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');

  it('le résultat de lookupBooking nomme cancelBooking', () => {
    /* C'est là que le modèle lit la suite: la procédure vit dans le RÉSULTAT
       d'outil, qui ne coûte rien au prompt rejoué à chaque tour. */
    const runtime = source('tool-runtime.service.ts');
    const reply = runtime.slice(runtime.indexOf("S'IL VEUT LA DEPLACER"), runtime.indexOf("S'IL VEUT LA DEPLACER") + 600);
    expect(reply).toContain("S'IL VEUT L'ANNULER");
    expect(reply).toContain('cancelBooking');
  });

  it("le brief d'ouverture aussi, pour l'appelant déjà connu", () => {
    // Le brief porte les rendez-vous du numéro: c'est le premier endroit où
    // « annulez celui du 22 » trouve sa réponse, sans le moindre outil.
    expect(source('call-brief.ts')).toContain('cancelBooking');
  });

  it("et les trois langues du prompt, jamais une seule", () => {
    /* Quand une langue perd une ligne que les autres gardent, c'est une
       DIVERGENCE, pas une économie. */
    const prompt = source('system-prompt.ts');
    expect(prompt).toMatch(/ANNULER: cancelBooking/);
    expect(prompt).toMatch(/To CANCEL: cancelBooking/);
    expect(prompt).toMatch(/ANNULEREN: cancelBooking/);
  });
});
