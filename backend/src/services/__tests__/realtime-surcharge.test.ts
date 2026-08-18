import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le supplément « voix temps réel », facturé à la minute.
 *
 * Trois choses peuvent mal tourner ici, et deux coûtent de l'argent à
 * quelqu'un: facturer une option que le client n'a jamais choisie, facturer
 * des minutes qui n'ont pas été passées dans ce mode, et facturer deux fois le
 * même mois. Ces tests tiennent les trois.
 *
 * Prisma et Stripe sont bouchonnés, ni réseau ni base.
 */
const { clientFindUnique, callAggregate, invoiceItemsCreate } = vi.hoisted(() => ({
  clientFindUnique: vi.fn(),
  callAggregate: vi.fn(),
  invoiceItemsCreate: vi.fn(),
}));

const envState = vi.hoisted(() => ({
  VOICE_REALTIME_SURCHARGE_EUR: 0,
  VOICE_SPEECH_TO_SPEECH: true,
  STRIPE_SECRET_KEY: 'sk_test',
}));

vi.mock('../../config/env', () => ({ env: envState }));
vi.mock('../../config/database', () => ({
  prisma: {
    client: { findUnique: clientFindUnique, update: vi.fn() },
    clientCall: { aggregate: callAggregate },
    analyticsDaily: { upsert: vi.fn() },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/stripe', () => ({
  stripe: {
    invoiceItems: { create: invoiceItemsCreate },
    checkout: { sessions: { create: vi.fn() } },
    prices: { list: vi.fn(), create: vi.fn() },
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../onboarding.service', () => ({ onboardingService: { onboardClient: vi.fn() } }));
vi.mock('../affiliate.service', () => ({ affiliateService: { attribute: vi.fn() } }));
vi.mock('../email.service', () => ({ emailService: { send: vi.fn() } }));

const { stripeService } = await import('../stripe.service');
const { useSpeechToSpeech } = await import('../voice/speech-plans');

const CLIENT = {
  id: 'cli_1',
  businessName: 'Cabinet Martin',
  planType: 'starter',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  monthlyMinutesQuota: 750,
};

/** Minutes facturables sur le mois, en secondes. */
const minutes = (n: number) => ({ _sum: { durationSeconds: n * 60 } });

beforeEach(() => {
  vi.clearAllMocks();
  envState.VOICE_REALTIME_SURCHARGE_EUR = 0;
  envState.VOICE_SPEECH_TO_SPEECH = true;
  clientFindUnique.mockResolvedValue(CLIENT);
  callAggregate.mockResolvedValue(minutes(0));
});

describe('tant que le prix n’est pas posé, l’option n’est pas vendue', () => {
  it('ne facture rien, même avec des minutes en temps réel', async () => {
    callAggregate.mockResolvedValue(minutes(300));
    await stripeService.reportOverageUsage('cli_1');
    expect(invoiceItemsCreate).not.toHaveBeenCalled();
  });

  it('laisse `auto` suivre le réglage global', () => {
    expect(useSpeechToSpeech({ voiceMode: 'auto' })).toBe(true);
  });
});

describe('dès que le prix est posé', () => {
  beforeEach(() => { envState.VOICE_REALTIME_SURCHARGE_EUR = 0.12; });

  it('`auto` cesse de résoudre en temps réel', () => {
    /* Le cœur du sujet: tous les clients existants sont en `auto`. Si `auto`
       continuait de résoudre en temps réel, ils découvriraient une option
       payante sur leur facture sans l'avoir demandée. Un supplément ne peut
       être dû que par un choix explicite. */
    expect(useSpeechToSpeech({ voiceMode: 'auto' })).toBe(false);
    expect(useSpeechToSpeech({})).toBe(false);
  });

  it('le choix explicite, lui, est respecté', () => {
    expect(useSpeechToSpeech({ voiceMode: 'realtime' })).toBe(true);
    expect(useSpeechToSpeech({ voiceMode: 'classic' })).toBe(false);
  });

  it('une voix clonée ramène au classique, donc ne se facture pas', () => {
    // Facturer le RÉGLAGE plutôt que le mode réellement utilisé
    // surfacturerait tout client ayant enregistré sa voix.
    expect(useSpeechToSpeech({ hasCustomVoice: true, voiceMode: 'realtime' })).toBe(false);
  });

  it('facture les minutes réellement passées en temps réel', async () => {
    callAggregate.mockResolvedValue(minutes(200));
    await stripeService.reportOverageUsage('cli_1');

    expect(invoiceItemsCreate).toHaveBeenCalledTimes(1);
    const [args, opts] = invoiceItemsCreate.mock.calls[0];
    expect(args).toMatchObject({ customer: 'cus_1', currency: 'eur', amount: 2400 }); // 200 x 0,12 €
    expect(opts.idempotencyKey).toMatch(/^realtime-cli_1-\d{4}-\d{2}$/);
  });

  it('ne compte que le mode `realtime`, hors spam', async () => {
    callAggregate.mockResolvedValue(minutes(10));
    await stripeService.reportOverageUsage('cli_1');

    // Deux agrégats sont émis: celui du dépassement (tous modes confondus)
    // puis celui du supplément. C'est le second qui doit filtrer sur le mode.
    const wheres = callAggregate.mock.calls.map(([a]: any[]) => a.where);
    const surcharge = wheres.find((w: any) => w.voiceMode !== undefined);
    expect(surcharge).toMatchObject({ clientId: 'cli_1', voiceMode: 'realtime', isSpam: false });
    // Et celui du dépassement ne doit PAS filtrer: toutes les minutes comptent
    // dans le quota, quel que soit le moteur.
    expect(wheres.some((w: any) => w.voiceMode === undefined)).toBe(true);
  });

  it('n’émet aucune ligne pour zéro minute', async () => {
    callAggregate.mockResolvedValue(minutes(0));
    await stripeService.reportOverageUsage('cli_1');
    expect(invoiceItemsCreate).not.toHaveBeenCalled();
  });

  it('porte une clé d’idempotence distincte de celle du dépassement', async () => {
    // Les deux lignes coexistent sur la même facture: une clé partagée en
    // ferait disparaître une.
    callAggregate.mockResolvedValue(minutes(900)); // au-delà des 750 incluses
    await stripeService.reportOverageUsage('cli_1');

    const keys = invoiceItemsCreate.mock.calls.map(([, o]: any[]) => o.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some((k: string) => k.startsWith('realtime-'))).toBe(true);
    expect(keys.some((k: string) => k.startsWith('overage-'))).toBe(true);
  });
});
