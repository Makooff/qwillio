import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * LE NOM ÉPELÉ DU TRANSCRIPT FAIT FOI QUAND RIEN N'EST CONFIRMÉ (21/09/2026).
 *
 * Appel réel, relevé au `voice:audit`: `bookAppointment` appelé UNE fois, qui
 * a répondu « RIEN N'EST ENCORE RESERVE, fais épeler », et jamais rappelé.
 * Aucune réservation n'a donc été prise pendant l'appel — alors que l'agent a
 * dit « c'est fait, vous êtes pris en compte » — et c'est le rattrapage
 * post-appel qui a créé la ligne, depuis l'analyse du transcript.
 *
 * `knownCallerName` rend `null` dans ce cas (pas de réservation en direct, pas
 * de réservation antérieure, pas de mémoire): l'analyse est LA SEULE source du
 * nom. Le transcripteur avait entendu « Virginie Barre », elle avait épelé
 * « B A R » — son vrai nom — et rien ne disait au modèle de préférer
 * l'épellation. Le rendez-vous est parti sous « Barre ».
 *
 * La consigne vit dans la description du champ `callerName`, parce que c'est
 * là que le modèle lit ce qu'il doit extraire.
 */

vi.mock('../../config/database', () => ({ prisma: {} }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { clientCallService } = await import('../client-call.service');
const analyze = (transcript: string, known: string | null) =>
  (clientCallService as any).analyzeClientCallTranscript(
    transcript,
    { businessName: 'Demtalix', businessType: 'dentist', country: 'BE', agentLanguage: 'fr' },
    known,
  );

const fetchMock = vi.fn();
const systemPrompt = () => JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content as string;

describe('analyzeClientCallTranscript — le nom ÉPELÉ prime sur le nom entendu', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ callerName: 'Virginie Bar', summary: 'ok', sentiment: 'neutral', outcome: 'other', bookingRequested: true, isLead: false, leadScore: 3 }) } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('dit au modèle que l\'épellation gagne contre ce qui a été entendu plus tôt', async () => {
    await analyze('APPELANT: Virginie Barre.\nIA: épelez\nAPPELANT: B A R', null);
    const system = systemPrompt();
    expect(system).toMatch(/SPELLS their family name/);
    /* Le cas exact: l'épellation est PLUS COURTE que ce qui a été entendu, et
       c'est elle qui est juste. Sans ce mot, « Bar » se lit comme un nom
       tronqué et le modèle garde « Barre ». */
    expect(system).toMatch(/shorter or different/);
    /* Et les lettres se recollent, sinon la fiche porte « B A R ». */
    expect(system).toMatch(/Join the letters/);
  });

  it('la règle vaut même quand aucun nom confirmé n\'existe: c\'est justement ce cas-là', async () => {
    /* Elle vit dans la description du champ, pas dans `nameHint`, qui est vide
       sans nom confirmé. C'est l'inverse qui avait été fait, et c'est pour ça
       que l'appel du 21/09 est passé au travers. */
    await analyze('APPELANT: B A R', null);
    expect(systemPrompt()).not.toContain('confirmed name');
    expect(systemPrompt()).toMatch(/SPELLS their family name/);
  });

  it('un nom confirmé reste prioritaire: la réservation relue bat le transcript', async () => {
    /* Les deux règles ne se contredisent pas: une réservation dont le nom a
       déjà été relu et épelé est une source plus sûre que le transcript. */
    await analyze('APPELANT: C\'est Jean Lucas', 'Jean-Luc de la Forge');
    expect(systemPrompt()).toContain('confirmed name is "Jean-Luc de la Forge"');
  });
});
