import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le changement d'offre depuis un essai laissait DEUX abonnements vivants.
 *
 * Le bouton « Upgrader » du portail ouvre une caisse Stripe, et cette caisse
 * crée un nouvel abonnement. L'essai, lui, restait ouvert: même client, même
 * carte, plan d'origine. À la fin de l'essai, Stripe facturait les deux, et
 * Qwillio ne pointait plus que le second — donc rien, dans le produit, n'aurait
 * annulé le premier ni signalé son existence.
 *
 * C'est le chemin exact du compte de test gratuit (inscription, puis second
 * passage en caisse pour convertir), donc le premier à le rencontrer aurait été
 * nous, sur notre propre carte.
 */
const { clientUpdate, clientFindUnique, reminderUpdateMany, cancel, ensureLine, info, error } =
  vi.hoisted(() => ({
    clientUpdate: vi.fn(),
    clientFindUnique: vi.fn(),
    reminderUpdateMany: vi.fn(),
    cancel: vi.fn(),
    ensureLine: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }));

vi.mock('../../config/database', () => ({
  prisma: {
    client: { update: clientUpdate, findUnique: clientFindUnique },
    reminder: { updateMany: reminderUpdateMany },
    payment: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    analyticsDaily: { upsert: vi.fn() },
  },
}));
vi.mock('../../config/stripe', () => ({
  stripe: { subscriptions: { cancel, create: vi.fn() } },
}));
vi.mock('../../config/logger', () => ({
  logger: { info, warn: vi.fn(), error, debug: vi.fn() },
}));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../email.service', () => ({ emailService: {} }));
vi.mock('../onboarding.service', () => ({ onboardingService: {} }));
vi.mock('../voice/phone-setup.service', () => ({ phoneSetupService: { ensureLine } }));

import { stripeService } from '../stripe.service';

/** L'essai en cours, avec l'abonnement ouvert à l'inscription. */
const trialClient = {
  id: 'c1',
  businessName: 'Chez Marie',
  planType: 'starter',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_essai',
};

const upgrade = (session: Record<string, unknown>) =>
  stripeService.handleCheckoutCompleted({
    id: 'cs_1',
    customer: 'cus_1',
    metadata: { source: 'plan-upgrade', clientId: 'c1', planType: 'pro' },
    ...session,
  });

beforeEach(() => {
  vi.clearAllMocks();
  clientFindUnique.mockResolvedValue(trialClient);
  clientUpdate.mockResolvedValue({});
  reminderUpdateMany.mockResolvedValue({ count: 0 });
  cancel.mockResolvedValue({ id: 'sub_essai', status: 'canceled' });
  ensureLine.mockResolvedValue({ state: 'active', number: '+32470112233', reason: null });
});

describe('un changement d\'offre remplace l\'essai, il ne s\'ajoute pas', () => {
  it('annule l\'abonnement d\'essai que la nouvelle caisse remplace', async () => {
    await upgrade({ subscription: 'sub_paye' });

    expect(cancel).toHaveBeenCalledWith('sub_essai');
  });

  it('pointe le nouvel abonnement', async () => {
    await upgrade({ subscription: 'sub_paye' });

    expect(clientUpdate.mock.calls[0][0].data.stripeSubscriptionId).toBe('sub_paye');
  });

  /**
   * L'ordre EST le correctif, autant que l'annulation elle-même.
   *
   * `customer.subscription.deleted` retrouve le client par son
   * `stripeSubscriptionId`. Annuler avant la mise à jour ferait donc trouver ce
   * client-là, passerait son statut à `canceled` et rendrait son numéro belge
   * au stock, quelques secondes après le lui avoir attribué.
   */
  it('met la base à jour AVANT d\'annuler, sinon le numéro repart au stock', async () => {
    await upgrade({ subscription: 'sub_paye' });

    expect(clientUpdate.mock.invocationCallOrder[0]).toBeLessThan(cancel.mock.invocationCallOrder[0]);
  });

  it('n\'annule rien au rejeu du webhook', async () => {
    // Stripe rejoue: le client pointe déjà l'abonnement de la caisse.
    clientFindUnique.mockResolvedValue({ ...trialClient, stripeSubscriptionId: 'sub_paye' });

    await upgrade({ subscription: 'sub_paye' });

    expect(cancel).not.toHaveBeenCalled();
  });

  it('n\'annule rien quand le client n\'avait aucun abonnement', async () => {
    clientFindUnique.mockResolvedValue({ ...trialClient, stripeSubscriptionId: null });

    await upgrade({ subscription: 'sub_paye' });

    expect(cancel).not.toHaveBeenCalled();
  });

  it('laisse la conversion aboutir si Stripe refuse l\'annulation, en le disant', async () => {
    // Un webhook qui lève est rejoué par Stripe, et le rejeu reconvertirait un
    // client déjà converti. L'abonnement resté facturable, lui, doit être écrit.
    cancel.mockRejectedValue(new Error('No such subscription'));

    await expect(upgrade({ subscription: 'sub_paye' })).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toMatch(/à la main/i);
    // La conversion est allée jusqu'au bout: la ligne dédiée est attribuée.
    expect(ensureLine).toHaveBeenCalledWith('c1');
  });
});
