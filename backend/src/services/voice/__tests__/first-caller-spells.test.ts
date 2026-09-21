import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Demande du 13/09/2026: « la première fois que le client se présente, il
   devrait épeler son nom de famille; une fois l'orthographe validée on garde
   celle-là pour le lead et à chaque rappel ». Un appelant INCONNU épelle avant
   toute écriture; un appelant CONNU n'est pas interrogé. */

const { create, getProfile, getHistory, remember, needsNameReadBack, needsNameSpelling, spellingHeardName } = vi.hoisted(() => ({
  create: vi.fn(),
  getProfile: vi.fn(),
  getHistory: vi.fn(),
  remember: vi.fn(),
  needsNameReadBack: vi.fn(),
  needsNameSpelling: vi.fn(),
  spellingHeardName: vi.fn(),
}));

vi.mock('../../../config/database', () => ({ prisma: { agentCrmActivity: { create } } }));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile, getCallerHistory: getHistory },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: vi.fn(() => ({ callerNumber: '+32475987654' })),
    recordLead: vi.fn(),
    markLeadActivity: vi.fn(),
    recordToolCall: vi.fn(),
    recordPhoneCaptureFailure: vi.fn(() => 0),
    needsPhoneReadBack: vi.fn(() => false),
    needsNameReadBack,
    needsNameSpelling,
    /* Le nom ENTENDU avant l'épellation (21/09/2026). Absent du bouchon,
       l'appel levait et l'outil rendait son repli sûr, qui masque le vrai
       message: même piège que `noteToolFailure` ailleurs. */
    spellingHeardName,
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({ availabilitySpeculator: { take: vi.fn(), speculate: vi.fn() } }));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const { toolRuntimeService } = await import('../tool-runtime.service');

const profile = { clientId: 'c1', businessName: 'Demtalix', language: 'fr', country: 'BE' };
const capture = async (args: Record<string, unknown>) =>
  (await toolRuntimeService.execute('c1', 'call_1', { name: 'captureLead', args, toolCallId: 't1' } as never)).result;

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  create.mockResolvedValue({ id: 'act_1' });
  remember.mockResolvedValue(undefined);
  needsNameReadBack.mockReturnValue(true);
  needsNameSpelling.mockReturnValue(true);
  spellingHeardName.mockReturnValue(null);
});

describe('captureLead — un appelant inconnu épelle son nom de famille', () => {
  it('demande l\'épellation AVANT d\'écrire quoi que ce soit', async () => {
    getHistory.mockResolvedValue({ knownName: null, previousCalls: 0 });
    const out = String(await capture({ name: 'Jean Lucas', reason: 'rendez-vous' }));
    expect(out).toMatch(/^NOM ENTENDU: « Jean Lucas », correspondant INCONNU/);
    expect(out).toMatch(/ÉPELER son nom de famille/);
    expect(out).toMatch(/« O » est la lettre O/);
    expect(create).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
  });

  it('au rappel de l\'outil avec le nom épelé, l\'agent relit les lettres puis enregistre l\'orthographe épelée', async () => {
    getHistory.mockResolvedValue({ knownName: null, previousCalls: 0 });
    needsNameSpelling.mockReturnValue(false); // déjà demandée sur cet appel
    const out = String(await capture({ name: 'Jean-Luc D E L A F O R G E', reason: 'rendez-vous' }));
    expect(out).toMatch(/^NOM NOTÉ: « Jean-Luc Delaforge »/);
    expect(out).toContain('D-E-L-A-F-O-R-G-E');
    expect(create.mock.calls[0][0].data.content.contact.name).toBe('Jean-Luc Delaforge');
    expect(remember.mock.calls[0][0].name).toBe('Jean-Luc Delaforge');
  });

  it('un nom bidon n\'est pas un nom: le lead s\'enregistre sans nom, rien à épeler', async () => {
    getHistory.mockResolvedValue({ knownName: null, previousCalls: 0 });
    const out = String(await capture({ name: 'client', reason: 'rendez-vous' }));
    expect(out).not.toMatch(/NOM ENTENDU/);
    expect(create).toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.content.contact.name).toBeNull();
  });

  it('un appelant CONNU n\'épelle pas', async () => {
    getHistory.mockResolvedValue({ knownName: 'Jean-Luc de la Forge', previousCalls: 2 });
    const out = String(await capture({ name: 'Jean Lucas', reason: 'rendez-vous' }));
    expect(out).not.toMatch(/INCONNU/);
    expect(needsNameSpelling).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });

  it('historique illisible: pas d\'épellation demandée, la relecture reste le filet', async () => {
    getHistory.mockRejectedValue(new Error('redis down'));
    const out = String(await capture({ name: 'Marc Maron', reason: 'devis' }));
    expect(out).toMatch(/^NOM NOTÉ/);
    expect(needsNameSpelling).not.toHaveBeenCalled();
  });

  it('un 0 entendu dans un nom est la lettre O, à l\'écrit comme à l\'épellation', async () => {
    getHistory.mockResolvedValue({ knownName: null, previousCalls: 0 });
    needsNameSpelling.mockReturnValue(false);
    const out = String(await capture({ name: 'Marc Mar0n', reason: 'devis' }));
    expect(out).toContain('« Marc Maron »');
    expect(out).toContain('M-A-R-O-N');
    expect(create.mock.calls[0][0].data.content.contact.name).toBe('Marc Maron');
  });

  /* L'ÉPELLATION QUI PERD DES LETTRES (21/09/2026).
     Appel réel: « Virginie Barre » entendu PARFAITEMENT quand elle le dit
     normalement, puis « BAR. » quand elle l'épelle, et c'est cette forme-là
     qui est partie dans l'agenda. L'étape qui existe pour fiabiliser le nom
     est celle qui l'a cassé, et rien ne comparait les deux. */
  it('une épellation tronquée ne remplace pas le nom entendu', async () => {
    getHistory.mockResolvedValue({ knownName: null, previousCalls: 0 });
    needsNameSpelling.mockReturnValue(false); // déjà demandée sur cet appel
    spellingHeardName.mockReturnValue('Virginie Barre');
    const out = String(await capture({ name: 'Virginie BAR.', reason: 'devis' }));
    expect(create.mock.calls[0][0].data.content.contact.name).toBe('Virginie Barre');
    /* Et l'appelante garde le dernier mot: les lettres RETENUES lui sont
       relues, donc elle peut encore corriger. C'est un canal différent de
       celui qui vient d'échouer, contrairement à redemander une épellation. */
    expect(out).toContain('« Virginie Barre »');
    expect(out).toContain('B-A-R-R-E');
  });

  it('un nom de famille vraiment court n\'est pas rallongé', async () => {
    /* « Bar » existe. Une longueur minimale serait une politique inventée sur
       les noms des gens, et elle refuserait de vrais appelants. */
    getHistory.mockResolvedValue({ knownName: null, previousCalls: 0 });
    needsNameSpelling.mockReturnValue(false);
    spellingHeardName.mockReturnValue('Virginie Bar');
    await capture({ name: 'Virginie B A R', reason: 'devis' });
    expect(create.mock.calls[0][0].data.content.contact.name).toBe('Virginie Bar');
  });
});
