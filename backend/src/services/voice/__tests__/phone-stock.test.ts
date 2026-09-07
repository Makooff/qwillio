import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const count = vi.fn();
const queryRaw = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: {
    phoneNumberStock: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
  },
}));
vi.mock('../../../config/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../config/env', () => ({ env: { PHONE_STOCK_LOW_THRESHOLD: 3 } }));

const updatePhoneNumber = vi.fn();
vi.mock('../../../config/vapi', () => ({
  vapiClient: { updatePhoneNumber: (...a: unknown[]) => updatePhoneNumber(...a) },
}));

const { claimNumberForClient, releaseClientNumbers, stockLevel } = await import('../phone-stock.service');

describe('claimNumberForClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
    count.mockResolvedValue(5);
    updatePhoneNumber.mockResolvedValue({});
  });

  it('prend le plus ancien numéro libre et le fait sonner chez l\'assistant', async () => {
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' }]);

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim).toEqual({ kind: 'claimed', number: '+3223334455', vapiNumberId: 'pn_1', reused: false });
    expect(updatePhoneNumber).toHaveBeenCalledWith('pn_1', { assistantId: 'asst_1' });
  });

  it("ne consomme pas un second numéro pour un client qui en tient déjà un", async () => {
    /* Le scénario « double activation »: sans ce garde-fou, chaque repassage
       viderait le lot d'une ligne, en silence et en facturant. */
    findFirst.mockResolvedValue({ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' });

    const claim = await claimNumberForClient('c1', 'asst_2');

    expect(claim).toMatchObject({ kind: 'claimed', number: '+3223334455', reused: true });
    expect(queryRaw).not.toHaveBeenCalled();
    // Le rattachement est rejoué: l'assistant a pu être recréé entre-temps.
    expect(updatePhoneNumber).toHaveBeenCalledWith('pn_1', { assistantId: 'asst_2' });
  });

  it('dit que le stock est vide plutôt que de rendre une ligne inventée', async () => {
    queryRaw.mockResolvedValue([]);
    expect(await claimNumberForClient('c1', 'asst_1')).toEqual({ kind: 'empty' });
  });

  it('rend le numéro au stock si le rattachement Vapi échoue', async () => {
    /* Un numéro pris mais muet est PIRE que pas de numéro: le client le croit
       actif et découvre la panne par un appelant. */
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' }]);
    updatePhoneNumber.mockRejectedValue(new Error('403'));

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim.kind).toBe('failed');
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'available', clientId: null, assignedAt: null },
    });
  });

  it("refuse d'attribuer un numéro acheté mais jamais importé chez Vapi", async () => {
    // Facturé chez Twilio, injoignable: il ne doit pas passer pour une ligne.
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: null }]);

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim).toMatchObject({ kind: 'failed' });
    expect(updatePhoneNumber).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled(); // rendu au stock
  });

  it("n'échoue pas l'attribution parce que le compteur de stock est indisponible", async () => {
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' }]);
    count.mockRejectedValue(new Error('base indisponible'));

    expect((await claimNumberForClient('c1', 'asst_1')).kind).toBe('claimed');
  });
});

describe('releaseClientNumbers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePhoneNumber.mockResolvedValue({});
  });

  it('détache l\'assistant et remet la ligne dans le lot des libres', async () => {
    findMany.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' }]);
    updateMany.mockResolvedValue({ count: 1 });

    expect(await releaseClientNumbers('c1')).toBe(1);
    expect(updatePhoneNumber).toHaveBeenCalledWith('pn_1', { assistantId: null });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'c1', status: 'assigned' },
        data: expect.objectContaining({ status: 'available', clientId: null }),
      }),
    );
  });

  it('libère quand même en base si le détachement Vapi échoue', async () => {
    /* Sinon un numéro resterait bloqué sur un client résilié, donc perdu pour
       le lot, à cause d'une erreur passagère chez Vapi. */
    findMany.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' }]);
    updatePhoneNumber.mockRejectedValue(new Error('500'));
    updateMany.mockResolvedValue({ count: 1 });

    expect(await releaseClientNumbers('c1')).toBe(1);
    expect(updateMany).toHaveBeenCalled();
  });
});

describe('stockLevel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signale un stock bas sous le seuil', async () => {
    count.mockResolvedValueOnce(2).mockResolvedValueOnce(8);
    expect(await stockLevel()).toEqual({ available: 2, assigned: 8, low: true });
  });

  it('ne signale rien au-dessus du seuil', async () => {
    count.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    expect(await stockLevel()).toEqual({ available: 7, assigned: 3, low: false });
  });
});
