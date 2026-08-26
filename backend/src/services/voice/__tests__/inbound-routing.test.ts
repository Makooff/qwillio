import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: { client: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

const { inboundRoutingService, divertedNumber } = await import('../inbound-routing.service');

const client = (
  id: string,
  number: string | null,
  businessName = `Biz ${id}`,
  activationDate: Date | null = null,
) => ({
  id,
  businessName,
  vapiPhoneNumber: number,
  activationDate,
  createdAt: new Date('2020-01-01'),
  phoneNumbers: [] as { number: string; label: string | null }[],
});

/** Un client multi-sites: un numéro principal et des lignes supplémentaires. */
const multiSite = (
  id: string,
  primary: string | null,
  lines: { number: string; label: string | null }[],
) => ({ ...client(id, primary), phoneNumbers: lines });

describe('resolveClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves the client that owns the dialed number', async () => {
    findMany.mockResolvedValue([client('c1', '+16073548569'), client('c2', '+33123456789')]);
    const r = await inboundRoutingService.resolveClient('+16073548569');
    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c1' });
  });

  it('matches regardless of formatting', async () => {
    // Stored numbers are not consistently formatted; a SQL LIKE would miss these.
    findMany.mockResolvedValue([client('c1', '+1 (607) 354-8569')]);
    const r = await inboundRoutingService.resolveClient('+16073548569');
    expect(r.kind).toBe('resolved');
  });

  it('route vers le plus récemment activé quand la ligne est partagée', async () => {
    // Raccrocher était pire: le deuxième client cassait aussi le premier, et un
    // appel manqué ne se rattrape pas. On tranche donc, bruyamment.
    findMany.mockResolvedValue([
      client('c1', '+16073548569', 'Ancien', new Date('2024-01-01')),
      client('c2', '+16073548569', 'Récent', new Date('2026-01-01')),
    ]);
    const r = await inboundRoutingService.resolveClient('+16073548569');
    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c2' });
  });

  it('reports unknown when no client owns the number', async () => {
    findMany.mockResolvedValue([client('c1', '+33123456789')]);
    expect((await inboundRoutingService.resolveClient('+16073548569')).kind).toBe('unknown');
  });

  it('reports unknown for a missing or nonsense dialed number', async () => {
    for (const bad of [undefined, null, '', 'anonymous', '123']) {
      expect((await inboundRoutingService.resolveClient(bad)).kind).toBe('unknown');
    }
    // Never even queries when there is nothing to match on.
    expect(findMany).not.toHaveBeenCalled();
  });

  it('only considers clients with a live subscription and an assistant', async () => {
    findMany.mockResolvedValue([]);
    await inboundRoutingService.resolveClient('+16073548569');
    const where = findMany.mock.calls[0][0].where;
    expect(where.vapiAssistantId).toEqual({ not: null });
    expect(where.subscriptionStatus.in).toEqual(['active', 'trialing']);
  });
});

describe('unroutableAssistant', () => {
  it('says something the caller can act on, not silence', () => {
    const a = inboundRoutingService.unroutableAssistant('fr') as any;
    expect(a.firstMessage).toMatch(/rappeler/i);
  });

  it('does not impersonate a business — we do not know which one they wanted', () => {
    const a = inboundRoutingService.unroutableAssistant('fr') as any;
    expect(a.name).not.toMatch(/receptionist -/i);
  });

  it('hangs up quickly instead of burning minutes on an agent with no context', () => {
    const a = inboundRoutingService.unroutableAssistant('en') as any;
    expect(a.endCallFunctionEnabled).toBe(true);
    expect(a.maxDurationSeconds).toBeLessThanOrEqual(30);
  });
});


describe('multi-sites', () => {
  beforeEach(() => vi.clearAllMocks());

  it('résout un appel arrivé sur une ligne supplémentaire', async () => {
    findMany.mockResolvedValue([
      multiSite('c1', '+3225881904', [{ number: '+3223334455', label: 'Boutique Ixelles' }]),
    ]);

    const r = await inboundRoutingService.resolveClient('+3223334455');

    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c1', lineLabel: 'Boutique Ixelles' });
  });

  it('résout encore le numéro principal, sans libellé de ligne', async () => {
    findMany.mockResolvedValue([
      multiSite('c1', '+3225881904', [{ number: '+3223334455', label: 'Boutique Ixelles' }]),
    ]);

    const r = await inboundRoutingService.resolveClient('+32 2 588 19 04');

    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c1' });
    expect((r as { lineLabel?: string }).lineLabel).toBeUndefined();
  });

  it('ne voit pas deux lignes du même client comme une ambiguïté', async () => {
    // Le dédoublonnage se fait par CLIENT: sinon un multi-sites deviendrait
    // non routable dès sa deuxième ligne.
    findMany.mockResolvedValue([
      multiSite('c1', '+3223334455', [{ number: '+3223334455', label: 'Doublon' }]),
    ]);

    expect((await inboundRoutingService.resolveClient('+3223334455')).kind).toBe('resolved');
  });

  it('tranche aussi quand le partage vient d\'une ligne supplémentaire', async () => {
    findMany.mockResolvedValue([
      multiSite('c1', null, [{ number: '+3223334455', label: null }]),
      multiSite('c2', '+3223334455', []),
    ]);

    /* Les deux fixtures ont la MEME date: c'est le cas d'egalite, et il doit
       rester stable. Sans le departage par identifiant, l'ordre venait de la
       base et le meme appelant pouvait tomber ailleurs a l'appel suivant. */
    expect(await inboundRoutingService.resolveClient('+3223334455'))
      .toMatchObject({ kind: 'resolved', clientId: 'c1' });
  });
});

/**
 * Le renvoi d'appel, qui déciderait s'il faut UN numéro par client.
 *
 * Aujourd'hui le numéro composé est la seule clé de routage, donc chaque client
 * doit posséder sa ligne, l'acheter, et en faire valider l'adresse. Si le
 * renvoi transporte son origine, une seule ligne peut servir toute la flotte.
 *
 * La forme exacte du webhook Vapi n'a pas pu être vérifiée sur pièces: les
 * variantes couvertes ici sont donc celles que les opérateurs et Twilio
 * emploient, et le code n'en privilégie aucune. Ne rien trouver retombe sur le
 * comportement actuel, ce que le dernier cas vérifie.
 */
describe('divertedNumber — le numéro réellement composé par l\'appelant', () => {
  it("lit un en-tête SIP Diversion tel qu'un opérateur l'écrit", () => {
    expect(divertedNumber({
      message: { call: { sipHeaders: { Diversion: '<sip:+3225550011@operateur.be>;reason=unconditional' } } },
    })).toBe('3225550011');
  });

  it('se moque de la casse et de la place du sac', () => {
    expect(divertedNumber({
      call: { phoneCallProviderDetails: { sipHeaders: { 'X-Original-Called-Number': 'tel:+32 2 555 00 11' } } },
    })).toBe('3225550011');
  });

  it('lit le champ ForwardedFrom de Twilio', () => {
    expect(divertedNumber({
      message: { call: { phoneCallProviderDetails: { forwardedFrom: '+3225550011' } } },
    })).toBe('3225550011');
  });

  it("ne rend rien quand l'appel n'a pas été renvoyé", () => {
    // Le cas NORMAL aujourd'hui: aucun en-tête, et le routage doit se comporter
    // exactement comme avant.
    expect(divertedNumber({ message: { call: { phoneNumber: { number: '+3225550011' } } } })).toBeNull();
    expect(divertedNumber({})).toBeNull();
    expect(divertedNumber(null)).toBeNull();
  });

  it('ignore un en-tête présent mais inexploitable', () => {
    expect(divertedNumber({ call: { sipHeaders: { Diversion: 'anonymous' } } })).toBeNull();
  });
});

describe('resolveClient — priorité au numéro renvoyé', () => {
  beforeEach(() => findMany.mockReset());

  it("route sur le numéro d'origine, pas sur la ligne partagée", async () => {
    // Deux clients renvoient vers LA MÊME ligne. Sans l'origine, ce cas est
    // précisément celui qui rendait les deux injoignables.
    findMany.mockResolvedValue([client('c1', '+3225550011'), client('c2', '+3225550022')]);
    const r = await inboundRoutingService.resolveClient('+3280000000', '<sip:+3225550022@op.be>');
    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c2', via: 'diversion' });
  });

  it('retombe sur le numéro composé quand l\'origine est inconnue', async () => {
    findMany.mockResolvedValue([client('c1', '+3225550011')]);
    const r = await inboundRoutingService.resolveClient('+3225550011', '+32999999999');
    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c1', via: 'dialed' });
  });

  it("se comporte comme avant quand rien n'est renvoyé", async () => {
    findMany.mockResolvedValue([client('c1', '+3225550011')]);
    const r = await inboundRoutingService.resolveClient('+3225550011');
    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c1', via: 'dialed' });
  });
});

/**
 * Le numéro du CLIENT, déclaré par lui, est ce qui rend le renvoi utilisable.
 *
 * Sans lui, un appel renvoyé arrive sur une ligne partagée et rien ne dit de
 * quelle entreprise il s'agit. Le déclarer était réservé au forfait Enterprise
 * et aucun écran ne le proposait: le renvoi, qu'on demande pourtant à TOUS les
 * clients de faire à l'installation, ne pouvait donc pas fonctionner. Ce test
 * fige le fait que le routage sait s'en servir.
 */
describe('le numéro déclaré par le client', () => {
  it("résout par le numéro d'origine quand l'appel a été renvoyé", async () => {
    findMany.mockResolvedValue([
      multiSite('c1', '+16073548569', [{ number: '+3225550011', label: 'Mon numéro' }]),
    ]);

    /* Composé: la ligne partagée américaine. Origine: le numéro belge du
       client. C'est la seconde qui doit décider. */
    const r = await inboundRoutingService.resolveClient('+16073548569', '+3225550011');
    expect(r.kind).toBe('resolved');
    if (r.kind === 'resolved') {
      expect(r.clientId).toBe('c1');
      expect(r.via).toBe('diversion');
    }
  });
});
