import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Creating a customer by hand.
 *
 * The founder signs people up over the phone, so a Client must be creatable
 * before the customer has ever registered a login. The two pre-existing admin
 * endpoints both 404 without a User row, which is why the "Nouveau client"
 * button had nothing to call.
 */
const { userFindUnique, clientFindFirst, clientCreate } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  clientFindFirst: vi.fn(),
  clientCreate: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    client: { findFirst: clientFindFirst, create: clientCreate },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { adminClientsService } from '../admin-clients.service';

beforeEach(() => {
  vi.clearAllMocks();
  clientFindFirst.mockResolvedValue(null);
  userFindUnique.mockResolvedValue(null);
  clientCreate.mockResolvedValue({ id: 'client_1' });
});

describe('manual client creation', () => {
  it('creates a customer who has no login yet', async () => {
    const result = await adminClientsService.create({
      businessName: 'Fiduciaire Dupont',
      contactEmail: 'contact@dupont.be',
      planType: 'pro',
    });

    expect(result.ok).toBe(true);
    const data = clientCreate.mock.calls[0][0].data;
    // The whole point: no User row, and the Client is still created.
    expect(data.userId).toBeNull();
    expect(data.monthlyFee).toBe(599);
    expect(data.monthlyMinutesQuota).toBe(2000);
    expect(data.dashboardToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('links the Client to an existing login when one is found', async () => {
    userFindUnique.mockResolvedValue({ id: 'user_9' });

    await adminClientsService.create({ businessName: 'Chez Marie', contactEmail: 'marie@chez.be' });

    expect(clientCreate.mock.calls[0][0].data.userId).toBe('user_9');
  });

  it('falls back to the business name when no contact name is given', async () => {
    await adminClientsService.create({ businessName: 'Chez Marie', contactEmail: 'marie@chez.be' });

    // contactName is NOT NULL in the schema, so an empty form field would throw.
    expect(clientCreate.mock.calls[0][0].data.contactName).toBe('Chez Marie');
  });

  it('lowercases the address so the same customer cannot be added twice', async () => {
    await adminClientsService.create({ businessName: 'X', contactEmail: '  Contact@Dupont.BE ' });

    expect(clientFindFirst).toHaveBeenCalledWith({ where: { contactEmail: 'contact@dupont.be' } });
    expect(clientCreate.mock.calls[0][0].data.contactEmail).toBe('contact@dupont.be');
  });

  it('refuses a duplicate rather than creating a second row', async () => {
    clientFindFirst.mockResolvedValue({ id: 'client_existing' });

    const result = await adminClientsService.create({ businessName: 'X', contactEmail: 'contact@dupont.be' });

    expect(result).toMatchObject({ ok: false, status: 409, clientId: 'client_existing' });
    expect(clientCreate).not.toHaveBeenCalled();
  });

  it('rejects an unknown plan instead of silently billing another one', async () => {
    const result = await adminClientsService.create({
      businessName: 'X', contactEmail: 'a@b.c', planType: 'gratuit',
    });

    expect(result).toMatchObject({ ok: false, status: 400, error: 'unknown_plan' });
    expect(clientCreate).not.toHaveBeenCalled();
  });

  it('requires a business name and an address', async () => {
    const result = await adminClientsService.create({ businessName: '   ' });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(clientCreate).not.toHaveBeenCalled();
  });

  it('carries the prospect id through when a prospect is converted', async () => {
    await adminClientsService.create({
      businessName: 'X', contactEmail: 'a@b.c', prospectId: 'prospect_7',
    });

    // Client.prospectId exists in the schema but no code has ever written it.
    expect(clientCreate.mock.calls[0][0].data.prospectId).toBe('prospect_7');
  });
});
