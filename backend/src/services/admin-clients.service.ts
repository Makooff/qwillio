import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { getPlan, PLANS } from '../config/plans';

/**
 * Creating a customer by hand, from the admin Clients page or from a converted
 * prospect.
 *
 * Deliberately does not require a User to exist: customers are signed up over
 * the phone long before they ever create a login. `Client.userId` is optional,
 * and `clientMiddleware` links the row to a User by `contactEmail` the first
 * time that person registers.
 */

export interface ManualClientInput {
  businessName?: unknown;
  contactEmail?: unknown;
  contactName?: unknown;
  contactPhone?: unknown;
  businessType?: unknown;
  city?: unknown;
  country?: unknown;
  planType?: unknown;
  prospectId?: unknown;
}

export type ManualClientResult =
  | { ok: true; client: any }
  | { ok: false; status: number; error: string; clientId?: string };

const str = (v: unknown) => String(v ?? '').trim();

export const adminClientsService = {
  async create(input: ManualClientInput): Promise<ManualClientResult> {
    const businessName = str(input.businessName);
    const contactEmail = str(input.contactEmail).toLowerCase();
    const planType = (str(input.planType) || 'starter').toLowerCase();

    if (!businessName || !contactEmail) {
      return { ok: false, status: 400, error: 'businessName and contactEmail are required' };
    }
    // getPlan falls back to `starter` for anything it does not recognise, so an
    // unchecked value would quietly bill a plan nobody chose.
    if (!Object.prototype.hasOwnProperty.call(PLANS, planType)) {
      return { ok: false, status: 400, error: 'unknown_plan' };
    }

    // One customer per address, whether or not a login exists yet.
    const clash = await prisma.client.findFirst({ where: { contactEmail } });
    if (clash) {
      return { ok: false, status: 409, error: 'client_exists', clientId: clash.id };
    }

    const plan = getPlan(planType);
    const user = await prisma.user.findUnique({ where: { email: contactEmail } });
    const contactName = str(input.contactName);

    const client = await prisma.client.create({
      data: {
        userId: user?.id ?? null,
        businessName,
        businessType: str(input.businessType) || 'other',
        contactName: contactName || businessName,
        contactEmail,
        contactPhone: str(input.contactPhone) || null,
        city: str(input.city) || null,
        country: (str(input.country) || 'BE').toUpperCase(),
        planType,
        setupFee: 0,
        monthlyFee: plan.monthlyPriceEur,
        currency: 'EUR',
        dashboardToken: crypto.randomBytes(32).toString('hex'),
        onboardingStatus: 'pending',
        subscriptionStatus: 'active',
        monthlyMinutesQuota: plan.includedMinutes,
        prospectId: str(input.prospectId) || null,
      },
    });

    logger.info(`[admin] client created manually: ${businessName} (${contactEmail}) — ${client.id}`);
    return { ok: true, client };
  },
};
