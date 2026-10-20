import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La correction relue dans le même appel (l'appelant change un chiffre,
 * épelle son nom de famille) doit aboutir à UNE capture logique: la ligne
 * posée par le premier passage est mise à jour via `session.leadActivityId`,
 * et la session (`recordLead`/`markLeadActivity`) ne se met d'accord qu'APRÈS
 * la persistance durable — jamais avant.
 */

const { create, findUnique, update, getProfile, session, recordLead, markLeadActivity, remember, needsReadBack, needsNameReadBack } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  getProfile: vi.fn(),
  session: vi.fn(),
  recordLead: vi.fn(),
  markLeadActivity: vi.fn(),
  remember: vi.fn(),
  needsReadBack: vi.fn(),
  needsNameReadBack: vi.fn(),
}));

vi.mock('../../../config/database', () => {
  const db: any = {
    agentCrmActivity: { create, findUnique, update, findFirst: vi.fn(async () => {
      const row = await findUnique();
      return row?.status === 'pending' ? row : null;
    }) },
    $queryRaw: vi.fn(async () => []),
  };
  db.$transaction = vi.fn(async (callback: any) => callback(db));
  return { prisma: db };
});
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../realtime-context.service', () => ({
  realtimeContextService: { getClientProfile: getProfile, getCallerHistory: vi.fn(async () => ({ knownName: 'Connu' })) },
}));
vi.mock('../call-session.store', () => ({
  callSessionStore: {
    get: session,
    recordLead,
    markLeadActivity,
    recordToolCall: vi.fn(),
    recordPhoneCaptureFailure: vi.fn(() => 1),
    needsPhoneReadBack: needsReadBack,
    needsNameReadBack: needsNameReadBack,
    needsNameSpelling: vi.fn(() => false),
  },
}));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember } }));
vi.mock('../business-memory.service', () => ({ businessMemoryService: { remember: vi.fn() } }));
vi.mock('../availability-speculator', () => ({ availabilitySpeculator: { take: vi.fn(), speculate: vi.fn() } }));
vi.mock('../../google-calendar.service', () => ({ googleCalendarService: {} }));

const { toolRuntimeService } = await import('../tool-runtime.service');

const profile = { clientId: 'c1', businessName: 'Chez Marie', language: 'fr', country: 'BE', agentName: 'Marc' };

const PREMIERE_CAPTURE = {
  id: 'act_1',
  content: {
    source: 'ai_receptionist',
    vapiCallId: 'call_1',
    capturedAt: '2026-10-20T10:00:00Z',
    contact: { name: 'Dupond', email: null, phone: '+32475123456', address: null },
    reason: 'devis',
    urgency: 'normal',
    forPerson: null,
    callbackWhen: null,
    language: 'fr',
    businessName: 'Chez Marie',
  },
};

async function capture(args: Record<string, unknown>) {
  return toolRuntimeService.execute('c1', 'call_1', { name: 'captureLead', args, toolCallId: 't1' } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfile.mockResolvedValue(profile);
  create.mockResolvedValue({ id: 'act_1' });
  remember.mockResolvedValue(undefined);
  needsReadBack.mockReturnValue(false); // confirmations déjà passées
  needsNameReadBack.mockReturnValue(false);
});

describe('captureLead — correction relue dans le même appel', () => {
  it('indexe la mémoire par transport, pas par le numéro de rappel dicté', async () => {
    session.mockReturnValue({ callerNumber: '+33612345678' });
    await capture({ name: 'Julie Mertens', reason: 'devis', phone: '0475123456' });
    expect(remember).toHaveBeenCalledWith(expect.objectContaining({
      callerNumber: '+33612345678', callId: 'call_1', phase: 'capture', identitySource: 'capture',
      request: { text: 'devis', callbackWhen: null, forPerson: null },
    }));
    const rappel = create.mock.calls[0][0].data.content.contact.phone;
    expect(remember.mock.calls[0][0].callbackNumber).toBe(rappel);
    expect(remember.mock.calls[0][0].callerNumber).not.toBe(rappel);
  });

  it("premier passage: crée la ligne, ET la session ne l'apprend qu'après l'écriture", async () => {
    session.mockReturnValue({ callerNumber: '+32475123456' });

    await capture({ name: 'Dupond', reason: 'devis', phone: '0475123456' });

    expect(create).toHaveBeenCalledTimes(1);
    expect(recordLead).toHaveBeenCalledTimes(1);
    expect(markLeadActivity).toHaveBeenCalledWith('call_1', 'act_1');
    /* L'ORDRE EST LE CONTRAT: ni recordLead ni markLeadActivity ne peuvent
       précéder l'écriture durable — sinon une session croit un lead qui
       n'existe pas et la fin d'appel ne le retrouve pas. */
    const ordreCreate = create.mock.invocationCallOrder[0];
    expect(recordLead.mock.invocationCallOrder[0]).toBeGreaterThan(ordreCreate);
    expect(markLeadActivity.mock.invocationCallOrder[0]).toBeGreaterThan(ordreCreate);
  });

  it('deuxième passage (numéro corrigé): met à jour la MÊME ligne, une seule capture durable', async () => {
    session.mockReturnValue({ callerNumber: '+32475123456', leadActivityId: 'act_1' });
    findUnique.mockResolvedValue({ id: 'act_1', content: PREMIERE_CAPTURE.content, status: 'pending' });

    await capture({ name: 'Dupond', reason: 'devis', phone: '0487123456' });

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'act_1', clientId: 'c1', type: 'lead_capture', status: 'pending' } }));
    const ecrit = update.mock.calls[0][0].data.content;
    expect(ecrit.contact.phone).toBe('+32487123456');
    expect(ecrit.reason).toBe('devis');
    /* La version corrigée garde la trace de la première: la relecture qui a
       mené à la correction a de la valeur, elle aussi. */
    expect(ecrit.revisions).toHaveLength(1);
    expect(ecrit.revisions[0].contact.phone).toBe('+32475123456');
    expect(markLeadActivity).toHaveBeenCalledWith('call_1', 'act_1');
  });

  it('correction du nom épélé: les derniers faits gagnent', async () => {
    session.mockReturnValue({ callerNumber: '+32475123456', leadActivityId: 'act_1' });
    findUnique.mockResolvedValue({ id: 'act_1', content: PREMIERE_CAPTURE.content, status: 'pending' });

    await capture({ name: 'Maréchal', reason: 'devis' });

    const ecrit = update.mock.calls[0][0].data.content;
    expect(ecrit.contact.name).toBe('Maréchal');
    expect(ecrit.contact.phone).toBe('+32475123456');
  });

  it("une activité déjà traitée n'est pas réécrite: la correction crée une nouvelle ligne", async () => {
    session.mockReturnValue({ callerNumber: '+32475123456', leadActivityId: 'act_1' });
    findUnique.mockResolvedValue({ id: 'act_1', content: PREMIERE_CAPTURE.content, status: 'converted' });

    await capture({ name: 'Dupond', reason: 'devis', phone: '0487123456' });

    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    /* La session suit la nouvelle ligne, pas l'ancienne décision. */
    expect(markLeadActivity).toHaveBeenCalledWith('call_1', 'act_1');
  });
});
