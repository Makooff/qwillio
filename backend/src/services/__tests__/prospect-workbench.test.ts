import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The prospection workbench: the script the founder reads, and turning a
 * prospect into a customer.
 *
 * Two bugs this pins down. The script generator used to cache on
 * `niche:language`, so the first business scripted in a niche lent its name and
 * city to every other prospect in that niche. And nothing anywhere wrote
 * `Client.prospectId`, despite the column existing since day one.
 */
const {
  prospectFindUnique,
  prospectUpdate,
  clientFindFirst,
  clientCreate,
  userFindUnique,
  generateScript,
  enrichProspect,
} = vi.hoisted(() => ({
  prospectFindUnique: vi.fn(),
  prospectUpdate: vi.fn(),
  clientFindFirst: vi.fn(),
  clientCreate: vi.fn(),
  userFindUnique: vi.fn(),
  generateScript: vi.fn(),
  enrichProspect: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    prospect: { findUnique: prospectFindUnique, update: prospectUpdate },
    client: { findFirst: clientFindFirst, create: clientCreate },
    user: { findUnique: userFindUnique },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../ai-script-generator.service', () => ({
  aiScriptGeneratorService: { generateScript },
}));
vi.mock('../prospect-enrichment.service', () => ({
  prospectEnrichmentService: { enrichProspect },
}));

import { prospectWorkbenchService } from '../prospect-workbench.service';

const SCRIPT = {
  intro: 'Bonjour', painPoint: 'p', pitch: 'q', cta: 'r',
  objectionHandlers: {}, rawFull: 'full',
};

const PROSPECT = {
  id: 'p1',
  businessName: 'Fiduciaire Dupont',
  businessType: 'financial',
  niche: 'financial',
  city: 'Namur',
  country: 'BE',
  phone: '+32470123456',
  email: null,
  website: 'https://dupont.be',
  contactName: null,
  googleRating: 4.6,
  googleReviewsCount: 42,
  status: 'new',
  callAttempts: 0,
  enrichedData: { scraped: true },
  salesScript: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prospectFindUnique.mockResolvedValue(PROSPECT);
  prospectUpdate.mockResolvedValue({ ...PROSPECT });
  clientFindFirst.mockResolvedValue(null);
  userFindUnique.mockResolvedValue(null);
  clientCreate.mockResolvedValue({ id: 'client_1' });
  generateScript.mockResolvedValue(SCRIPT);
  enrichProspect.mockResolvedValue(undefined);
});

describe('sales script', () => {
  it('is written for the business in front of you, not for the niche', async () => {
    await prospectWorkbenchService.script('p1');

    const ctx = generateScript.mock.calls[0][0];
    expect(ctx.businessName).toBe('Fiduciaire Dupont');
    expect(ctx.city).toBe('Namur');
    expect(ctx.rating).toBe(4.6);
    expect(ctx.reviewCount).toBe(42);
  });

  it('speaks French to a Belgian prospect', async () => {
    await prospectWorkbenchService.script('p1');

    const ctx = generateScript.mock.calls[0][0];
    expect(ctx.language).toBe('fr');
    expect(ctx.agentName).toBe('Marie');
  });

  it('is kept, so re-reading it before the call is free', async () => {
    prospectFindUnique.mockResolvedValue({ ...PROSPECT, salesScript: SCRIPT });

    const result = await prospectWorkbenchService.script('p1');

    expect(result).toMatchObject({ cached: true });
    expect(generateScript).not.toHaveBeenCalled();
  });

  it('regenerates on explicit refresh', async () => {
    prospectFindUnique.mockResolvedValue({ ...PROSPECT, salesScript: SCRIPT });

    const result = await prospectWorkbenchService.script('p1', true);

    expect(result).toMatchObject({ cached: false });
    expect(generateScript).toHaveBeenCalledOnce();
  });

  it('persists the script on the prospect', async () => {
    await prospectWorkbenchService.script('p1');

    const data = prospectUpdate.mock.calls[0][0].data;
    expect(data.salesScript).toEqual(SCRIPT);
    expect(data.salesScriptAt).toBeInstanceOf(Date);
  });

  it('still produces a script when the website cannot be reached', async () => {
    prospectFindUnique.mockResolvedValue({ ...PROSPECT, enrichedData: null });
    enrichProspect.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await prospectWorkbenchService.script('p1');

    expect(result?.script).toEqual(SCRIPT);
  });
});

describe('marking a business as called', () => {
  it('moves a new prospect to contacted and counts the attempt', async () => {
    await prospectWorkbenchService.markContacted('p1');

    const data = prospectUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('contacted');
    expect(data.callAttempts).toEqual({ increment: 1 });
  });

  it('never walks a converted customer backwards', async () => {
    prospectFindUnique.mockResolvedValue({ ...PROSPECT, status: 'converted' });

    await prospectWorkbenchService.markContacted('p1');

    expect(prospectUpdate.mock.calls[0][0].data.status).toBe('converted');
  });
});

describe('converting a prospect', () => {
  it('creates the customer and links it back to the lead', async () => {
    const result = await prospectWorkbenchService.convert('p1', {
      contactEmail: 'contact@dupont.be',
      planType: 'pro',
    });

    expect(result.ok).toBe(true);
    const data = clientCreate.mock.calls[0][0].data;
    expect(data.prospectId).toBe('p1');
    expect(data.businessName).toBe('Fiduciaire Dupont');
    expect(data.contactPhone).toBe('+32470123456');
    expect(data.monthlyFee).toBe(599);
  });

  it('marks the prospect converted and stops calling it', async () => {
    await prospectWorkbenchService.convert('p1', { contactEmail: 'contact@dupont.be' });

    const data = prospectUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('converted');
    expect(data.eligibleForCall).toBe(false);
  });

  it('asks for an address, since scraping never collects one', async () => {
    const result = await prospectWorkbenchService.convert('p1', {});

    expect(result).toMatchObject({ ok: false, status: 400, error: 'contact_email_required' });
    expect(clientCreate).not.toHaveBeenCalled();
  });

  it('uses the prospect address when one was already known', async () => {
    prospectFindUnique.mockResolvedValue({ ...PROSPECT, email: 'hello@dupont.be' });

    await prospectWorkbenchService.convert('p1', {});

    expect(clientCreate.mock.calls[0][0].data.contactEmail).toBe('hello@dupont.be');
  });

  it('refuses to convert the same prospect twice', async () => {
    prospectFindUnique.mockResolvedValue({ ...PROSPECT, status: 'converted' });
    clientFindFirst.mockResolvedValue({ id: 'client_existing' });

    const result = await prospectWorkbenchService.convert('p1', { contactEmail: 'a@b.c' });

    expect(result).toMatchObject({ ok: false, status: 409, error: 'already_converted' });
    expect(clientCreate).not.toHaveBeenCalled();
  });

  it('reports a missing prospect rather than inventing a customer', async () => {
    prospectFindUnique.mockResolvedValue(null);

    const result = await prospectWorkbenchService.convert('nope', { contactEmail: 'a@b.c' });

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(clientCreate).not.toHaveBeenCalled();
  });
});
