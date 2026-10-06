import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A4/A5 côté serveur — le checkout self-onboarding doit porter le PAYS réel
 * (choix explicite BE/FR du formulaire) jusqu'à la métadonnée de session, et
 * le webhook doit créer le Client avec CE pays, pas un « BE » écrit au pinceau.
 * Conformité du contrat :
 *   - pays absent (anciens clients/front)  → repli EXPLICITE sur 'BE'
 *   - pays présent mais invalide           → 400, la caisse ne s'ouvre pas
 *   - pays valide                          → métadonnée, puis Client.country
 * La langue du site ne devine JAMAIS le pays.
 */
const {
  userFindUnique,
  userUpdate,
  clientFindUnique,
  clientCreate,
  checkoutCreate,
  pricesList,
  pricesRetrieve,
  analyticsUpsert,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  clientFindUnique: vi.fn(),
  clientCreate: vi.fn(),
  checkoutCreate: vi.fn(),
  pricesList: vi.fn(),
  pricesRetrieve: vi.fn(),
  analyticsUpsert: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate },
    client: { findUnique: clientFindUnique, create: clientCreate },
    analyticsDaily: { upsert: analyticsUpsert },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: checkoutCreate } },
    prices: { list: pricesList, retrieve: pricesRetrieve, create: vi.fn() },
  },
}));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../onboarding.service', () => ({
  onboardingService: { onboardClient: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../affiliate.service', () => ({
  affiliateService: { attribute: vi.fn().mockResolvedValue(null) },
}));

import { stripeService } from '../stripe.service';
import { authController } from '../../controllers/auth.controller';

const CONFIRMED_USER = {
  id: 'user_1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'client',
  emailConfirmed: true,
  language: null,
  businessName: null,
  businessPhone: null,
  industry: null,
  website: null,
};

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function checkoutBody(extra: Record<string, unknown> = {}) {
  return {
    userId: 'user_1',
    body: { businessName: 'Chez Marie', planType: 'pro', ...extra },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue(CONFIRMED_USER);
  clientFindUnique.mockResolvedValue(null);
  pricesList.mockResolvedValue({ data: [{ id: 'price_live' }] });
  pricesRetrieve.mockResolvedValue({
    unit_amount: 59900,
    currency: 'eur',
    recurring: { interval: 'month' },
    active: true,
  });
  checkoutCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
});

describe('pays au checkout self-onboarding (A5)', () => {
  it('porte le pays choisi (FR) dans la métadonnée de la session Stripe', async () => {
    const res = mockRes();
    await authController.startSubscription(checkoutBody({ country: 'FR' }), res);

    expect(res.json).toHaveBeenCalledWith({ checkoutUrl: expect.any(String) });
    expect(checkoutCreate.mock.calls[0][0].metadata).toMatchObject({ country: 'FR' });
  });

  it('normalise la casse (« fr » → FR) sans ouvrir la caisse à un pays inconnu', async () => {
    const res = mockRes();
    await authController.startSubscription(checkoutBody({ country: 'fr' }), res);

    expect(checkoutCreate.mock.calls[0][0].metadata.country).toBe('FR');
  });

  it('renvoie 400 et n\'ouvre pas de caisse sur un pays invalide', async () => {
    const res = mockRes();
    await authController.startSubscription(checkoutBody({ country: 'DE' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it('renvoie 400 sur un type de pays absurde', async () => {
    const res = mockRes();
    await authController.startSubscription(checkoutBody({ country: { nested: true } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it('replie EXPLICITEMENT sur BE quand le pays est absent (sessions anciennes)', async () => {
    const res = mockRes();
    await authController.startSubscription(checkoutBody(), res);

    expect(res.json).toHaveBeenCalled();
    expect(checkoutCreate.mock.calls[0][0].metadata.country).toBe('BE');
  });

  it('n\'utilise pas la langue du site pour deviner le pays', async () => {
    const res = mockRes();
    await authController.startSubscription(checkoutBody({ language: 'en' }), res);

    /* Pas de country fourni → BE par repli explicite, pas « la langue est en
       donc pays = ??? ». La métadonnée reste déterministe. */
    expect(checkoutCreate.mock.calls[0][0].metadata.country).toBe('BE');
  });
});

describe('pays à la création du Client par le webhook (A5)', () => {
  function sessionWith(metadata: Record<string, string>) {
    return {
      id: 'cs_1',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: {
        source: 'self-onboarding',
        userId: 'user_1',
        planType: 'pro',
        businessName: 'Chez Marie',
        industry: 'restaurant',
        ...metadata,
      },
    };
  }

  it('crée le Client avec le pays porté par la session (FR)', async () => {
    clientFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientCreate.mockResolvedValue({ id: 'client_1' });

    await stripeService.handleCheckoutCompleted(sessionWith({ country: 'FR' }));

    expect(clientCreate.mock.calls[0][0].data.country).toBe('FR');
  });

  it('utilise le pays réel pour la présomption de langue à la naissance', async () => {
    clientFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientCreate.mockResolvedValue({ id: 'client_1' });

    /* Ni langue du site ni langue utilisateur: seul le pays parle. Un client
       FR sans autre signal doit naître en français — et surtout COUNTRY=FR. */
    await stripeService.handleCheckoutCompleted(sessionWith({ country: 'FR' }));

    const data = clientCreate.mock.calls[0][0].data;
    expect(data.country).toBe('FR');
    expect(data.agentLanguage).toBe('fr');
  });

  it('replie sur BE quand la session est plus ancienne que le champ pays', async () => {
    clientFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientCreate.mockResolvedValue({ id: 'client_1' });

    await stripeService.handleCheckoutCompleted(sessionWith({}));

    expect(clientCreate.mock.calls[0][0].data.country).toBe('BE');
  });

  it('sanitise une métadonnée pays corrompue côté webhook (jamais propagée en l\'état)', async () => {
    clientFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientCreate.mockResolvedValue({ id: 'client_1' });

    await stripeService.handleCheckoutCompleted(sessionWith({ country: 'XX' }));

    expect(clientCreate.mock.calls[0][0].data.country).toBe('BE');
  });
});

describe('contrat du forfait au checkout (A4, côté serveur)', () => {
  it.each(['solo', 'starter', 'pro', 'enterprise'])(
    'accepte le forfait vendu « %s » et le porte en métadonnée',
    async (planType) => {
      const res = mockRes();
      await authController.startSubscription(checkoutBody({ planType }), res);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(checkoutCreate.mock.calls[0][0].metadata.planType).toBe(planType);
    },
  );

  it('conserve le forfait choisi sur la fiche utilisateur avant la caisse', async () => {
    const res = mockRes();
    await authController.startSubscription(checkoutBody({ planType: 'enterprise' }), res);

    expect(userUpdate.mock.calls[0][0].data.planType).toBe('enterprise');
  });
});
