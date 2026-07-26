import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The money-critical half of the referral programme: attribution can never be
 * stolen, and a retried Stripe webhook can never pay a commission twice.
 * Prisma is mocked — no database is touched.
 */
const {
  affiliateFindUnique,
  affiliateCreate,
  referralFindUnique,
  referralCreate,
  commissionFindUnique,
  commissionCreate,
} = vi.hoisted(() => ({
  affiliateFindUnique: vi.fn(),
  affiliateCreate: vi.fn(),
  referralFindUnique: vi.fn(),
  referralCreate: vi.fn(),
  commissionFindUnique: vi.fn(),
  commissionCreate: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    affiliate: { findUnique: affiliateFindUnique, create: affiliateCreate },
    referral: { findUnique: referralFindUnique, create: referralCreate },
    affiliateCommission: { findUnique: commissionFindUnique, create: commissionCreate, findMany: vi.fn() },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { affiliateService } from '../affiliate.service';

const ACTIVE_AFFILIATE = { id: 'aff_1', code: 'ABCD2345', status: 'active', commissionPct: 0.3 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('attribution', () => {
  it('links a new customer to the affiliate behind the code', async () => {
    affiliateFindUnique.mockResolvedValue(ACTIVE_AFFILIATE);
    referralFindUnique.mockResolvedValue(null);
    referralCreate.mockResolvedValue({ id: 'ref_1' });

    await affiliateService.attribute('client_1', 'abcd2345');

    // Codes are matched case-insensitively.
    expect(affiliateFindUnique).toHaveBeenCalledWith({ where: { code: 'ABCD2345' } });
    expect(referralCreate).toHaveBeenCalledWith({
      data: { affiliateId: 'aff_1', clientId: 'client_1' },
    });
  });

  it('refuses to re-attribute a customer who already has a referrer', async () => {
    affiliateFindUnique.mockResolvedValue({ ...ACTIVE_AFFILIATE, id: 'aff_2', code: 'LATER999' });
    referralFindUnique.mockResolvedValue({ id: 'ref_existing', affiliateId: 'aff_1' });

    const result = await affiliateService.attribute('client_1', 'LATER999');

    expect(referralCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'ref_existing', affiliateId: 'aff_1' });
  });

  it('ignores an unknown code instead of failing the sign-up', async () => {
    affiliateFindUnique.mockResolvedValue(null);

    await expect(affiliateService.attribute('client_1', 'NOPE1234')).resolves.toBeNull();
    expect(referralCreate).not.toHaveBeenCalled();
  });

  it('ignores a suspended affiliate', async () => {
    affiliateFindUnique.mockResolvedValue({ ...ACTIVE_AFFILIATE, status: 'suspended' });

    await expect(affiliateService.attribute('client_1', 'ABCD2345')).resolves.toBeNull();
    expect(referralCreate).not.toHaveBeenCalled();
  });

  it('does nothing when no code was carried', async () => {
    await expect(affiliateService.attribute('client_1', null)).resolves.toBeNull();
    expect(affiliateFindUnique).not.toHaveBeenCalled();
  });
});

describe('commission recording', () => {
  it('credits the affiliate rate on the invoice amount', async () => {
    referralFindUnique.mockResolvedValue({ affiliateId: 'aff_1', affiliate: ACTIVE_AFFILIATE });
    commissionFindUnique.mockResolvedValue(null);
    commissionCreate.mockResolvedValue({ id: 'com_1' });

    await affiliateService.recordCommission('client_1', 'in_123', 249);

    expect(commissionCreate).toHaveBeenCalledWith({
      data: {
        affiliateId: 'aff_1',
        clientId: 'client_1',
        stripeInvoiceId: 'in_123',
        invoiceAmountEur: 249,
        amountEur: 74.7,
      },
    });
  });

  it('does not credit the same invoice twice when the webhook retries', async () => {
    referralFindUnique.mockResolvedValue({ affiliateId: 'aff_1', affiliate: ACTIVE_AFFILIATE });
    commissionFindUnique.mockResolvedValue({ id: 'com_existing' });

    const result = await affiliateService.recordCommission('client_1', 'in_123', 249);

    expect(commissionCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'com_existing' });
  });

  it('pays nothing on a customer who was never referred', async () => {
    referralFindUnique.mockResolvedValue(null);

    await expect(affiliateService.recordCommission('client_1', 'in_123', 249)).resolves.toBeNull();
    expect(commissionCreate).not.toHaveBeenCalled();
  });

  it('ignores a zero or refunded invoice', async () => {
    await expect(affiliateService.recordCommission('client_1', 'in_123', 0)).resolves.toBeNull();
    expect(referralFindUnique).not.toHaveBeenCalled();
  });

  it('rounds to the cent rather than carrying float noise', async () => {
    referralFindUnique.mockResolvedValue({ affiliateId: 'aff_1', affiliate: ACTIVE_AFFILIATE });
    commissionFindUnique.mockResolvedValue(null);
    commissionCreate.mockResolvedValue({ id: 'com_2' });

    await affiliateService.recordCommission('client_1', 'in_456', 99.99);

    // 99.99 * 0.3 = 29.996999999999996 in binary floating point.
    expect(commissionCreate.mock.calls[0][0].data.amountEur).toBe(30);
  });

  it('never throws out of the payment webhook when the database fails', async () => {
    referralFindUnique.mockRejectedValue(new Error('connection lost'));

    await expect(affiliateService.recordCommission('client_1', 'in_789', 249)).resolves.toBeNull();
  });
});
