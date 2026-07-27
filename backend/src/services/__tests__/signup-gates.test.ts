import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The two gates that stand between a fresh sign-up and the dashboard: a
 * confirmed address, and a card on file. Both used to be missing entirely —
 * anyone could register with a throwaway address and land on the dashboard
 * without ever reaching Stripe.
 *
 * Prisma and Stripe are mocked; no network, no database.
 */
const {
  userFindUnique,
  userUpdate,
  clientFindUnique,
  clientUpdate,
  clientCreate,
  checkoutCreate,
  pricesList,
  analyticsUpsert,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  clientFindUnique: vi.fn(),
  clientUpdate: vi.fn(),
  clientCreate: vi.fn(),
  checkoutCreate: vi.fn(),
  pricesList: vi.fn(),
  analyticsUpsert: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate },
    client: { findUnique: clientFindUnique, update: clientUpdate, create: clientCreate },
    analyticsDaily: { upsert: analyticsUpsert },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: checkoutCreate } },
    prices: { list: pricesList, create: vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks wipes call history but keeps implementations, so every lookup
  // needs an explicit default or it leaks across tests.
  userFindUnique.mockResolvedValue(CONFIRMED_USER);
  clientFindUnique.mockResolvedValue(null);
  pricesList.mockResolvedValue({ data: [{ id: 'price_live' }] });
  checkoutCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
});

describe('sign-up checkout', () => {
  it('asks for a card even though the plan starts on a free trial', async () => {
    await stripeService.createSelfOnboardingCheckout(
      { id: 'user_1', email: 'owner@example.com' },
      'pro',
      'Chez Marie',
      'restaurant',
    );

    const args = checkoutCreate.mock.calls[0][0];
    // Stripe defaults to 'if_required' on trials, which lets a customer through
    // with no card at all. This flag is the entire point of the gate.
    expect(args.payment_method_collection).toBe('always');
    expect(args.mode).toBe('subscription');
    expect(args.subscription_data.trial_period_days).toBe(7);
    expect(args.metadata).toMatchObject({ source: 'self-onboarding', userId: 'user_1', planType: 'pro' });
  });

  it('refuses a second subscription for a customer who already pays', async () => {
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientFindUnique.mockResolvedValue({ id: 'client_1', stripeSubscriptionId: 'sub_live' });
    const res = mockRes();

    await authController.startSubscription(
      { userId: 'user_1', body: { businessName: 'Chez Marie', planType: 'pro' } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it('rejects an unknown plan rather than charging for it', async () => {
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    const res = mockRes();

    await authController.startSubscription(
      { userId: 'user_1', body: { businessName: 'Chez Marie', planType: 'free_forever' } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });
});

describe('finishing onboarding', () => {
  it('refuses to open the dashboard for a customer with no card', async () => {
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientFindUnique.mockResolvedValue({ id: 'client_1', stripeSubscriptionId: null });
    const res = mockRes();

    await authController.onboard(
      { userId: 'user_1', body: { businessName: 'Chez Marie' } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(402);
    // The flag that grants dashboard access must stay untouched.
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('refuses when no Client exists at all', async () => {
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientFindUnique.mockResolvedValue(null);
    const res = mockRes();

    await authController.onboard({ userId: 'user_1', body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('completes once the card is on file', async () => {
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientFindUnique.mockResolvedValue({
      id: 'client_1',
      stripeSubscriptionId: 'sub_live',
      planType: 'pro',
      businessName: 'Chez Marie',
      businessType: 'restaurant',
      contactPhone: null,
      transferNumber: null,
    });
    userUpdate.mockResolvedValue({ ...CONFIRMED_USER, onboardingCompleted: true });
    clientUpdate.mockResolvedValue({ id: 'client_1' });
    const res = mockRes();

    await authController.onboard(
      { userId: 'user_1', body: { businessName: 'Chez Marie', businessPhone: '+32470123456' } } as any,
      res,
    );

    expect(userUpdate.mock.calls[0][0].data.onboardingCompleted).toBe(true);
    expect(res.json.mock.calls[0][0].user).toMatchObject({ onboardingCompleted: true, hasSubscription: true });
  });
});

describe('checkout webhook', () => {
  const session = {
    id: 'cs_1',
    customer: 'cus_1',
    subscription: 'sub_1',
    metadata: {
      source: 'self-onboarding',
      userId: 'user_1',
      planType: 'pro',
      businessName: 'Chez Marie',
      industry: 'restaurant',
    },
  };

  it('opens the trial for the plan duration, not a hardcoded month', async () => {
    clientFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientCreate.mockResolvedValue({ id: 'client_1' });

    await stripeService.handleCheckoutCompleted(session);

    const data = clientCreate.mock.calls[0][0].data;
    const days = Math.round((data.trialEndDate - data.trialStartDate) / 86_400_000);
    expect(days).toBe(7);
    expect(data.subscriptionStatus).toBe('trialing');
    expect(data.country).toBe('BE');
    expect(data.stripeSubscriptionId).toBe('sub_1');
  });

  it('does not grant dashboard access — that is the onboarding step', async () => {
    clientFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(CONFIRMED_USER);
    clientCreate.mockResolvedValue({ id: 'client_1' });

    await stripeService.handleCheckoutCompleted(session);

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('stays idempotent when Stripe retries the event', async () => {
    clientFindUnique.mockResolvedValue({ id: 'client_existing' });

    await stripeService.handleCheckoutCompleted(session);

    expect(clientCreate).not.toHaveBeenCalled();
  });
});
