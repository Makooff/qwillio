import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le trou réparé ici allait frapper le PREMIER vrai client payant.
 *
 * `ensureLine` n'est appelée qu'à l'inscription, où le client est encore en
 * essai: il reçoit donc la ligne PARTAGÉE, ce qui est juste. La conversion
 * passait ensuite le statut à `active` et s'arrêtait là. Le client payait, un
 * numéro du stock l'attendait en base, et il restait sur la ligne partagée
 * pour toujours — jusqu'à ce que quelqu'un pense à lancer `phone:assign` à la
 * main.
 */
const { clientUpdate, reminderUpdateMany, ensureLine, analyticsUpsert, warn, error } = vi.hoisted(() => ({
  clientUpdate: vi.fn(),
  reminderUpdateMany: vi.fn(),
  ensureLine: vi.fn(),
  analyticsUpsert: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    client: { update: clientUpdate, findUnique: vi.fn() },
    reminder: { updateMany: reminderUpdateMany },
    payment: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    analyticsDaily: { upsert: analyticsUpsert },
  },
}));
vi.mock('../../config/stripe', () => ({
  stripe: { subscriptions: { create: vi.fn() } },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn, error, debug: vi.fn() },
}));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../email.service', () => ({ emailService: {} }));
vi.mock('../onboarding.service', () => ({ onboardingService: {} }));
vi.mock('../voice/phone-setup.service', () => ({ phoneSetupService: { ensureLine } }));

import { stripeService } from '../stripe.service';

const client = { id: 'c1', businessName: 'Chez Marie', planType: 'pro' };

/** `handleTrialConversion` est privée: on l'atteint par son seul appelant. */
const convert = () =>
  (stripeService as unknown as {
    handleTrialConversion: (c: unknown, s: unknown) => Promise<void>;
  }).handleTrialConversion(client, { customer: null, subscription: null });

beforeEach(() => {
  vi.clearAllMocks();
  clientUpdate.mockResolvedValue({});
  reminderUpdateMany.mockResolvedValue({ count: 0 });
  analyticsUpsert.mockResolvedValue({});
  ensureLine.mockResolvedValue({ state: 'active', number: '+32470112233', reason: null });
});

describe('la ligne dédiée arrive avec le paiement', () => {
  it('attribue une ligne quand l\'essai devient payant', async () => {
    await convert();
    expect(ensureLine).toHaveBeenCalledWith('c1');
  });

  it('passe par ensureLine, jamais par une seconde règle écrite ici', async () => {
    // Une deuxième règle d'attribution finirait par diverger de celle qui
    // fait foi. Le seul argument est le client: le stock, l'achat et la
    // ligne partagée sont décidés là-bas.
    await convert();
    expect(ensureLine.mock.calls[0]).toEqual(['c1']);
  });

  /**
   * Un webhook Stripe qui lève est REJOUÉ par Stripe. Une panne Vapi ferait
   * donc reconvertir l'abonnement en boucle.
   */
  it('ne fait pas échouer la conversion quand l\'attribution casse', async () => {
    ensureLine.mockRejectedValue(new Error('vapi down'));
    await expect(convert()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    // La conversion, elle, est allée jusqu'au bout.
    expect(reminderUpdateMany).toHaveBeenCalled();
  });

  it('signale bruyamment un client qui paie sans ligne dédiée', async () => {
    // Stock vide, achat automatique éteint, assistant pas encore créé: le
    // client est joignable mais sur la ligne partagée, et il PAIE.
    ensureLine.mockResolvedValue({ state: 'shared', number: null, reason: 'stock vide' });
    await convert();
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toMatch(/phone:assign/);
  });
});
