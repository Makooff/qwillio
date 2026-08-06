import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La facturation annuelle.
 *
 * La page tarifs vendait « 20 % en annuel » avec un sélecteur qui calculait le
 * prix côté navigateur, alors qu'aucun prix annuel n'existait chez Stripe:
 * choisir l'annuel abonnait au mois, au tarif plein. Ces tests tiennent les
 * deux bouts, le montant et la période.
 *
 * Prisma et Stripe sont bouchonnés, ni réseau ni base.
 */
const { checkoutCreate, pricesList, pricesCreate, userFindUnique, clientFindUnique, subsRetrieve, subsUpdate, clientUpdate } =
  vi.hoisted(() => ({
    checkoutCreate: vi.fn(),
    pricesList: vi.fn(),
    pricesCreate: vi.fn(),
    userFindUnique: vi.fn(),
    clientFindUnique: vi.fn(),
    subsRetrieve: vi.fn(),
    subsUpdate: vi.fn(),
    clientUpdate: vi.fn(),
  }));

vi.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: vi.fn() },
    client: { findUnique: clientFindUnique, update: clientUpdate, create: vi.fn() },
    analyticsDaily: { upsert: vi.fn() },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: checkoutCreate } },
    prices: { list: pricesList, create: pricesCreate },
    subscriptions: { retrieve: subsRetrieve, update: subsUpdate, create: vi.fn() },
  },
}));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../onboarding.service', () => ({ onboardingService: { onboardClient: vi.fn() } }));
vi.mock('../affiliate.service', () => ({ affiliateService: { attribute: vi.fn() } }));
vi.mock('../email.service', () => ({ emailService: { send: vi.fn() } }));

import { stripeService } from '../stripe.service';
import { PLANS, annualPriceEur } from '../../config/plans';

const USER = { id: 'user_1', email: 'owner@example.com' };

beforeEach(() => {
  vi.clearAllMocks();
  // Aucun prix existant: le service doit en créer un.
  pricesList.mockResolvedValue({ data: [] });
  pricesCreate.mockImplementation(async (args: any) => ({ id: `price_${args.recurring.interval}` }));
  checkoutCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
});

describe('le prix annoncé', () => {
  it('vaut douze mois remisés de 20 %, à l\'euro près', () => {
    // Pro: 599 x 12 = 7188, moins 20 % = 5750,4 -> 5750.
    expect(annualPriceEur(PLANS.pro)).toBe(5750);
    expect(annualPriceEur(PLANS.solo)).toBe(950);
  });

  it('reste strictement sous douze mensualités, pour chaque forfait', () => {
    for (const plan of Object.values(PLANS)) {
      expect(annualPriceEur(plan)).toBeLessThan(plan.monthlyPriceEur * 12);
    }
  });
});

describe('la souscription', () => {
  it('crée un prix ANNUEL chez Stripe quand le client choisit l\'annuel', async () => {
    await stripeService.createSelfOnboardingCheckout(USER, 'pro', 'Chez Marie', 'restaurant', 'annual');

    const created = pricesCreate.mock.calls[0][0];
    expect(created.recurring.interval).toBe('year');
    expect(created.unit_amount).toBe(annualPriceEur(PLANS.pro) * 100);
    expect(created.lookup_key).toBe('qwillio_pro_annual_eur');
  });

  it('reste au mois quand rien n\'est demandé', async () => {
    await stripeService.createSelfOnboardingCheckout(USER, 'pro', 'Chez Marie', 'restaurant');

    expect(pricesCreate.mock.calls[0][0].recurring.interval).toBe('month');
  });

  it('inscrit la période dans la session, sinon Qwillio ne saurait plus la retrouver', async () => {
    await stripeService.createSelfOnboardingCheckout(USER, 'starter', 'Chez Marie', null, 'annual');

    const args = checkoutCreate.mock.calls[0][0];
    expect(args.metadata.billingPeriod).toBe('annual');
    expect(args.subscription_data.metadata.billingPeriod).toBe('annual');
  });

  it('ouvre l\'essai de 7 jours en annuel comme en mensuel', async () => {
    await stripeService.createSelfOnboardingCheckout(USER, 'pro', 'Chez Marie', null, 'annual');

    expect(checkoutCreate.mock.calls[0][0].subscription_data.trial_period_days).toBe(7);
  });
});

/* Le service met en cache un identifiant de prix par forfait et par période
   (un appel Stripe par démarrage, c'est voulu). Ces deux tests visent donc des
   forfaits qu'aucun test précédent n'a résolus, sinon rien n'est créé et il n'y
   a rien à observer. */
describe('le changement de forfait', () => {
  it('garde un client annuel en annuel', async () => {
    // Un abonné actif change de forfait: la mise à jour se fait en direct.
    subsRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
    subsUpdate.mockResolvedValue({});
    clientUpdate.mockResolvedValue({});

    await stripeService.createUpgradeCheckout(
      {
        id: 'client_1',
        businessName: 'Chez Marie',
        planType: 'starter',
        isTrial: false,
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_1',
        vapiConfig: { billingPeriod: 'annual' },
      },
      'enterprise',
    );

    expect(pricesCreate.mock.calls[0][0].recurring.interval).toBe('year');
  });

  it('laisse un client mensuel en mensuel', async () => {
    subsRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });
    subsUpdate.mockResolvedValue({});
    clientUpdate.mockResolvedValue({});

    await stripeService.createUpgradeCheckout(
      {
        id: 'client_1',
        businessName: 'Chez Marie',
        planType: 'starter',
        isTrial: false,
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_1',
        vapiConfig: {},
      },
      'solo',
    );

    expect(pricesCreate.mock.calls[0][0].recurring.interval).toBe('month');
  });
});
