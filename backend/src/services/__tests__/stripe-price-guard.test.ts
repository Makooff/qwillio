import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le prix affiché et le prix prélevé sont DEUX objets sans lien.
 *
 * `config/plans.ts` décide de ce que la page annonce, un objet Price chez Stripe
 * décide de ce qui part de la carte, et `STRIPE_PRICE_<PLAN>_MONTHLY`
 * court-circuite même le tarif du code. Le 09/09, la caisse annonçait
 * « Qwillio Pro, 1297,00 € par mois » sous une page à 599 €: la variable
 * pointait un prix d'une tarification précédente.
 *
 * Un client aurait signé pour 599 et payé 1297. On refuse donc d'ouvrir la
 * caisse: une inscription bloquée se répare en une minute, un prélèvement de
 * trop se répare en remboursement, en excuse, et en confiance perdue.
 */
const { pricesRetrieve, pricesList, sessionsCreate, notify, error } = vi.hoisted(() => ({
  pricesRetrieve: vi.fn(),
  pricesList: vi.fn(),
  sessionsCreate: vi.fn(),
  notify: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    client: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    payment: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    analyticsDaily: { upsert: vi.fn() },
    reminder: { updateMany: vi.fn() },
  },
}));
vi.mock('../../config/stripe', () => ({
  stripe: {
    prices: { retrieve: pricesRetrieve, list: pricesList, create: vi.fn() },
    checkout: { sessions: { create: sessionsCreate } },
    subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error, debug: vi.fn() } }));
vi.mock('../discord.service', () => ({ discordService: { notify } }));
vi.mock('../email.service', () => ({ emailService: {} }));
vi.mock('../onboarding.service', () => ({ onboardingService: {} }));
vi.mock('../../config/env', async () => {
  const actual = await vi.importActual<Record<string, any>>('../../config/env');
  return {
    env: {
      ...actual.env,
      // La variable qui court-circuite le tarif du code, comme sur Render.
      STRIPE_PRICE_PRO_MONTHLY: 'price_legacy_1297',
      FRONTEND_URL: 'https://qwillio.com',
      STRIPE_SECRET_KEY: 'sk_test_x',
    },
  };
});

import { stripeService } from '../stripe.service';

const user = { id: 'u1', email: 'test@qwillio.com' };

beforeEach(() => {
  vi.clearAllMocks();
  sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' });
  /* Le service est un singleton et retient les prix déjà vérifiés — une fois par
     identifiant suffit, un objet Price Stripe étant immuable sur son montant.
     Sans ce nettoyage, le premier test validerait `price_legacy_1297` et tous
     les suivants sauteraient la vérification: ils passeraient au vert en ne
     testant rien. */
  (stripeService as unknown as { verifiedPrices: Set<string> }).verifiedPrices.clear();
});

/** Pro vaut 599 €/mois dans config/plans.ts. */
const PRO_JUSTE = { unit_amount: 59900, currency: 'eur', recurring: { interval: 'month' }, active: true };

describe('la caisse refuse un prix qui ne correspond pas au plan', () => {
  it('ouvre la caisse quand le prix Stripe dit bien 599 €', async () => {
    pricesRetrieve.mockResolvedValue(PRO_JUSTE);

    await stripeService.createSelfOnboardingCheckout(user, 'pro', 'Dentixa');

    expect(sessionsCreate).toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('refuse le prix hérité à 1297 € plutôt que de le prélever', async () => {
    pricesRetrieve.mockResolvedValue({ ...PRO_JUSTE, unit_amount: 129700 });

    await expect(stripeService.createSelfOnboardingCheckout(user, 'pro', 'Dentixa')).rejects.toThrow(/1297/);

    // Rien n'est ouvert: le client ne voit jamais un montant qu'on n'a pas annoncé.
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('alerte en nommant la variable à corriger', async () => {
    pricesRetrieve.mockResolvedValue({ ...PRO_JUSTE, unit_amount: 129700 });

    await expect(stripeService.createSelfOnboardingCheckout(user, 'pro', 'Dentixa')).rejects.toThrow();

    expect(notify).toHaveBeenCalled();
    expect(notify.mock.calls[0][0]).toMatch(/STRIPE_PRICE_PRO_MONTHLY/);
  });

  it('refuse une devise étrangère', async () => {
    pricesRetrieve.mockResolvedValue({ ...PRO_JUSTE, currency: 'usd' });

    await expect(stripeService.createSelfOnboardingCheckout(user, 'pro', 'Dentixa')).rejects.toThrow(/usd/);
  });

  /* Un prix ANNUEL branché sur un plan mensuel prélèverait douze mois d'un coup,
     au bon montant unitaire: seul l'intervalle trahit la faute. */
  it('refuse un prix annuel là où le plan est mensuel', async () => {
    pricesRetrieve.mockResolvedValue({ ...PRO_JUSTE, recurring: { interval: 'year' } });

    await expect(stripeService.createSelfOnboardingCheckout(user, 'pro', 'Dentixa')).rejects.toThrow(/year/);
  });

  it('ne redemande pas le même prix deux fois dans la vie du processus', async () => {
    pricesRetrieve.mockResolvedValue(PRO_JUSTE);

    await stripeService.createSelfOnboardingCheckout(user, 'pro', 'Dentixa');
    await stripeService.createSelfOnboardingCheckout(user, 'pro', 'Dentixa');

    expect(pricesRetrieve).toHaveBeenCalledTimes(1);
  });
});
