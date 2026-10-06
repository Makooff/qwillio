import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ── CE QUE L'INTÉGRATION ENVOIE VRAIMENT ────────────────────────────────────
 *
 * Le service existait, était branché, et n'avait qu'UN test : la validation
 * d'URL. Rien ne prouvait qu'un envoi partait, ni avec quoi dedans. C'est le
 * motif qu'on a passé la journée à chercher ailleurs — du code plausible que
 * personne n'a exercé — et il n'y a pas de raison de le laisser ici.
 *
 * Ces tests attrapent le `fetch` et lisent ce qui part réellement.
 */

const { contactFindMany, callFindMany, dealFindMany } = vi.hoisted(() => ({
  contactFindMany: vi.fn(),
  callFindMany: vi.fn(),
  dealFindMany: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    contact: { findMany: contactFindMany },
    clientCall: { findMany: callFindMany },
    deal: { findMany: dealFindMany },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { crmSyncService } = await import('../crm-sync.service');

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.stubGlobal('fetch', fetchMock);

const CLIENT = 'c1';

beforeEach(() => {
  contactFindMany.mockReset().mockResolvedValue([]);
  callFindMany.mockReset().mockResolvedValue([]);
  dealFindMany.mockReset().mockResolvedValue([]);
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
});

const integ = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  clientId: CLIENT,
  provider: 'webhook',
  accessToken: null,
  config: { webhookUrl: 'https://example.com/hook' },
  lastSync: null as Date | null,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  ...over,
});

const corps = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);

describe('syncIntegration — un envoi réel', () => {
  it('POSTe du JSON au webhook, avec l’en-tête de contenu', async () => {
    contactFindMany.mockResolvedValue([{ id: 'x', name: 'Marc', email: 'a@b.c' }]);

    await crmSyncService.syncIntegration(integ());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(corps().source).toBe('qwillio');
    expect(corps().contacts).toHaveLength(1);
  });

  it('signe l’envoi quand un secret est configuré, et pas sinon', async () => {
    contactFindMany.mockResolvedValue([{ id: 'x' }]);
    await crmSyncService.syncIntegration(integ({ config: { webhookUrl: 'https://example.com/h', secret: 's3cret' } }));
    expect(fetchMock.mock.calls[0][1].headers['X-Qwillio-Secret']).toBe('s3cret');

    fetchMock.mockClear();
    await crmSyncService.syncIntegration(integ());
    expect(fetchMock.mock.calls[0][1].headers['X-Qwillio-Secret']).toBeUndefined();
  });

  it('ne fait AUCUN appel réseau quand il n’y a rien à envoyer', async () => {
    // Une intégration qui poste du vide toutes les 15 minutes est du bruit,
    // et le client la coupe — ce qui emporte les envois qui comptaient.
    await crmSyncService.syncIntegration(integ());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lève quand le webhook répond en erreur, pour que le cron le sache', async () => {
    contactFindMany.mockResolvedValue([{ id: 'x' }]);
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    /* L'exception n'est pas un détail : c'est elle qui fait passer
       `syncStatus` à 'error' sans avancer `lastSync`, donc le lot suivant
       réessaie au lieu d'être perdu. */
    await expect(crmSyncService.syncIntegration(integ())).rejects.toThrow(/HTTP 500/);
  });
});

describe('syncIntegration — depuis quand', () => {
  it('une intégration NEUVE ne déverse pas tout l’historique', async () => {
    /* `lastSync` nul valait `new Date(0)`, soit 1970 : le premier sync envoyait
       TOUS les contacts, appels et affaires du client depuis toujours. Le jour
       où un client branche Zapier, il reçoit des appels d'il y a des mois dans
       son CRM et conclut que Qwillio envoie n'importe quoi. */
    contactFindMany.mockResolvedValue([{ id: 'x' }]);

    await crmSyncService.syncIntegration(integ({ lastSync: null }));

    const since = contactFindMany.mock.calls[0][0].where.updatedAt.gte as Date;
    expect(since.getFullYear()).toBeGreaterThan(2000);
    expect(since.getTime()).toBe(new Date('2026-06-01T00:00:00Z').getTime());
  });

  it('reprend exactement à `lastSync` quand il existe', async () => {
    const dernier = new Date('2026-09-15T10:30:00Z');
    contactFindMany.mockResolvedValue([{ id: 'x' }]);

    await crmSyncService.syncIntegration(integ({ lastSync: dernier }));

    const since = contactFindMany.mock.calls[0][0].where.updatedAt.gte as Date;
    expect(since.getTime()).toBe(dernier.getTime());
  });
});

describe('syncIntegration — Slack', () => {
  it('envoie `{ text }` et rien d’autre', async () => {
    /* Slack n'attend pas nos objets : lui envoyer le corps de Zapier afficherait
       un bloc de JSON dans le canal, que personne ne lit. */
    dealFindMany.mockResolvedValue([]);
    callFindMany.mockResolvedValue([
      { id: 'a', status: 'completed', outcome: 'lead', callerNumber: '+32470000000', nameCollected: 'Marc', summary: 'Demande un devis' },
    ]);

    await crmSyncService.syncIntegration(integ({ provider: 'slack', config: { webhookUrl: 'https://hooks.slack.com/x' } }));

    const body = corps();
    expect(Object.keys(body)).toEqual(['text']);
    expect(body.text).toContain('lead');
    // Et surtout : pas de fuite du corps technique au milieu du message.
    expect(body.text).not.toContain('"source"');
  });
});

describe('syncIntegration — HubSpot', () => {
  it('n’envoie que les contacts AVEC email, groupés en un seul lot', async () => {
    /* L'upsert HubSpot est clefé par `idProperty: 'email'` : un contact sans
       adresse ne peut pas être rapproché, et le lot entier échouerait sur lui. */
    contactFindMany.mockResolvedValue([{ name: 'Marc D', email: 'marc@ex.be', phone: '1', status: 'new', leadScore: 3 }]);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });

    await crmSyncService.syncIntegration(integ({ provider: 'hubspot', accessToken: 'tok', config: {} }));

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('hubapi.com/crm/v3/objects/contacts/batch/upsert');
    expect(opts.headers.Authorization).toContain('tok');
    const inputs = JSON.parse(opts.body).inputs;
    expect(inputs).toHaveLength(1);
    expect(inputs[0].idProperty).toBe('email');
    expect(inputs[0].id).toBe('marc@ex.be');
    expect(inputs[0].properties.firstname).toBe('Marc');

    // Le filtre d'email est posé dans la REQUÊTE, pas seulement dans la boucle.
    expect(contactFindMany.mock.calls[0][0].where.email).toEqual({ not: null });
  });

  it('ne poste rien sans jeton d’accès', async () => {
    await crmSyncService.syncIntegration(integ({ provider: 'hubspot', accessToken: null }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
