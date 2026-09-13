import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* Le résumé post-appel disait « Jean Lucas a appelé… » alors que la fiche,
   corrigée par `knownCallerName`, disait « Jean-Luc de la Forge » (13/09) :
   le nom confirmé est lu AVANT l'analyse et lui est dit. */

vi.mock('../../config/database', () => ({ prisma: {} }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { clientCallService } = await import('../client-call.service');
const analyze = (transcript: string, known: string | null) =>
  (clientCallService as any).analyzeClientCallTranscript(transcript, { businessName: 'Demtalix', businessType: 'dentist', country: 'BE', agentLanguage: 'fr' }, known);

const fetchMock = vi.fn();

describe('analyzeClientCallTranscript — le nom confirmé est dit au modèle', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ callerName: 'Jean-Luc de la Forge', summary: 'ok', sentiment: 'neutral', outcome: 'other', bookingRequested: false, isLead: false, leadScore: 3 }) } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ajoute le nom confirmé à la consigne, pour callerName ET le résumé', async () => {
    await analyze('APPELANT: C\'est Jean Lucas', 'Jean-Luc de la Forge');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system = body.messages[0].content as string;
    expect(system).toContain('confirmed name is "Jean-Luc de la Forge"');
    expect(system).toMatch(/in the summary/);
  });

  it('sans nom confirmé, la consigne ne change pas', async () => {
    await analyze('APPELANT: Bonjour', null);
    const system = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content as string;
    expect(system).not.toContain('confirmed name');
  });

  it('un nom qui contient des guillemets ou des retours ne casse pas la consigne', async () => {
    await analyze('x', 'Jean "Lu\nc"');
    const system = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content as string;
    expect(system).toContain('confirmed name is "Jean  Lu c"');
  });
});
