import { prisma } from '../config/database';
import { logger } from '../config/logger';

/*
 * Referral programme.
 *
 * Two rules keep the money side honest:
 *  - attribution is decided once, at customer sign-up (Referral.clientId is
 *    unique), so a link shared later can never claim an existing customer;
 *  - commissions are recorded per paid Stripe invoice, keyed on the invoice id,
 *    so a retried webhook cannot credit the same invoice twice.
 *
 * Nothing here moves money. Rows are recorded as 'pending' and payouts stay a
 * manual, human decision.
 */

// No I/O/0/1 — codes get read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export const affiliateService = {
  /** Allocates a code that is not already taken. */
  async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = randomCode();
      const clash = await prisma.affiliate.findUnique({ where: { code } });
      if (!clash) return code;
    }
    // 32^8 keys: twelve clashes means something is wrong, so fail loudly rather
    // than hand out a duplicate.
    throw new Error('Could not allocate a free affiliate code');
  },

  /** Creates the affiliate record for an existing user, or returns the current one. */
  async enroll(userId: string, payoutEmail?: string) {
    const existing = await prisma.affiliate.findUnique({ where: { userId } });
    if (existing) return existing;

    const code = await this.generateCode();
    const affiliate = await prisma.affiliate.create({
      data: { userId, code, payoutEmail: payoutEmail || null },
    });
    logger.info(`[affiliate] enrolled user ${userId} with code ${code}`);
    return affiliate;
  },

  async findByCode(code: string) {
    if (!code) return null;
    return prisma.affiliate.findUnique({ where: { code: code.trim().toUpperCase() } });
  },

  /**
   * Links a freshly created customer to the affiliate behind `code`.
   * Silently does nothing when the code is unknown, the affiliate is inactive,
   * or the customer is already attributed — a bad code must never block a
   * customer from signing up.
   */
  async attribute(clientId: string, code?: string | null) {
    if (!code) return null;
    try {
      const affiliate = await this.findByCode(code);
      if (!affiliate || affiliate.status !== 'active') return null;

      const already = await prisma.referral.findUnique({ where: { clientId } });
      if (already) return already;

      const referral = await prisma.referral.create({
        data: { affiliateId: affiliate.id, clientId },
      });
      logger.info(`[affiliate] client ${clientId} attributed to ${affiliate.code}`);
      return referral;
    } catch (error) {
      // Attribution is a side effect of sign-up; never fail the sign-up for it.
      logger.error('[affiliate] attribution failed', error);
      return null;
    }
  },

  /**
   * Records the commission owed on a paid invoice. Called from the Stripe
   * webhook once the payment itself has been stored.
   */
  async recordCommission(clientId: string, stripeInvoiceId: string, invoiceAmountEur: number) {
    if (!stripeInvoiceId || invoiceAmountEur <= 0) return null;
    try {
      const referral = await prisma.referral.findUnique({
        where: { clientId },
        include: { affiliate: true },
      });
      if (!referral || referral.affiliate.status !== 'active') return null;

      const already = await prisma.affiliateCommission.findUnique({ where: { stripeInvoiceId } });
      if (already) {
        logger.info(`[affiliate] invoice ${stripeInvoiceId} already credited — skipping`);
        return already;
      }

      const amount = Number((invoiceAmountEur * referral.affiliate.commissionPct).toFixed(2));
      const commission = await prisma.affiliateCommission.create({
        data: {
          affiliateId: referral.affiliateId,
          clientId,
          stripeInvoiceId,
          invoiceAmountEur,
          amountEur: amount,
        },
      });
      logger.info(`[affiliate] ${referral.affiliate.code} earned ${amount}€ on invoice ${stripeInvoiceId}`);
      return commission;
    } catch (error) {
      // Never let commission bookkeeping break payment processing.
      logger.error('[affiliate] commission recording failed', error);
      return null;
    }
  },

  /** Everything the affiliate dashboard shows. */
  async summary(userId: string) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { userId },
      include: {
        referrals: {
          orderBy: { createdAt: 'desc' },
          include: {
            client: {
              select: { id: true, businessName: true, planType: true, subscriptionStatus: true, createdAt: true },
            },
          },
        },
      },
    });
    if (!affiliate) return null;

    const commissions = await prisma.affiliateCommission.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const sum = (rows: typeof commissions) =>
      Number(rows.reduce((total, row) => total + Number(row.amountEur), 0).toFixed(2));

    return {
      code: affiliate.code,
      commissionPct: affiliate.commissionPct,
      status: affiliate.status,
      payoutEmail: affiliate.payoutEmail,
      totals: {
        referrals: affiliate.referrals.length,
        pendingEur: sum(commissions.filter((c) => c.status === 'pending')),
        paidEur: sum(commissions.filter((c) => c.status === 'paid')),
        lifetimeEur: sum(commissions),
      },
      referrals: affiliate.referrals.map((r) => ({
        clientId: r.clientId,
        businessName: r.client.businessName,
        planType: r.client.planType,
        subscriptionStatus: r.client.subscriptionStatus,
        since: r.createdAt,
      })),
      commissions: commissions.map((c) => ({
        id: c.id,
        amountEur: Number(c.amountEur),
        invoiceAmountEur: Number(c.invoiceAmountEur),
        status: c.status,
        createdAt: c.createdAt,
        paidAt: c.paidAt,
      })),
    };
  },
};
