import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Un client mensuel n'avait AUCUN chemin vers l'annuel.
 *
 * `createUpgradeCheckout` lisait la période sur la fiche client et n'acceptait
 * rien d'autre: la remise de 20 % était vendue sur la page tarifs et
 * inatteignable depuis le portail. Et « déjà sur ce forfait » refusait Solo
 * mensuel → Solo annuel, qui est précisément le geste à faire pour l'obtenir.
 */
const { pricesList, pricesRetrieve, pricesCreate, sessionsCreate, subsRetrieve } = vi.hoisted(() => ({
  pricesList: vi.fn(),
  pricesRetrieve: vi.fn(),
  pricesCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  subsRetrieve: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    client: { findUnique: vi.fn(), update: vi.fn() },
    payment: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock('../../config/stripe', () => ({
  stripe: {
    prices: { list: pricesList, retrieve: pricesRetrieve, create: pricesCreate },
    checkout: { sessions: { create: sessionsCreate } },
    subscriptions: { retrieve: subsRetrieve, update: vi.fn(), create: vi.fn(), cancel: vi.fn() },
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../email.service', () => ({ emailService: {} }));
vi.mock('../onboarding.service', () => ({ onboardingService: {} }));

import { stripeService } from '../stripe.service';

/** Un client en essai: pas d'abonnement actif, donc le chemin passe par la caisse. */
const trialClient = (billingPeriod?: string) => ({
  id: 'c1',
  businessName: 'Dentixa',
  planType: 'solo',
  isTrial: true,
  stripeSubscriptionId: null,
  stripeCustomerId: 'cus_1',
  vapiConfig: billingPeriod ? { billingPeriod } : {},
});

beforeEach(() => {
  vi.clearAllMocks();
  // Aucun prix existant: le service en crée un, au montant de config/plans.ts.
  pricesList.mockResolvedValue({ data: [] });
  sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' });
  pricesCreate.mockResolvedValue({ id: 'price_new' });
  (stripeService as unknown as { priceIdCache: Map<string, string> }).priceIdCache.clear();
});

/** Le prix créé porte le montant et l'intervalle: c'est lui qui dit quelle période a servi. */
const created = () => pricesCreate.mock.calls[0][0];

describe("la période demandée à l'upgrade", () => {
  it('suit le choix explicite du client, contre ce que porte sa fiche', async () => {
    await stripeService.createUpgradeCheckout(trialClient('monthly'), 'pro', 'annual');

    // 599 × 12 × 0,8 = 5 750 €, en une fois.
    expect(created().unit_amount).toBe(575000);
    expect(created().recurring.interval).toBe('year');
  });

  it("garde la période de la fiche quand aucun choix n'est envoyé", async () => {
    // Un client annuel qui change de forfait sans rien demander RESTE annuel:
    // le faire basculer en mensuel lui retirerait sa remise en silence.
    await stripeService.createUpgradeCheckout(trialClient('annual'), 'pro');

    expect(created().recurring.interval).toBe('year');
  });

  it('retombe sur le mensuel quand la fiche ne dit rien', async () => {
    await stripeService.createUpgradeCheckout(trialClient(), 'pro');

    expect(created().unit_amount).toBe(59900);
    expect(created().recurring.interval).toBe('month');
  });
});
