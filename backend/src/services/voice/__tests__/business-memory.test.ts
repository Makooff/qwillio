import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../../../config/database', () => ({
  prisma: { businessKnowledge: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

const { businessMemoryService } = await import('../business-memory.service');

const entry = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'k1',
  kind: 'faq',
  title: 'Do you have parking?',
  content: 'Free parking behind the building, twelve spaces.',
  keywords: ['parking', 'car'],
  priority: 0,
  ...over,
});

describe('businessMemoryService.promptBlock', () => {
  it('is empty when the client has no knowledge', () => {
    expect(businessMemoryService.promptBlock([], 'en')).toBe('');
  });

  it('puts house rules before staff and FAQ — a broken rule costs more than a missing answer', () => {
    const block = businessMemoryService.promptBlock(
      [
        entry({ id: 'f', kind: 'faq', title: 'Parking?' }),
        entry({ id: 'r', kind: 'rule', title: 'No prices', content: 'Never quote prices by phone.' }),
        entry({ id: 's', kind: 'staff', title: 'Sarah', content: 'Hygienist, Tuesdays and Thursdays.' }),
      ],
      'en'
    );
    expect(block.indexOf('HOUSE RULES')).toBeLessThan(block.indexOf('STAFF'));
    expect(block.indexOf('STAFF')).toBeLessThan(block.indexOf('FAQ'));
  });

  it('caps how many entries reach the prompt — it is replayed every turn', () => {
    const many = Array.from({ length: 30 }, (_, i) => entry({ id: `k${i}`, title: `Q${i}` }));
    const block = businessMemoryService.promptBlock(many, 'en');
    expect(block.split('\n').filter(l => l.startsWith('- ')).length).toBeLessThanOrEqual(8);
  });

  it('truncates long entries rather than dropping them', () => {
    const block = businessMemoryService.promptBlock([entry({ content: 'x'.repeat(900) })], 'en');
    expect(block).toContain('…');
    expect(block.length).toBeLessThan(400);
  });

  it('speaks the client language', () => {
    expect(businessMemoryService.promptBlock([entry({ kind: 'rule' })], 'fr')).toContain('RÈGLES DE LA MAISON');
  });
});

describe('businessMemoryService.search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('matches on an explicit keyword', async () => {
    findMany.mockResolvedValue([entry()]);
    const hits = await businessMemoryService.search('client_1', 'is there parking nearby?');
    expect(hits).toHaveLength(1);
  });

  it('ranks a keyword hit above a body-only hit', async () => {
    findMany.mockResolvedValue([
      entry({ id: 'body', title: 'Opening times', content: 'We have parking too.', keywords: [] }),
      entry({ id: 'keyword', title: 'Parking', content: 'Twelve spaces.', keywords: ['parking'] }),
    ]);
    const hits = await businessMemoryService.search('client_1', 'parking');
    expect(hits[0].id).toBe('keyword');
  });

  it('returns nothing for a query with no meaningful tokens', async () => {
    findMany.mockResolvedValue([entry()]);
    expect(await businessMemoryService.search('client_1', 'uh ok')).toEqual([]);
  });

  it('ignores accents and casing', async () => {
    findMany.mockResolvedValue([entry({ keywords: ['réservation'] })]);
    expect(await businessMemoryService.search('client_1', 'RESERVATION possible ?')).toHaveLength(1);
  });

  it('degrades to empty on a database failure instead of throwing mid-call', async () => {
    findMany.mockRejectedValue(new Error('connection lost'));
    expect(await businessMemoryService.search('client_1', 'parking')).toEqual([]);
  });
});

describe('businessMemoryService.formatForSpeech', () => {
  it('tells the agent what to do when nothing matched', () => {
    const out = businessMemoryService.formatForSpeech([], 'en');
    expect(out).toMatch(/NO INFO/);
    expect(out).toMatch(/take their details/i);
  });

  it('hands back the content with an instruction not to read it verbatim', () => {
    const out = businessMemoryService.formatForSpeech([entry()], 'en');
    expect(out).toContain('Free parking');
    expect(out).toMatch(/your own words/i);
  });
});
