import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: { client: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

const { inboundRoutingService } = await import('../inbound-routing.service');

const client = (id: string, number: string | null, businessName = `Biz ${id}`) => ({
  id,
  businessName,
  vapiPhoneNumber: number,
});

describe('resolveClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves the client that owns the dialed number', async () => {
    findMany.mockResolvedValue([client('c1', '+16073548569'), client('c2', '+33123456789')]);
    const r = await inboundRoutingService.resolveClient('+16073548569');
    expect(r).toMatchObject({ kind: 'resolved', clientId: 'c1' });
  });

  it('matches regardless of formatting', async () => {
    // Stored numbers are not consistently formatted; a SQL LIKE would miss these.
    findMany.mockResolvedValue([client('c1', '+1 (607) 354-8569')]);
    const r = await inboundRoutingService.resolveClient('+16073548569');
    expect(r.kind).toBe('resolved');
  });

  it('refuses to guess when several live clients share the number', async () => {
    // Answering as one of them is a coin flip a real caller pays for.
    findMany.mockResolvedValue([client('c1', '+16073548569'), client('c2', '+16073548569')]);
    const r = await inboundRoutingService.resolveClient('+16073548569');
    expect(r).toMatchObject({ kind: 'ambiguous', candidates: 2 });
  });

  it('reports unknown when no client owns the number', async () => {
    findMany.mockResolvedValue([client('c1', '+33123456789')]);
    expect((await inboundRoutingService.resolveClient('+16073548569')).kind).toBe('unknown');
  });

  it('reports unknown for a missing or nonsense dialed number', async () => {
    for (const bad of [undefined, null, '', 'anonymous', '123']) {
      expect((await inboundRoutingService.resolveClient(bad)).kind).toBe('unknown');
    }
    // Never even queries when there is nothing to match on.
    expect(findMany).not.toHaveBeenCalled();
  });

  it('only considers clients with a live subscription and an assistant', async () => {
    findMany.mockResolvedValue([]);
    await inboundRoutingService.resolveClient('+16073548569');
    const where = findMany.mock.calls[0][0].where;
    expect(where.vapiAssistantId).toEqual({ not: null });
    expect(where.subscriptionStatus.in).toEqual(['active', 'trialing']);
  });
});

describe('unroutableAssistant', () => {
  it('says something the caller can act on, not silence', () => {
    const a = inboundRoutingService.unroutableAssistant('fr') as any;
    expect(a.firstMessage).toMatch(/rappeler/i);
  });

  it('does not impersonate a business — we do not know which one they wanted', () => {
    const a = inboundRoutingService.unroutableAssistant('fr') as any;
    expect(a.name).not.toMatch(/receptionist -/i);
  });

  it('hangs up quickly instead of burning minutes on an agent with no context', () => {
    const a = inboundRoutingService.unroutableAssistant('en') as any;
    expect(a.endCallFunctionEnabled).toBe(true);
    expect(a.maxDurationSeconds).toBeLessThanOrEqual(30);
  });
});
