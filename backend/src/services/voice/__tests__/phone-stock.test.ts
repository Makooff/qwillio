import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const count = vi.fn();
const queryRaw = vi.fn();

/* `client_phone_numbers` — la table que le CŒUR VOCAL lit au décroché, via
   `/context/by-number`. Elle manquait à ce mock parce qu'elle manquait au
   module : personne n'y écrivait, donc chaque client activé recevait un numéro
   inconnu de sa propre réceptionniste. */
const ligneFindFirst = vi.fn();
const ligneCreate = vi.fn();
const ligneUpdate = vi.fn();
const ligneUpdateMany = vi.fn();

vi.mock('../../../config/database', () => ({
  prisma: {
    phoneNumberStock: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
    clientPhoneNumber: {
      findFirst: (...a: unknown[]) => ligneFindFirst(...a),
      create: (...a: unknown[]) => ligneCreate(...a),
      update: (...a: unknown[]) => ligneUpdate(...a),
      updateMany: (...a: unknown[]) => ligneUpdateMany(...a),
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
    ligneFindFirst.mockResolvedValue(null);
    ligneCreate.mockResolvedValue({ id: 'l1' });
    ligneUpdate.mockResolvedValue({});
    ligneUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('prend le plus ancien numéro libre et le fait sonner chez l\'assistant', async () => {
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1', sipTrunkSid: null }]);

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim).toEqual({ kind: 'claimed', number: '+3223334455', vapiNumberId: 'pn_1', reused: false });
    expect(updatePhoneNumber).toHaveBeenCalledWith('pn_1', { assistantId: 'asst_1' });
  });

  it("ne consomme pas un second numéro pour un client qui en tient déjà un", async () => {
    /* Le scénario « double activation »: sans ce garde-fou, chaque repassage
       viderait le lot d'une ligne, en silence et en facturant. */
    findFirst.mockResolvedValue({ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1', sipTrunkSid: null });

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

  /* « Un numéro pris mais muet est PIRE que pas de numéro » n'a pas changé.
     C'est CE QUI FAIT SONNER qui a changé : le cœur vocal a remplacé Vapi, et
     il ne lit que `client_phone_numbers`. La règle a donc suivi, et ce bloc
     dit où elle vit maintenant. */

  it("écrit la ligne que le cœur vocal lit", async () => {
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: null, sipTrunkSid: 'TK1' }]);

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim.kind).toBe('claimed');
    const data = ligneCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ clientId: 'c1', number: '+3223334455', isActive: true });
  });

  it("rend le numéro au stock si la ligne n'a pas pu être écrite", async () => {
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: null, sipTrunkSid: 'TK1' }]);
    ligneCreate.mockRejectedValue(new Error('base indisponible'));

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim.kind).toBe('failed');
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'available', clientId: null, assignedAt: null },
    });
  });

  it("réactive une ligne existante au lieu d'en créer une seconde", async () => {
    /* Deux lignes actives pour le même numéro feraient dépendre la réponse de
       `findFirst`, c'est-à-dire de l'ordre d'insertion. */
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: null, sipTrunkSid: 'TK1' }]);
    ligneFindFirst.mockResolvedValue({ id: 'l0', isActive: false });

    await claimNumberForClient('c1', 'asst_1');

    expect(ligneCreate).not.toHaveBeenCalled();
    expect(ligneUpdate).toHaveBeenCalledWith({ where: { id: 'l0' }, data: { isActive: true } });
  });

  it("n'annule plus la prise quand Vapi refuse, si le numéro est sur le trunk SIP", async () => {
    /* Faire échouer une activation parce qu'une API qu'on quitte a répondu 4xx
       serait se rendre dépendant de ce qu'on est en train de retirer. */
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1', sipTrunkSid: 'TK1' }]);
    updatePhoneNumber.mockRejectedValue(new Error('403'));

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim.kind).toBe('claimed');
    expect(update).not.toHaveBeenCalled();
  });

  it("refuse d'attribuer un numéro qui ne sonne NULLE PART", async () => {
    // Ni trunk SIP, ni Vapi: facturé chez Twilio, injoignable. Il ne doit pas
    // passer pour une ligne.
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: null, sipTrunkSid: null }]);

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim).toMatchObject({ kind: 'failed' });
    expect(updatePhoneNumber).not.toHaveBeenCalled();
    expect(ligneCreate).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled(); // rendu au stock
  });

  it('répare un client déjà activé qui tient un numéro sans ligne', async () => {
    /* Le cas de TOUS les clients créés avant ce correctif : le stock les dit
       servis, le cœur vocal ne les connaît pas. Une réactivation doit les
       remettre debout sans consommer un second numéro. */
    findFirst.mockResolvedValue({ id: 's9', number: '+3223339999', vapiNumberId: null, sipTrunkSid: 'TK1' });

    const claim = await claimNumberForClient('c1', 'asst_1');

    expect(claim).toMatchObject({ kind: 'claimed', reused: true });
    expect(ligneCreate).toHaveBeenCalledTimes(1);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("n'échoue pas l'attribution parce que le compteur de stock est indisponible", async () => {
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1', sipTrunkSid: null }]);
    count.mockRejectedValue(new Error('base indisponible'));

    expect((await claimNumberForClient('c1', 'asst_1')).kind).toBe('claimed');
  });
});

describe('releaseClientNumbers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePhoneNumber.mockResolvedValue({});
    ligneUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('détache l\'assistant et remet la ligne dans le lot des libres', async () => {
    findMany.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1', sipTrunkSid: null }]);
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

  it('désactive la ligne AVANT de rendre le numéro', async () => {
    /* Sans ça : le numéro repart au lot, un nouveau client le prend, et
       `by-number` trouve DEUX lignes. L'ancien client décroche chez le
       nouveau — avec son nom, ses horaires et ses rendez-vous. */
    findMany.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' }]);
    updateMany.mockResolvedValue({ count: 1 });

    await releaseClientNumbers('c1');

    expect(ligneUpdateMany).toHaveBeenCalledWith({
      where: { clientId: 'c1', number: '+3223334455' },
      data: { isActive: false },
    });
  });

  it('rend quand même le numéro si la désactivation de la ligne échoue', async () => {
    findMany.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1' }]);
    ligneUpdateMany.mockRejectedValue(new Error('base indisponible'));
    updateMany.mockResolvedValue({ count: 1 });

    expect(await releaseClientNumbers('c1')).toBe(1);
  });

  it('libère quand même en base si le détachement Vapi échoue', async () => {
    /* Sinon un numéro resterait bloqué sur un client résilié, donc perdu pour
       le lot, à cause d'une erreur passagère chez Vapi. */
    findMany.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1', sipTrunkSid: null }]);
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

  it('compte sur le propriétaire et non sur le statut', async () => {
    /* La suppression d'un client vide `client_id` par la contrainte sans
       toucher au statut. Compter les `status = 'available'` afficherait donc
       un stock plus bas que la réalité, et ferait racheter pour rien. */
    count.mockResolvedValue(0);
    await stockLevel();
    expect(count).toHaveBeenCalledWith({ where: { clientId: null, status: { not: 'retired' } } });
    expect(count).toHaveBeenCalledWith({ where: { clientId: { not: null } } });
  });
});

describe('la prise se fait sur le propriétaire, pas sur le statut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
    count.mockResolvedValue(5);
    updatePhoneNumber.mockResolvedValue({});
    ligneFindFirst.mockResolvedValue(null);
    ligneCreate.mockResolvedValue({ id: 'l1' });
  });

  it("cherche les numéros sans propriétaire, y compris ceux restés étiquetés « assigned »", async () => {
    /* Vérifié contre un vrai PostgreSQL: `ON DELETE SET NULL` laisse un numéro
       `assigned` sans client quand un client est SUPPRIMÉ (et non résilié).
       Filtrer sur `status = 'available'` sortirait cette ligne du lot pour
       toujours — la fuite exacte que ce module existe pour empêcher. */
    queryRaw.mockResolvedValue([{ id: 's1', number: '+3223334455', vapiNumberId: 'pn_1', sipTrunkSid: null }]);

    await claimNumberForClient('c1', 'asst_1');

    const sql = (queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toMatch(/client_id IS NULL AND status <> 'retired'/);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
  });
});
