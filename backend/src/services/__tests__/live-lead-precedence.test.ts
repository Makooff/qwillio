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
  upsertCall: vi.fn(),
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
    /* Le service convertit le placeholder EN PLACE (`upsert` sur vapiCallId) :
       plus de create seul, plus de delete-then-create. Le mock applique la
       branche create quand aucune fiche n'existe, la branche update sinon —
       en sautant les champs `undefined`, comme Prisma. */
    clientCall: { create: mocks.createCall, upsert: mocks.upsertCall, aggregate: mocks.aggregate, findUnique: mocks.readCall, update: mocks.updateCall },
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

describe('identity reset knownCallerName', () => {
  it('does not use pre-reset bookings, including a live booking id; accepts new explicit spelling', async () => {
    mocks.findMemory.mockResolvedValue({ facts: { version: 1, meta: { identityResetAt: '2026-10-20T00:00:00.000Z' } } });
    mocks.findBooking.mockResolvedValue({ customerName: 'Old', createdAt: new Date('2026-10-19') });
    const known = async (...args: unknown[]) => (await (clientCallService as any).knownCallerIdentity(...args))?.name ?? null;
    expect(await known('c1', '32483620980', 'old-booking')).toBeNull();
    expect(await known('c1', '32483620980', null, 'Jean-Luc de la Forge')).toBe('Jean-Luc de la Forge');
  });
});

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
  mocks.upsertCall.mockImplementation(({ create, update }: any) => {
    if (!persisted.call) return mocks.createCall({ data: create });
    const data = Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined));
    Object.assign(persisted.call, data);
    return { ...persisted.call };
  });
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
    expect(data.phoneCollected).toBe(data.callerNumber);
    expect(data.isLead).toBe(false);
  });

  it('une ancienne réservation ne tronque pas le nom corrigé et accentué dans cet appel', async () => {
    mocks.findBooking.mockResolvedValue({ customerName: 'Mathieu Poll', createdAt: new Date('2026-10-23') });
    modelSays({
      ...NO_ANALYSIS_FIELDS, callerName: 'Mathieu Pollé', isLead: true,
      summary: 'Mathieu Pollé a appelé pour réserver une table.',
    });
    await clientCallService.handleClientCallCompleted(
      'c1', 'vapi-1',
      'User: Mathieu Paulé.\nAI: Pouvez-vous épeler votre nom de famille ?\nUser: P. O. L L accent aigu.\nAI: Je vous note ça, Mathieu Pollé.',
      30, '+324****0000', undefined, null, {},
    );
    expect(persisted.call.callerName).toBe('Mathieu Pollé');
    expect(persisted.call.nameCollected).toBe('Mathieu Pollé');
    expect(persisted.call.summary).toContain('Mathieu Pollé');
    expect(persisted.call.metadata.callerIdentityInherited).toBe(false);
    expect(persisted.call.metadata.completionLifecycle.promise.callerName).toBe('Mathieu Pollé');
    expect(mocks.crmCreateOrMerge.mock.calls[0][1].name).toBe('Mathieu Pollé');
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
    expect(prompt).not.toContain('confirmed name is "Mathieu Poll"');
    expect(prompt).toContain('historical name');
  });

  it('un nom historique reste un repli si aucun nom n’est extrait, sans devenir une nouvelle confirmation', async () => {
    mocks.findBooking.mockResolvedValue({ customerName: 'Élodie D’Hoore', createdAt: new Date('2026-10-23') });
    modelSays(NO_ANALYSIS_FIELDS);
    await run({});
    expect(persisted.call.callerName).toBe('Élodie D’Hoore');
    expect(persisted.call.metadata.callerIdentityInherited).toBe(true);
  });

  it('un identifiant de réservation live invalide ne transforme pas l’historique en nom confirmé', async () => {
    mocks.findBooking.mockResolvedValueOnce(null).mockResolvedValueOnce({ customerName: 'Mathieu Poll' });
    modelSays({ ...NO_ANALYSIS_FIELDS, callerName: 'Mathieu Pollé' });
    await run({ liveBookingId: 'missing-booking' });
    expect(persisted.call.callerName).toBe('Mathieu Pollé');
    expect(persisted.call.metadata.callerIdentityInherited).toBe(false);
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
    expect(prompt).not.toContain('confirmed name is "Mathieu Poll"');
  });

  it('un rejeu utilise sa date de fin réelle et non la date du traitement pour la mémoire', async () => {
    modelSays({ ...NO_ANALYSIS_FIELDS, callerName: null });
    const completedAt = new Date('2026-10-21T15:25:15.147Z');
    await (clientCallService as any).handleClientCallCompleted(
      'c1', 'vapi-1', 'APPELANT: allo', 364, '+324****0000', undefined, null, { completedAt },
    );
    expect(persisted.call.endedAt).toEqual(completedAt);
  });

  it('un placeholder « ended » du décroché est converti EN PLACE: même id, tenant, metadata mergée', async () => {
    modelSays({ ...NO_ANALYSIS_FIELDS, callerName: 'Anna Peeters' });
    /* La fiche durable posée avant le 202 : statut ended, transcript, durée,
       et la recordingSid apprise pendant l'appel. */
    persisted.call = {
      id: 'call-placeholder-9', clientId: 'c1', vapiCallId: 'vapi-1',
      status: 'ended', callerNumber: '+324****0000',
      metadata: { source: 'voice-core', room: 'vapi-1', recordingSid: 'RE123' },
    };
    await run({});
    /* AUCUN create : la fiche existante porte l'analyse. */
    expect(mocks.createCall).not.toHaveBeenCalled();
    expect(persisted.call.id).toBe('call-placeholder-9');
    expect(persisted.call.clientId).toBe('c1');
    expect(persisted.call.status).toBe('completed');
    // Provider call ids do not authorize a cross-tenant update.
    expect(mocks.upsertCall).toHaveBeenCalledWith(expect.objectContaining({
      where: { vapiCallId: 'vapi-1', clientId: 'c1' },
    }));
    /* L'identité de transport du placeholder (même numéro canonique, même
       tenant) est conservée par la conversion en place. */
    expect(persisted.call.callerNumber).toBeTruthy();
    /* Les métadonnées apprises avant l'analyse survivent, les clés du cycle
       de vie s'y ajoutent. */
    expect(persisted.call.metadata.recordingSid).toBe('RE123');
    expect(persisted.call.metadata.source).toBe('voice-core');
    expect(persisted.call.metadata.completionLifecycle.version).toBe(1);
  });

  it('retry final sur le MÊME placeholder: id et tenant inchangés, statut completed', async () => {
    /* Premier essai: échec simulé APRÈS écriture de la fiche (metadata posée). */
    modelSays({ ...NO_ANALYSIS_FIELDS, callerName: null });
    persisted.call = {
      id: 'call-placeholder-9', clientId: 'c1', vapiCallId: 'vapi-1',
      status: 'ended', callerNumber: '+324****0000',
      metadata: { recordingSid: 'RE123', completionLifecycle: { version: 1, completed: false } },
    };
    await run({});
    expect(persisted.call.id).toBe('call-placeholder-9');
    expect(persisted.call.clientId).toBe('c1');
    expect(persisted.call.status).toBe('completed');
    expect(mocks.createCall).not.toHaveBeenCalled();
  });
});

describe('knownCallerName — le nom capté en direct bat la réservation historique', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  const known = async (...a: unknown[]) => ((await (clientCallService as any).knownCallerIdentity(...a))?.name ?? null) as string | null;

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
