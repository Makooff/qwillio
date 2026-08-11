import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: { client: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock('../../../config/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../../config/env', () => ({
  env: { VAPI_PHONE_NUMBER: '+3223334455', VAPI_PHONE_NUMBER_ID: 'pn_1' },
}));

const { allocateInboundNumber } = await import('../phone-allocation.service');

const client = (id: string, number: string | null, lines: string[] = []) => ({
  id,
  businessName: `Biz ${id}`,
  vapiPhoneNumber: number,
  phoneNumbers: lines.map(number => ({ number })),
});

describe('allocateInboundNumber', () => {
  beforeEach(() => vi.clearAllMocks());

  it('attribue la ligne quand personne ne la tient', async () => {
    findMany.mockResolvedValue([client('autre', '+33111111111')]);
    expect(await allocateInboundNumber('c1')).toEqual({
      kind: 'allocated',
      number: '+3223334455',
      numberId: 'pn_1',
    });
  });

  it("refuse la ligne déjà tenue par un autre client vivant", async () => {
    // C'est LE défaut qui cassait le produit au deuxième client: les deux
    // devenaient injoignables faute de pouvoir distinguer le destinataire.
    findMany.mockResolvedValue([client('c0', '+3223334455')]);
    const r = await allocateInboundNumber('c1');
    expect(r).toMatchObject({ kind: 'none', reason: 'already_taken', heldBy: 'Biz c0' });
  });

  it('voit aussi une ligne supplémentaire comme une occupation', async () => {
    findMany.mockResolvedValue([client('c0', null, ['+32 2 333 44 55'])]);
    expect((await allocateInboundNumber('c1')).kind).toBe('none');
  });

  it('compare sur les chiffres seuls, pas sur le formatage', async () => {
    findMany.mockResolvedValue([client('c0', '+32 (2) 333-44-55')]);
    expect((await allocateInboundNumber('c1')).kind).toBe('none');
  });

  it("n'interroge que les clients vivants, et jamais le client lui-même", async () => {
    findMany.mockResolvedValue([]);
    await allocateInboundNumber('c1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: 'c1' },
          subscriptionStatus: { in: ['active', 'trialing'] },
        },
      }),
    );
  });
});
