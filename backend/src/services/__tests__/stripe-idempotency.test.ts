import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Money-critical: a replayed Stripe webhook (Stripe retries deliveries) must
 * NOT process a payment twice. These tests pin the idempotency guards in
 * handleCheckoutCompleted and handleSelfOnboardingCheckout.
 */
const { paymentFindFirst, clientFindUnique, clientCreate, userFindUnique } = vi.hoisted(() => ({
  paymentFindFirst: vi.fn(),
  clientFindUnique: vi.fn(),
  clientCreate: vi.fn(),
  userFindUnique: vi.fn(),
}));

// Paths are resolved relative to THIS test file (src/services/__tests__/).
vi.mock('../../config/database', () => ({
  prisma: {
    payment: { findFirst: paymentFindFirst },
    client: { findUnique: clientFindUnique, create: clientCreate },
    user: { findUnique: userFindUnique },
  },
}));
// Stripe SDK throws when constructed without a key — stub the module.
vi.mock('../../config/stripe', () => ({ stripe: {} }));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../email.service', () => ({ emailService: {} }));
vi.mock('../onboarding.service', () => ({ onboardingService: {} }));

import { stripeService } from '../stripe.service';

beforeEach(() => {
  paymentFindFirst.mockReset().mockResolvedValue(null);
  clientFindUnique.mockReset().mockResolvedValue(null);
  clientCreate.mockReset().mockResolvedValue({ id: 'c_new' });
  userFindUnique.mockReset().mockResolvedValue(null);
});

describe('handleCheckoutCompleted — idempotency', () => {
  const session = { id: 's1', payment_intent: 'pi_1', client_reference_id: 'client_1', metadata: {} };

  it('skips processing when the payment intent was already recorded', async () => {
    paymentFindFirst.mockResolvedValue({ id: 'p_existing' });

    await stripeService.handleCheckoutCompleted(session);

    expect(paymentFindFirst).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_1' },
    });
    // Returned before touching the client lookup -> no further processing.
    expect(clientFindUnique).not.toHaveBeenCalled();
  });

  it('proceeds past the guard when the payment intent is new', async () => {
    paymentFindFirst.mockResolvedValue(null);
    clientFindUnique.mockResolvedValue({ id: 'client_1', isTrial: false });

    await stripeService.handleCheckoutCompleted(session);

    // Got past idempotency -> looked up the referenced client.
    expect(clientFindUnique).toHaveBeenCalledWith({ where: { id: 'client_1' } });
  });
});

/**
 * Le garde-fou se retournait contre le paiement qu'il devait protéger.
 *
 * Une session en mode abonnement n'a pas d'intention de paiement, elle a une
 * facture. Prisma traduit `{ stripePaymentIntentId: null }` en `IS NULL`, et
 * TOUTES nos lignes de paiement sont écrites sans intention: la requête
 * retrouvait donc la première venue et déclarait « déjà traitée » une session
 * qui ne l'était pas. Dès la première mensualité encaissée de la flotte, plus
 * une seule conversion d'essai ne passait par ce chemin, en silence.
 */
describe('handleCheckoutCompleted — une session sans intention de paiement', () => {
  it('ne prend pas une ligne de paiement quelconque pour elle-même', async () => {
    // Une ligne existe déjà en base, sans intention (cas de toutes les nôtres).
    paymentFindFirst.mockResolvedValue({ id: 'p_mensualite' });
    clientFindUnique.mockResolvedValue({ id: 'client_1', isTrial: false });

    await stripeService.handleCheckoutCompleted({
      id: 's3',
      payment_intent: null,
      client_reference_id: 'client_1',
      metadata: {},
    });

    // Le garde-fou ne s'applique pas: il n'y a rien à comparer.
    expect(paymentFindFirst).not.toHaveBeenCalled();
    // Et le traitement continue.
    expect(clientFindUnique).toHaveBeenCalledWith({ where: { id: 'client_1' } });
  });

  it('garde le garde-fou quand la session porte bien une intention', async () => {
    paymentFindFirst.mockResolvedValue({ id: 'p_existing' });

    await stripeService.handleCheckoutCompleted({
      id: 's4',
      payment_intent: 'pi_2',
      client_reference_id: 'client_1',
      metadata: {},
    });

    expect(paymentFindFirst).toHaveBeenCalledWith({ where: { stripePaymentIntentId: 'pi_2' } });
    expect(clientFindUnique).not.toHaveBeenCalled();
  });
});

describe('handleSelfOnboardingCheckout — idempotency', () => {
  it('does not re-create a Client that already exists for the user', async () => {
    clientFindUnique.mockResolvedValue({ id: 'client_existing', userId: 'u1' });

    await stripeService.handleCheckoutCompleted({
      id: 's2',
      metadata: { source: 'self-onboarding', userId: 'u1' },
    });

    expect(clientFindUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    // Returned before creating anything.
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(clientCreate).not.toHaveBeenCalled();
  });
});
