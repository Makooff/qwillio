import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* LA SORTIE DU MODÈLE D'ANALYSE ÉTAIT LUITE AVEUGLÉMENT (JSON.parse direct).
 *
 * Constats réels:
 *   - `analyzeClientCallTranscript` rendait `JSON.parse(content)` tel quel:
 *     un booléen en chaîne (`"isLead": "true"`), un score hors échelle
 *     (`leadScore: 42`), une énumération inconnue (`sentiment: "happy"`)
 *     passaient tels quels jusqu'à la base.
 *   - Un échec HTTP tombait dans le fallback avec `leadScore: 3` — un score
 *     AFFIRMÉ alors qu'AUCUNE analyse n'avait eu lieu, écrit en base comme
 *     s'il venait du modèle.
 *
 * Ce fichier verrouille le comportement: strict sur les booléens, borné sur
 * le score (l'UI porte l'échelle /10), enum par liste blanche, et un défaut
 * d'échec qui NE fabrique pas de score.
 */

vi.mock('../../config/database', () => ({ prisma: {} }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { clientCallService } = await import('../client-call.service');
const analyze = (transcript: string) =>
  (clientCallService as any).analyzeClientCallTranscript(
    transcript,
    { businessName: 'Demtalix', businessType: 'dentist', country: 'BE', agentLanguage: 'fr' },
    null,
  );

const fetchMock = vi.fn();
const modelSays = (payload: unknown) =>
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  });

describe('analyzeClientCallTranscript — la sortie du modèle est validée', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('un booléen EN CHAÎNE ne passe pas: isLead reste false strictement', async () => {
    modelSays({
      callerName: 'Jean', summary: 'ok', sentiment: 'neutral', outcome: 'other',
      bookingRequested: 'yes', isLead: 'true', leadScore: 7, callbackPromised: 'no',
    });
    const analysis = await analyze('APPELANT: je veux un rdv');
    expect(analysis.isLead).toBe(false);
    expect(analysis.bookingRequested).toBe(false);
    expect(analysis.callbackPromised).toBe(false);
  });

  it('leadScore est borné 0..10: 42 devient null, pas 42 en base', async () => {
    modelSays({
      callerName: 'Jean', summary: 'ok', sentiment: 'neutral', outcome: 'other',
      bookingRequested: false, isLead: true, leadScore: 42,
    });
    expect((await analyze('x')).leadScore).toBeNull();

    modelSays({
      callerName: 'Jean', summary: 'ok', sentiment: 'neutral', outcome: 'other',
      bookingRequested: false, isLead: true, leadScore: 8.4,
    });
    expect((await analyze('x')).leadScore).toBe(8);
  });

  it('leadScore NaN / chaîne / null devient null, jamais NaN en base', async () => {
    modelSays({
      callerName: 'Jean', summary: 'ok', sentiment: 'neutral', outcome: 'other',
      bookingRequested: false, isLead: true, leadScore: 'huit',
    });
    expect((await analyze('x')).leadScore).toBeNull();

    modelSays({
      callerName: 'Jean', summary: 'ok', sentiment: 'neutral', outcome: 'other',
      bookingRequested: false, isLead: true, leadScore: null,
    });
    expect((await analyze('x')).leadScore).toBeNull();
  });

  it('les enums inconnues retombent sur la valeur neutre, pas sur la base', async () => {
    modelSays({
      callerName: 'Jean', summary: 'ok', sentiment: 'happy', outcome: 'rendez-vous !!',
      bookingRequested: false, isLead: false, leadScore: 3,
    });
    const analysis = await analyze('x');
    expect(analysis.sentiment).toBe('neutral');
    expect(analysis.outcome).toBe('other');
  });

  it('les tableaux sont bornés: tags et questions parasites tronqués', async () => {
    modelSays({
      callerName: 'Jean', summary: 'ok', sentiment: 'neutral', outcome: 'other',
      bookingRequested: false, isLead: false, leadScore: 3,
      tags: ['a', 42, 'urgent', '', null, 'vip'],
      unansweredQuestions: Array.from({ length: 9 }, (_, i) => `question ${i}`),
    });
    const analysis = await analyze('x');
    expect(analysis.tags).toEqual(['a', 'urgent', 'vip']);
    expect(analysis.unansweredQuestions).toHaveLength(3);
  });

  it("échec HTTP: le repli n'affirme AUCUN score (leadScore null, isLead false)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'overloaded' } }),
    });
    const analysis = await analyze('x');
    expect(analysis.leadScore).toBeNull();
    expect(analysis.isLead).toBe(false);
    expect(analysis.summary).toContain('manual review');
  });

  it('un corps JSON invalide du modèle tombe dans le même repli sans score', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'pas du json {' } }] }),
    });
    const analysis = await analyze('x');
    expect(analysis.leadScore).toBeNull();
    expect(analysis.isLead).toBe(false);
  });
});
