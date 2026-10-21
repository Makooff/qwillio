import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le magasin durable des captures: UNE ligne `pending` par (tenant, room),
 * les corrections fusionnées (derniers faits gagnants, ancien contenu en
 * `revisions`), la liaison à la fiche d'appel idempotente.
 */

const prismaMock = vi.hoisted(() => ({
  agentCrmActivity: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock('../../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  mergeCaptureContent,
  persistCapture,
  persistRoomCapture,
  getPendingCaptureForRoom,
  linkCaptureToCall,
} = await import('../lead-capture-store.service');

const CAPTURE = (sur: Partial<{ phone: string; name: string; reason: string }> = {}) => ({
  source: 'voice-core',
  vapiCallId: 'room-1',
  capturedAt: '2026-10-20T10:00:00Z',
  contact: { name: sur.name ?? 'Julie', email: null, phone: sur.phone ?? '+32475111111', address: null },
  reason: sur.reason ?? 'rappel',
  urgency: 'normal',
});

/** Exécute le callback de $transaction avec un `tx` qui partage les mocks. */
function transactionDirecte() {
  prismaMock.$transaction.mockImplementation(async (cb: any) =>
    cb({
      ...prismaMock,
      $queryRaw: prismaMock.$queryRaw,
    }),
  );
}

describe('mergeCaptureContent', () => {
  it('ignore un historique malformé au lieu de perdre la correction', () => {
    expect(() => mergeCaptureContent({ ...CAPTURE(), revisions: {} }, CAPTURE())).not.toThrow();
  });
  it('les derniers faits gagnent, les clés absentes du nouveau contenu sont conservées', () => {
    const precedent = { ...CAPTURE(), clientCallId: 'call-1', extra: 'gardé' };
    const dernier = { ...CAPTURE({ phone: '+32475222222' }), capturedAt: '2026-10-20T10:05:00Z' };
    const fusion = mergeCaptureContent(precedent, dernier);
    expect(fusion.contact.phone).toBe('+32475222222');
    expect(fusion.clientCallId).toBe('call-1');
    expect(fusion.extra).toBe('gardé');
  });

  it("pousse l'ancien contenu en revisions, sans y inclure les revisions elles-mêmes", () => {
    const precedent = mergeCaptureContent(CAPTURE(), CAPTURE({ phone: '+32475999999' }));
    expect(precedent.revisions).toHaveLength(1);
    const encore = mergeCaptureContent(precedent, CAPTURE({ phone: '+32475333333' }));
    expect(encore.revisions).toHaveLength(2);
    expect((encore.revisions![0] as any).contact.phone).toBe('+32475999999');
    expect((encore.revisions![0] as any).revisions).toBeUndefined();
  });

  it('borne revisions à 5', () => {
    let contenu = CAPTURE();
    for (let i = 0; i < 8; i++) {
      contenu = mergeCaptureContent(contenu, CAPTURE({ phone: `+3247500000${i}` }));
    }
    expect(contenu.revisions).toHaveLength(5);
  });
});

const ROOMLESS_CAPTURE = (sur: Parameters<typeof CAPTURE>[0] = {}) => ({ ...CAPTURE(sur), vapiCallId: null });

describe('persistCapture — la correction réutilise la ligne de sa session', () => {
  it('porte la portée tenant et le type de capture sur chaque correction', async () => {
    vi.clearAllMocks();
    prismaMock.agentCrmActivity.findUnique.mockResolvedValue({ id: 'act-9', content: ROOMLESS_CAPTURE(), status: 'pending' });
    await persistCapture({ clientId: 'c1', activityId: 'act-9', content: ROOMLESS_CAPTURE() });
    expect(prismaMock.agentCrmActivity.findUnique.mock.calls[0][0].where).toMatchObject({ id: 'act-9', clientId: 'c1', type: 'lead_capture' });
    expect(prismaMock.agentCrmActivity.update.mock.calls[0][0].where).toMatchObject({ id: 'act-9', clientId: 'c1', type: 'lead_capture', status: 'pending' });
  });

  beforeEach(() => vi.clearAllMocks());

  it("sans activityId: crée (la session n'a rien à corriger)", async () => {
    prismaMock.agentCrmActivity.create.mockResolvedValue({ id: 'act-1' });
    const r = await persistCapture({ clientId: 'c1', content: ROOMLESS_CAPTURE() });
    expect(r).toEqual({ id: 'act-1', updated: false });
    expect(prismaMock.agentCrmActivity.create).toHaveBeenCalledTimes(1);
  });

  it('avec activityId pending: met à jour, pas de création', async () => {
    prismaMock.agentCrmActivity.findUnique.mockResolvedValue({ id: 'act-9', content: ROOMLESS_CAPTURE(), status: 'pending' });
    const r = await persistCapture({ clientId: 'c1', activityId: 'act-9', content: ROOMLESS_CAPTURE({ phone: '+32475222222' }) });
    expect(r).toEqual({ id: 'act-9', updated: true });
    expect(prismaMock.agentCrmActivity.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.agentCrmActivity.create).not.toHaveBeenCalled();
    const ecrit = prismaMock.agentCrmActivity.update.mock.calls[0][0].data.content;
    expect(ecrit.contact.phone).toBe('+32475222222');
    expect(ecrit.revisions).toHaveLength(1);
  });

  it('une activité déjà traitée (non pending) ne se laisse pas corriger: création', async () => {
    prismaMock.agentCrmActivity.findUnique.mockResolvedValue({ id: 'act-9', content: ROOMLESS_CAPTURE(), status: 'converted' });
    prismaMock.agentCrmActivity.create.mockResolvedValue({ id: 'act-10' });
    const r = await persistCapture({ clientId: 'c1', activityId: 'act-9', content: ROOMLESS_CAPTURE() });
    expect(r).toEqual({ id: 'act-10', updated: false });
    expect(prismaMock.agentCrmActivity.update).not.toHaveBeenCalled();
  });
});

describe('persistRoomCapture — une capture logique par (tenant, room)', () => {
  it('deux premières captures Vapi concurrentes prennent le même verrou et créent une seule ligne', async () => {
    let row: any = null;
    let queue = Promise.resolve();
    const sql: string[] = [];
    prismaMock.agentCrmActivity.findFirst.mockImplementation(async () => row);
    prismaMock.agentCrmActivity.create.mockImplementation(async ({ data }: any) => {
      row = { id: 'shared', content: data.content, status: 'pending' };
      return { id: row.id };
    });
    prismaMock.agentCrmActivity.update.mockImplementation(async ({ data }: any) => { row.content = data.content; return row; });
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      let release: (() => void) | undefined;
      try {
        return await callback({ ...prismaMock, $queryRaw: async (parts: TemplateStringsArray) => {
          sql.push(parts.join('?'));
          const before = queue;
          queue = new Promise<void>(resolve => { release = resolve; });
          await before;
          return [];
        } });
      } finally { release?.(); }
    });
    const results = await Promise.all([
      persistCapture({ clientId: 'c1', content: CAPTURE() }),
      persistCapture({ clientId: 'c1', content: CAPTURE({ name: 'Julie corrigée' }) }),
    ]);
    expect(results.map(r => r.id)).toEqual(['shared', 'shared']);
    expect(prismaMock.agentCrmActivity.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.agentCrmActivity.update).toHaveBeenCalledTimes(1);
    expect(sql).toHaveLength(2);
    expect(sql.every(query => query.includes('pg_advisory_xact_lock') && query.includes('::text'))).toBe(true);
  });
  it('Vapi sans session mémorisée retrouve la même capture par tenant et room sous verrou', async () => {
    prismaMock.agentCrmActivity.findFirst.mockResolvedValue({ id: 'already-captured', content: CAPTURE() });
    const result = await persistCapture({ clientId: 'c1', content: CAPTURE() });
    expect(result).toEqual({ id: 'already-captured', updated: true });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.agentCrmActivity.create).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([]);
    transactionDirecte();
  });

  it('première émission: crée, en prenant le verrou advisory', async () => {
    prismaMock.agentCrmActivity.findFirst.mockResolvedValue(null);
    prismaMock.agentCrmActivity.create.mockResolvedValue({ id: 'act-1' });
    const r = await persistRoomCapture({ clientId: 'c1', room: 'room-1', buildContent: () => CAPTURE() });
    expect(r).toEqual({ id: 'act-1', updated: false });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.agentCrmActivity.create).toHaveBeenCalledTimes(1);
  });

  it('relecture corrigée de la même room: met à jour la MÊME ligne, les derniers faits gagnent', async () => {
    prismaMock.agentCrmActivity.findFirst.mockResolvedValue({ id: 'act-1', content: CAPTURE() });
    const r = await persistRoomCapture({ clientId: 'c1', room: 'room-1', buildContent: () => CAPTURE({ phone: '+32475222222', reason: 'urgence changée' }) });
    expect(r).toEqual({ id: 'act-1', updated: true });
    expect(prismaMock.agentCrmActivity.create).not.toHaveBeenCalled();
    const ecrit = prismaMock.agentCrmActivity.update.mock.calls[0][0].data.content;
    expect(ecrit.contact.phone).toBe('+32475222222');
    expect(ecrit.reason).toBe('urgence changée');
    expect(ecrit.revisions).toHaveLength(1);
  });

  it('refuse une capture si le verrou échoue au lieu de créer sans sérialisation', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(Object.assign(new Error('raw'), { code: 'P2010' }));
    await expect(persistRoomCapture({ clientId: 'c1', room: 'room-1', buildContent: () => CAPTURE() })).rejects.toMatchObject({ code: 'P2010' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.agentCrmActivity.create).not.toHaveBeenCalled();
    expect(prismaMock.agentCrmActivity.update).not.toHaveBeenCalled();
  });

  it("ne fusionne JAMAIS deux rooms différentes: le where porte la room", async () => {
    prismaMock.agentCrmActivity.findFirst.mockResolvedValue(null);
    prismaMock.agentCrmActivity.create.mockResolvedValue({ id: 'act-2' });
    await persistRoomCapture({ clientId: 'c1', room: 'room-2', buildContent: () => CAPTURE() });
    const where = prismaMock.agentCrmActivity.findFirst.mock.calls[0][0].where;
    expect(where.content.equals).toBe('room-2');
    expect(where.clientId).toBe('c1');
  });
});

describe('getPendingCaptureForRoom', () => {
  it("rend la capture pending de la room, null quand il n'y en a pas", async () => {
    prismaMock.agentCrmActivity.findFirst.mockResolvedValue({ id: 'act-1', content: CAPTURE() });
    const trouvee = await getPendingCaptureForRoom('c1', 'room-1');
    expect(trouvee?.id).toBe('act-1');
    expect(trouvee?.content.contact.phone).toBe('+32475111111');
    prismaMock.agentCrmActivity.findFirst.mockResolvedValue(null);
    expect(await getPendingCaptureForRoom('c1', 'room-inconnue')).toBeNull();
  });
});

describe('linkCaptureToCall', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pose clientCallId dans le contenu en préservant le reste', async () => {
    prismaMock.agentCrmActivity.findUnique.mockResolvedValue({ id: 'act-1', content: CAPTURE() });
    await linkCaptureToCall({ clientId: 'c1', activityId: 'act-1', clientCallId: 'call-42' });
    const ecrit = prismaMock.agentCrmActivity.update.mock.calls[0][0].data.content;
    expect(ecrit.clientCallId).toBe('call-42');
    expect(ecrit.contact.phone).toBe('+32475111111');
  });

  it('idempotent: un second appel avec le même callId ne réécrit pas', async () => {
    prismaMock.agentCrmActivity.findUnique.mockResolvedValue({ id: 'act-1', content: { ...CAPTURE(), clientCallId: 'call-42' } });
    await linkCaptureToCall({ clientId: 'c1', activityId: 'act-1', clientCallId: 'call-42' });
    expect(prismaMock.agentCrmActivity.update).not.toHaveBeenCalled();
  });
});
