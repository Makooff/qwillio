import { describe, it, expect, vi, beforeEach } from 'vitest';

/* LES FAITS DURABLES CAPTÉS PENDANT L'APPEL PAR LES OUTILS (`captureLead`)
 * ne doivent pas dépendre de ce que le modèle d'analyse a bien voulu dire:
 *
 *   - `extra.liveLead` n'était utilisé que comme drapeau « déjà capté » pour
 *     le filet des promesses. Si le modèle rendait `isLead: false` — ou si
 *     l'analyse tombait en panne — le nom dicté, le courriel et le NUMÉRO DE
 *     RAPPEL dicté disparaissaient de la fiche d'appel et du CRM.
 *   - `knownCallerName` lisait la dernière réservation du numéro AVANT le nom
 *     capté en direct: une vieille orthographe écrasait la correction que
 *     l'appelant venait de dicter.
 *   - `phoneCollected` et le téléphone du CRM écrivaient TOUJOURS
 *     `callerNumber` (identité téléphonique de la ligne), même quand
 *     l'appelant avait dicté un autre numéro pour être rappelé.
 */

const mocks = vi.hoisted(() => ({
  findClient: vi.fn(),
  findBooking: vi.fn(),
  findMemory: vi.fn(),
  createCall: vi.fn(),
  readCall: vi.fn(),
  updateCall: vi.fn(),
  updateClient: vi.fn(),
  aggregate: vi.fn(),
  createActivity: vi.fn(),
  createCrmActivity: vi.fn(),
  crmCreateOrMerge: vi.fn(),
  classify: vi.fn(),
  spamHit: vi.fn(),
}));

const persisted = vi.hoisted(() => ({ call: null as any }));
vi.mock('../../config/database', () => {
  const prisma: any = {
    client: { findUnique: mocks.findClient, update: mocks.updateClient },
    clientBooking: { findFirst: mocks.findBooking, updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    callerMemory: { findUnique: mocks.findMemory },
    clientCall: { create: mocks.createCall, aggregate: mocks.aggregate, findUnique: mocks.readCall, update: mocks.updateCall },
    activity: { create: mocks.createActivity },
    agentCrmActivity: { create: mocks.createCrmActivity },
    $queryRaw: vi.fn(async () => []),
  };
  prisma.$transaction = async (fn: any) => fn(prisma);
  return { prisma };
});
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../spam-detection.service', () => ({
  spamDetectionService: {
    classifyInboundCall: mocks.classify,
    registerSpamHit: mocks.spamHit,
  },
}));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../sms.service', () => ({ smsService: { sendBookingConfirmationSMS: vi.fn() } }));
vi.mock('../call-notification.service', () => ({ callNotificationService: { notify: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../crm-dedup.service', () => ({
  crmDedupService: { createOrMerge: mocks.crmCreateOrMerge },
}));

const { clientCallService } = await import('../client-call.service');

const CLIENT = {
  id: 'c1', businessName: 'Demtalix', businessType: 'dentist', country: 'BE',
  agentLanguage: 'fr', agentName: 'Marc', retentionDays: 90,
};

const fetchMock = vi.fn();
const modelSays = (payload: unknown) =>
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  });

const NO_ANALYSIS_FIELDS = {
  callerName: null, emailCollected: null, sentiment: 'neutral', outcome: 'other',
  summary: 'analyse indisponible', bookingRequested: false, isLead: false, leadScore: null,
};

function prismaHappyPath() {
  mocks.findClient.mockResolvedValue(CLIENT);
  mocks.classify.mockResolvedValue({ isSpam: false, score: 0, reasons: [] });
  mocks.findBooking.mockResolvedValue(null);
  mocks.findMemory.mockResolvedValue(null);
  persisted.call = null;
  mocks.createCall.mockImplementation(({ data }: any) => (persisted.call = { id: 'call-1', ...data }));
  mocks.readCall.mockImplementation(async () => persisted.call);
  mocks.updateCall.mockImplementation(async ({ data }: any) => Object.assign(persisted.call, data));
  mocks.updateClient.mockResolvedValue({});
  mocks.aggregate.mockResolvedValue({ _sum: { durationSeconds: 60 } });
  mocks.createActivity.mockResolvedValue({});
  mocks.createCrmActivity.mockResolvedValue({});
  mocks.crmCreateOrMerge.mockResolvedValue('contact-1');
}

const run = (extra: any) =>
  (clientCallService as any).handleClientCallCompleted(
    'c1', 'vapi-1', 'APPELANT: allo', 30, '+32470000000', undefined, null, extra,
  );

describe('handleClientCallCompleted — les faits liveLead survivent à l\'analyse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    for (const m of Object.values(mocks)) m.mockReset();
    prismaHappyPath();
  });

  it("isLead=false du modèle n'efface pas un lead capté par l'outil: nom, email et qualification restent", async () => {
    modelSays({ ...NO_ANALYSIS_FIELDS, callerName: 'Jean Lucas', isLead: false });
    await run({ liveLead: { name: 'Jean-Luc Barre', email: 'jl@barre.be', phone: '+32471111111', reason: 'rappel', urgency: 'high' } });
    const data = mocks.createCall.mock.calls[0][0].data;
    expect(data.isLead).toBe(true);
    expect(data.nameCollected).toBe('Jean-Luc Barre');
    expect(data.emailCollected).toBe('jl@barre.be');
    /* Aucun score n'est inventé: le modèle n'en a pas rendu. */
    expect(data.leadScore).toBeNull();
  });

  it('analyse en panne HTTP: le nom dicté, le courriel et le numéro de rappel restent en fiche', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: { message: 'down' } }) });
    await run({ liveLead: { name: 'Virginie Barre', email: 'v@barre.be', phone: '+32472222222', reason: 'devis', urgency: 'normal' } });
    const data = mocks.createCall.mock.calls[0][0].data;
    expect(data.nameCollected).toBe('Virginie Barre');
    expect(data.emailCollected).toBe('v@barre.be');
    expect(data.phoneCollected).toBe('+32472222222');
    expect(data.isLead).toBe(true);
  });

  it('le numéro dicté arrive dans phoneCollected ET dans le CRM, callerNumber garde l\'identité de la ligne', async () => {
    modelSays({ ...NO_ANALYSIS_FIELDS, callerName: 'Anna Peeters' });
    await run({ liveLead: { name: 'Anna Peeters', email: null, phone: '+32473333333', reason: 'rappel', urgency: 'normal' } });
    const data = mocks.createCall.mock.calls[0][0].data;
    expect(data.callerNumber).toBe('+32470000000');
    expect(data.phoneCollected).toBe('+32473333333');
    const crm = mocks.crmCreateOrMerge.mock.calls[0][1];
    expect(crm.phone).toBe('+32473333333');
    expect(crm.name).toBe('Anna Peeters');
  });

  it('sans liveLead, le comportement ancien tient: phoneCollected = callerNumber', async () => {
    modelSays({ ...NO_ANALYSIS_FIELDS, callerName: 'Anna Peeters' });
    await run({});
    const data = mocks.createCall.mock.calls[0][0].data;
    expect(data.phoneCollected).toBe('+32470000000');
    expect(data.isLead).toBe(false);
  });
});

describe('knownCallerName — le nom capté en direct bat la réservation historique', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  const known = (...a: unknown[]) => (clientCallService as any).knownCallerName(...a) as Promise<string | null>;

  it('liveLead name > dernière réservation du numéro > mémoire', async () => {
    mocks.findBooking.mockResolvedValueOnce({ customerName: 'Vieille Orthographe' });
    expect(await known('c1', '+32470000000', null, 'Nouvelle Orthographe')).toBe('Nouvelle Orthographe');
  });

  it('la réservation LIVE reste première, comme avant', async () => {
    mocks.findBooking.mockResolvedValueOnce({ customerName: 'Jean-Luc de la forge' });
    expect(await known('c1', '+32470000000', 'b1', 'Autre Nom')).toBe('Jean-Luc de la forge');
  });

  it('un nom liveLead de remplissage (« client ») ne prime pas la mémoire', async () => {
    mocks.findBooking.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.findMemory.mockResolvedValueOnce({ knownName: 'Élodie D\'Hoore' });
    expect(await known('c1', '+32470000000', null, 'client')).toBe('Élodie D\'Hoore');
  });

  it('sans liveLead, rien ne change: réservation puis mémoire', async () => {
    /* Une seule lecture de réservation dans ce chemin (pas de réservation
       live, pas de nom dicté): la dernière réservation du numéro porte. */
    mocks.findBooking.mockResolvedValueOnce({ customerName: 'Stéphane Van Hold' });
    expect(await known('c1', '+324****0000', null, null)).toBe('Stéphane Van Hold');
  });
});
