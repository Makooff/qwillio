import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'option Superagent vendue au FORFAIT mensuel.
 *
 * Quatre choses peuvent coûter de l'argent à quelqu'un, et ces tests tiennent
 * les quatre:
 *
 *  - prélever DEUX fois la même chose (le forfait de l'option et le supplément
 *    à la minute, sur la même facture) ;
 *  - garder la ligne d'option après un passage à un forfait qui l'INCLUT ;
 *  - accorder le droit sans qu'aucune ligne ne le facture ;
 *  - vendre à un prix que le modèle temps réel rend déficitaire.
 *
 * Prisma et Stripe sont bouchonnés, ni réseau ni base.
 */
const {
  clientFindUnique, clientFindFirst, clientUpdate, callAggregate,
  invoiceItemsCreate, subRetrieve, subUpdate, itemDel, itemUpdate,
  pricesList, pricesCreate, pricesRetrieve, applyVoiceTier,
  clientCreate, userFindUnique, sessionsCreate,
} = vi.hoisted(() => ({
  clientFindUnique: vi.fn(),
  clientFindFirst: vi.fn(),
  clientUpdate: vi.fn(),
  callAggregate: vi.fn(),
  invoiceItemsCreate: vi.fn(),
  subRetrieve: vi.fn(),
  subUpdate: vi.fn(),
  itemDel: vi.fn(),
  itemUpdate: vi.fn(),
  pricesList: vi.fn(),
  pricesCreate: vi.fn(),
  pricesRetrieve: vi.fn(),
  applyVoiceTier: vi.fn(),
  clientCreate: vi.fn(),
  userFindUnique: vi.fn(),
  sessionsCreate: vi.fn(),
}));

const envState = vi.hoisted(() => ({
  VOICE_REALTIME_SURCHARGE_EUR: 0.02,
  VOICE_REALTIME_MODEL: 'gpt-realtime-mini-2025-12-15',
  VOICE_SPEECH_TO_SPEECH: true,
  STRIPE_SECRET_KEY: 'sk_test',
  FRONTEND_URL: 'https://qwillio.com',
}));

vi.mock('../../config/env', () => ({ env: envState }));
vi.mock('../../config/database', () => ({
  prisma: {
    client: {
      findUnique: clientFindUnique, findFirst: clientFindFirst,
      update: clientUpdate, create: clientCreate,
    },
    user: { findUnique: userFindUnique, update: vi.fn() },
    clientCall: { aggregate: callAggregate },
    analyticsDaily: { upsert: vi.fn() },
    reminder: { updateMany: vi.fn() },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/stripe', () => ({
  stripe: {
    invoiceItems: { create: invoiceItemsCreate },
    checkout: { sessions: { create: sessionsCreate } },
    prices: { list: pricesList, create: pricesCreate, retrieve: pricesRetrieve },
    subscriptions: { retrieve: subRetrieve, update: subUpdate, create: vi.fn() },
    subscriptionItems: { del: itemDel, update: itemUpdate },
  },
}));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../onboarding.service', () => ({ onboardingService: { onboardClient: vi.fn() } }));
vi.mock('../affiliate.service', () => ({ affiliateService: { attribute: vi.fn() } }));
vi.mock('../email.service', () => ({ emailService: { send: vi.fn() } }));
vi.mock('../voice/apply-voice-tier', () => ({ applyVoiceTier }));

const { stripeService } = await import('../stripe.service');

const SOLO = {
  id: 'cli_1',
  businessName: 'Cabinet Martin',
  planType: 'solo',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  monthlyMinutesQuota: 250,
  superagentOption: false,
  isTrial: false,
  vapiConfig: {},
};

/** Un abonnement Stripe: la ligne de forfait, plus éventuellement celle de l'option. */
const subscription = (opts: { option?: boolean; interval?: 'month' | 'year' } = {}) => ({
  id: 'sub_1',
  status: 'active',
  items: {
    data: [
      { id: 'si_plan', price: { id: 'price_plan', lookup_key: 'qwillio_solo_monthly_eur', recurring: { interval: opts.interval ?? 'month' } } },
      ...(opts.option
        ? [{ id: 'si_option', price: { id: 'price_opt', lookup_key: 'qwillio_superagent_solo_monthly_eur', recurring: { interval: opts.interval ?? 'month' } } }]
        : []),
    ],
  },
});

const minutes = (n: number) => ({ _sum: { durationSeconds: n * 60 } });

beforeEach(() => {
  vi.clearAllMocks();
  envState.VOICE_REALTIME_SURCHARGE_EUR = 0.02;
  envState.VOICE_REALTIME_MODEL = 'gpt-realtime-mini-2025-12-15';
  clientFindUnique.mockResolvedValue(SOLO);
  callAggregate.mockResolvedValue(minutes(0));
  subRetrieve.mockResolvedValue(subscription());
  subUpdate.mockResolvedValue({});
  pricesList.mockResolvedValue({ data: [] });
  pricesCreate.mockResolvedValue({ id: 'price_new' });
  sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' });
  clientCreate.mockResolvedValue({ id: 'cli_1' });
  userFindUnique.mockResolvedValue({
    id: 'u1', email: 'a@b.com', name: 'A', businessName: 'Cabinet Martin',
    planType: 'solo', language: 'fr',
  });
  applyVoiceTier.mockResolvedValue({ written: true, synced: true, syncError: null, builtAtCallTime: false });
  /* Le service est un singleton et retient, pour la durée du processus, les
     prix déjà résolus et déjà vérifiés. C'est voulu en production (un objet
     Price Stripe est immuable sur son montant), mais sans ce nettoyage le
     premier test remplirait le cache et les suivants passeraient au vert en
     n'appelant plus Stripe du tout. Même précaution que `stripe-price-guard`. */
  const internals = stripeService as unknown as {
    verifiedPrices: Set<string>; priceIdCache: Map<string, string>;
  };
  internals.verifiedPrices.clear();
  internals.priceIdCache.clear();
});

describe('le double prélèvement', () => {
  it('ne facture PAS le supplément à la minute à un client qui paie l\'option au forfait', async () => {
    /* Le mode d'échec le plus cher de ce lot: la ligne « Voix temps réel » et
       la ligne « Superagent » côte à côte sur la même facture, sur une vraie
       carte, invisible jusqu'au relevé. */
    clientFindUnique.mockResolvedValue({ ...SOLO, superagentOption: true });
    callAggregate.mockResolvedValue(minutes(120));

    await stripeService.reportOverageUsage('cli_1');

    expect(invoiceItemsCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('temps réel') }),
      expect.anything(),
    );
  });

  it('le facture toujours à un client SANS option', async () => {
    callAggregate.mockResolvedValue(minutes(120));

    await stripeService.reportOverageUsage('cli_1');

    expect(invoiceItemsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('Voix temps réel') }),
      expect.anything(),
    );
  });
});

describe('le droit se lit sur les lignes de l\'abonnement', () => {
  it('une ligne d\'option présente ACCORDE le droit', async () => {
    clientFindFirst.mockResolvedValue({ ...SOLO, superagentOption: false });

    await stripeService.handleSubscriptionUpdated(subscription({ option: true }));

    expect(clientUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ superagentOption: true }),
    }));
    // Et le moteur suit: sans ça, le client paie sans rien entendre de différent.
    expect(applyVoiceTier).toHaveBeenCalledWith('cli_1', 'superagent');
  });

  it('une ligne d\'option ABSENTE retire le droit', async () => {
    /* La porte de sortie: option annulée, impayé, ligne retirée à la main dans
       le tableau de bord Stripe. Sans ça, le moteur tournerait pour quelqu'un
       qui ne le paie plus. */
    clientFindFirst.mockResolvedValue({
      ...SOLO, superagentOption: true, vapiConfig: { voiceTier: 'superagent' },
    });

    await stripeService.handleSubscriptionUpdated(subscription({ option: false }));

    expect(clientUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ superagentOption: false }),
    }));
    expect(applyVoiceTier).toHaveBeenCalledWith('cli_1', null);
  });

  it('n\'écrase pas un « base » choisi par le client quand l\'option part', async () => {
    clientFindFirst.mockResolvedValue({
      ...SOLO, superagentOption: true, vapiConfig: { voiceTier: 'base' },
    });

    await stripeService.handleSubscriptionUpdated(subscription({ option: false }));

    expect(applyVoiceTier).toHaveBeenCalledWith('cli_1', 'base');
  });

  it('ne touche à rien quand le droit n\'a pas bougé', async () => {
    clientFindFirst.mockResolvedValue({ ...SOLO, superagentOption: false });

    await stripeService.handleSubscriptionUpdated(subscription({ option: false }));

    expect(applyVoiceTier).not.toHaveBeenCalled();
  });

  it('un abonnement SANS ses lignes ne retire rien', async () => {
    /* Un champ absent ne vaut pas un champ vide: lire « aucune option » sur un
       objet tronqué retirerait le droit à tous ceux qui l'ont payé, en une
       seule livraison de webhook. */
    clientFindFirst.mockResolvedValue({ ...SOLO, superagentOption: true });

    await stripeService.handleSubscriptionUpdated({ id: 'sub_1', status: 'active' });

    expect(clientUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ superagentOption: expect.anything() }),
    }));
    expect(applyVoiceTier).not.toHaveBeenCalled();
  });
});

describe('vendre l\'option', () => {
  it('refuse un forfait qui l\'inclut déjà', async () => {
    const result = await stripeService.addSuperagentOption({ ...SOLO, planType: 'pro' });
    expect(result).toMatchObject({ ok: false, error: 'already_included' });
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it('refuse quand le modèle temps réel rend le prix déficitaire', async () => {
    /* Le refus porte sur la CONFIGURATION de la flotte, pas sur le client: on
       préfère une vente bloquée à un abonnement qui perd de l'argent chaque
       mois sans que rien ne le dise. */
    envState.VOICE_REALTIME_MODEL = 'gpt-realtime-2';
    const result = await stripeService.addSuperagentOption(SOLO);
    expect(result).toMatchObject({ ok: false, error: 'not_sellable' });
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it('refuse quand le tarif du modèle n\'a jamais été relevé', async () => {
    envState.VOICE_REALTIME_MODEL = 'gpt-realtime-2025-08-28';
    const result = await stripeService.addSuperagentOption(SOLO);
    expect(result).toMatchObject({ ok: false, error: 'not_sellable' });
  });

  it('ajoute une SECONDE ligne à l\'abonnement, sans toucher la première', async () => {
    const result = await stripeService.addSuperagentOption(SOLO);

    expect(result).toMatchObject({ ok: true, alreadyOn: false });
    expect(subUpdate).toHaveBeenCalledWith('sub_1', expect.objectContaining({
      items: [{ id: 'si_plan' }, { price: 'price_new', quantity: 1 }],
      proration_behavior: 'create_prorations',
    }));
  });

  it('crée le prix au montant du forfait Solo', async () => {
    await stripeService.addSuperagentOption(SOLO);
    expect(pricesCreate).toHaveBeenCalledWith(expect.objectContaining({
      unit_amount: 2000,
      currency: 'eur',
      recurring: { interval: 'month' },
      lookup_key: 'qwillio_superagent_solo_monthly_eur',
    }));
  });

  it('sur un abonnement ANNUEL, pose un prix annuel', async () => {
    /* Stripe refuse un abonnement dont les lignes n'ont pas le même
       intervalle: une ligne mensuelle ici ferait échouer l'ajout. */
    subRetrieve.mockResolvedValue(subscription({ interval: 'year' }));
    await stripeService.addSuperagentOption(SOLO);
    expect(pricesCreate).toHaveBeenCalledWith(expect.objectContaining({
      unit_amount: Math.round(20 * 12 * 0.8) * 100,
      recurring: { interval: 'year' },
      lookup_key: 'qwillio_superagent_solo_annual_eur',
    }));
  });

  it('est idempotente: une option déjà posée ne se repose pas', async () => {
    subRetrieve.mockResolvedValue(subscription({ option: true }));
    const result = await stripeService.addSuperagentOption(SOLO);
    expect(result).toMatchObject({ ok: true, alreadyOn: true });
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it('refuse un prix Stripe retrouvé qui ne porte pas le bon montant', async () => {
    /* Même règle que les forfaits (6duodecies): on ne prélève pas un montant
       que la page n'a pas annoncé, même au prix d'une vente bloquée. */
    pricesList.mockResolvedValue({ data: [{ id: 'price_vieux' }] });
    pricesRetrieve.mockResolvedValue({
      id: 'price_vieux', unit_amount: 4900, currency: 'eur', recurring: { interval: 'month' },
    });

    await expect(stripeService.addSuperagentOption(SOLO)).rejects.toThrow(/ne correspond pas/);
    expect(subUpdate).not.toHaveBeenCalled();
  });
});

describe('retirer l\'option', () => {
  it('supprime la ligne', async () => {
    subRetrieve.mockResolvedValue(subscription({ option: true }));
    const result = await stripeService.removeSuperagentOption(SOLO);
    expect(result).toEqual({ ok: true, wasOn: true });
    expect(itemDel).toHaveBeenCalledWith('si_option', { proration_behavior: 'create_prorations' });
  });

  it('ne bronche pas si elle n\'existe pas', async () => {
    const result = await stripeService.removeSuperagentOption(SOLO);
    expect(result).toEqual({ ok: true, wasOn: false });
    expect(itemDel).not.toHaveBeenCalled();
  });
});

describe('acheter l\'option À LA CAISSE, en même temps que le forfait', () => {
  const checkout = (superagent: boolean) =>
    stripeService.createSelfOnboardingCheckout(
      { id: 'u1', email: 'a@b.com' }, 'solo', 'Cabinet Martin', 'medical', 'monthly', 'fr', superagent,
    );

  it('pose une seconde ligne dans la caisse', async () => {
    await checkout(true);
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.line_items).toHaveLength(2);
    expect(args.metadata.superagent).toBe('on');
  });

  it('n\'en pose aucune quand elle n\'est pas demandée', async () => {
    await checkout(false);
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.line_items).toHaveLength(1);
    expect(args.metadata.superagent).toBe('off');
  });

  it('la métadonnée dit ce que la caisse PORTE, pas ce qui a été demandé', async () => {
    /* Le cas exact qui donnerait un moteur servi gratuitement pour toujours:
       l'option est demandée, le modèle la rend invendable, la ligne n'entre
       pas dans la caisse — et une métadonnée à « on » accorderait quand même
       le droit au webhook. */
    envState.VOICE_REALTIME_MODEL = 'gpt-realtime-2';
    await checkout(true);
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.line_items).toHaveLength(1);
    expect(args.metadata.superagent).toBe('off');
  });

  it('le webhook accorde le droit ET demande le moteur', async () => {
    clientFindUnique.mockResolvedValue(null); // aucun client pour cet utilisateur
    await stripeService.handleCheckoutCompleted({
      id: 'cs_1', customer: 'cus_1', subscription: 'sub_1',
      metadata: {
        source: 'self-onboarding', userId: 'u1', planType: 'solo',
        businessName: 'Cabinet Martin', superagent: 'on',
      },
    });
    const created = clientCreate.mock.calls[0][0].data;
    expect(created.superagentOption).toBe(true);
    /* Sans `voiceTier`, le client paierait sans rien entendre de différent:
       c'est le niveau qui décide du moteur, pas le droit. */
    expect(created.vapiConfig).toMatchObject({ voiceTier: 'superagent' });
  });

  it('sans option achetée, ni droit ni niveau', async () => {
    clientFindUnique.mockResolvedValue(null);
    await stripeService.handleCheckoutCompleted({
      id: 'cs_1', customer: 'cus_1', subscription: 'sub_1',
      metadata: {
        source: 'self-onboarding', userId: 'u1', planType: 'solo',
        businessName: 'Cabinet Martin', superagent: 'off',
      },
    });
    const created = clientCreate.mock.calls[0][0].data;
    expect(created.superagentOption).toBe(false);
    expect(created.vapiConfig).not.toHaveProperty('voiceTier');
  });
});

describe('le changement de forfait', () => {
  it('RETIRE la ligne quand le nouveau forfait inclut le Superagent', async () => {
    /* Sans ça, le client paierait 20 €/mois pour ce que son abonnement Pro lui
       donne déjà. */
    subRetrieve.mockResolvedValue(subscription({ option: true }));
    await stripeService.reconcileSuperagentOptionForPlan(SOLO, 'pro');
    expect(itemDel).toHaveBeenCalledWith('si_option', { proration_behavior: 'create_prorations' });
  });

  it('REPRICE la ligne quand le forfait change sans inclure l\'option', async () => {
    /* 20 € posés sur un Starter, c'est l'option facturée sous son coût: 750
       minutes incluses au lieu de 250. */
    subRetrieve.mockResolvedValue(subscription({ option: true }));
    pricesCreate.mockResolvedValue({ id: 'price_starter_opt' });
    await stripeService.reconcileSuperagentOptionForPlan(SOLO, 'starter');
    expect(pricesCreate).toHaveBeenCalledWith(expect.objectContaining({ unit_amount: 4000 }));
    expect(itemUpdate).toHaveBeenCalledWith('si_option', expect.objectContaining({ price: 'price_starter_opt' }));
  });

  it('ne fait rien quand il n\'y a pas d\'option', async () => {
    await stripeService.reconcileSuperagentOptionForPlan(SOLO, 'pro');
    expect(itemDel).not.toHaveBeenCalled();
    expect(itemUpdate).not.toHaveBeenCalled();
  });

  it('n\'emporte jamais le changement de forfait en cas d\'erreur Stripe', async () => {
    /* Appelée depuis un webhook et depuis un changement déjà enregistré: lever
       ici ferait rejouer le changement entier pour une ligne d'option. */
    subRetrieve.mockRejectedValue(new Error('Stripe down'));
    await expect(stripeService.reconcileSuperagentOptionForPlan(SOLO, 'pro')).resolves.toBeUndefined();
  });
});
