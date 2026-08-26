import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'attribution d'une ligne entrante.
 *
 * Ce qui se paie cher ici n'est pas un bogue de calcul, c'est un client
 * injoignable qu'on ne découvre qu'au moment où un appelant se plaint. Ces
 * tests portent donc sur les quatre situations qui produisent ce silence:
 * la double activation, l'assistant manquant, la ligne déjà prise par un
 * autre client, et la panne du fournisseur.
 */

const findUnique = vi.fn();
const update = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: { client: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a) } },
}));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const allocateInboundNumber = vi.fn();
vi.mock('../phone-allocation.service', async () => {
  const real = await vi.importActual<typeof import('../phone-allocation.service')>('../phone-allocation.service');
  return { normalizeNumber: real.normalizeNumber, allocateInboundNumber: (...a: unknown[]) => allocateInboundNumber(...a) };
});

const autoProvisionNumber = vi.fn();
const autoProvisionEnabled = vi.fn(() => true);
vi.mock('../phone-provisioning.service', () => ({
  autoProvisionNumber: (...a: unknown[]) => autoProvisionNumber(...a),
  autoProvisionEnabled: () => autoProvisionEnabled(),
}));

const { phoneSetupService, hasPaidSubscription } = await import('../phone-setup.service');

/** Un client tel que le `select` de `ensureLine` le rend. */
const client = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  vapiPhoneNumber: null,
  vapiAssistantId: 'asst_1',
  subscriptionStatus: 'active',
  phoneSetupState: 'none',
  ...over,
});

/** L'état écrit par le dernier `update` portant sur `phoneSetupState`. */
const writtenState = () => {
  const calls = update.mock.calls.filter(c => c[0]?.data?.phoneSetupState);
  return calls.length ? calls[calls.length - 1][0].data : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  autoProvisionEnabled.mockReturnValue(true);
  update.mockResolvedValue({});
});

describe('un abonné payant reçoit sa propre ligne', () => {
  it('achète un numéro et le pose sur le client', async () => {
    findUnique.mockResolvedValue(client());
    autoProvisionNumber.mockResolvedValue({ number: '+3225550011', numberId: 'pn_1' });

    const r = await phoneSetupService.ensureLine('c1');

    expect(r).toMatchObject({ state: 'active', number: '+3225550011', unchanged: false });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vapiPhoneNumber: '+3225550011' }) }),
    );
  });

  it('ne donne PAS de ligne dédiée à un essai', () => {
    /* Le critère est l'abonnement, pas le palier: une ligne coûte de l'ordre
       d'un euro contre 99 au moins d'abonnement, donc la réserver aux gros
       paliers laisserait les petits clients sur le chemin fragile. Ce qu'on
       écarte, c'est une ligne par essai gratuit. */
    expect(hasPaidSubscription('active')).toBe(true);
    expect(hasPaidSubscription('trialing')).toBe(false);
    expect(hasPaidSubscription(null)).toBe(false);
  });

  it('met un essai sur la ligne partagée, en disant pourquoi', async () => {
    findUnique.mockResolvedValue(client({ subscriptionStatus: 'trialing' }));
    allocateInboundNumber.mockResolvedValue({ kind: 'allocated', number: '+3280000000', numberId: null });

    const r = await phoneSetupService.ensureLine('c1');

    expect(r.state).toBe('shared');
    expect(r.reason).toMatch(/essai/i);
    // Et surtout: aucun achat n'est déclenché pour un essai.
    expect(autoProvisionNumber).not.toHaveBeenCalled();
  });
});

describe('la double activation est un non-évènement', () => {
  it('ne rachète RIEN quand la ligne est déjà en service', async () => {
    /* Chaque achat réussi facture une ligne au compte. Une seconde activation
       naïvement écrite ferait payer un numéro que personne ne composera. */
    findUnique.mockResolvedValue(client({ phoneSetupState: 'active', vapiPhoneNumber: '+3225550011' }));

    const r = await phoneSetupService.ensureLine('c1');

    expect(r).toEqual({ state: 'active', number: '+3225550011', numberId: null, reason: null, unchanged: true });
    expect(autoProvisionNumber).not.toHaveBeenCalled();
    expect(allocateInboundNumber).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('répare un état « active » sans numéro au lieu de le propager', async () => {
    // Incohérence possible après une panne au milieu d'une écriture: l'état
    // dit servi, le numéro dit non. Le NUMÉRO fait foi.
    findUnique.mockResolvedValue(client({ phoneSetupState: 'active', vapiPhoneNumber: null }));
    autoProvisionNumber.mockResolvedValue({ number: '+3225550022', numberId: 'pn_2' });

    const r = await phoneSetupService.ensureLine('c1');

    expect(r).toMatchObject({ state: 'active', number: '+3225550022', unchanged: false });
  });
});

describe("ce qui empêche d'attribuer une ligne se dit, au lieu de se taire", () => {
  it("attend l'assistant plutôt que d'acheter une ligne qui sonnerait dans le vide", async () => {
    // Vapi rattache le numéro à un assistant: sans lui, l'achat produit une
    // ligne facturée que personne ne décroche.
    findUnique.mockResolvedValue(client({ vapiAssistantId: null }));

    const r = await phoneSetupService.ensureLine('c1');

    expect(r.state).toBe('failed');
    expect(r.reason).toMatch(/assistant/i);
    expect(autoProvisionNumber).not.toHaveBeenCalled();
    expect(writtenState()).toMatchObject({ phoneSetupState: 'failed' });
  });

  it("retombe sur la ligne partagée quand l'achat échoue, plutôt que de laisser le client injoignable", async () => {
    findUnique.mockResolvedValue(client());
    autoProvisionNumber.mockResolvedValue(null); // pays non couvert, dossier manquant, quota
    allocateInboundNumber.mockResolvedValue({ kind: 'allocated', number: '+3280000000', numberId: null });

    const r = await phoneSetupService.ensureLine('c1');

    expect(r.state).toBe('shared');
    expect(r.reason).toMatch(/n'a pas pu être acheté/i);
  });

  it("refuse de partager une ligne déjà tenue par un AUTRE client", async () => {
    /* Deux clients sur un même numéro entrant, ce n'est pas deux clients
       servis: c'est deux clients injoignables, puisque plus rien ne distingue
       leurs appels. Mieux vaut un échec écrit qu'un routage au hasard. */
    findUnique.mockResolvedValue(client({ subscriptionStatus: 'trialing' }));
    allocateInboundNumber.mockResolvedValue({ kind: 'none', reason: 'already_taken', heldBy: 'c2' });

    const r = await phoneSetupService.ensureLine('c1');

    expect(r.state).toBe('failed');
    expect(r.number).toBeNull();
    expect(r.reason).toMatch(/déjà attribuée/i);
    // Aucun numéro n'est posé sur le client: c'est ce qui garantit l'isolation.
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vapiPhoneNumber: expect.anything() }) }),
    );
  });

  it("dit que l'achat automatique est coupé, au lieu de faire semblant", async () => {
    findUnique.mockResolvedValue(client());
    autoProvisionEnabled.mockReturnValue(false);
    allocateInboundNumber.mockResolvedValue({ kind: 'allocated', number: '+3280000000', numberId: null });

    const r = await phoneSetupService.ensureLine('c1');

    expect(r.state).toBe('shared');
    expect(r.reason).toMatch(/PHONE_AUTO_PROVISION/);
  });

  it('ne lève jamais sur un client inconnu', async () => {
    // Un onboarding qui échoue en levant laisse un client à moitié créé, plus
    // difficile à rattraper qu'un état `failed` avec sa raison.
    findUnique.mockResolvedValue(null);
    const r = await phoneSetupService.ensureLine('fantome');
    expect(r.state).toBe('failed');
    expect(r.unchanged).toBe(true);
  });
});
