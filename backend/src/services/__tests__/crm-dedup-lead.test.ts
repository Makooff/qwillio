import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  contact: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
vi.mock('../../config/database', () => ({ prisma: db }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { CrmDedupService } from '../crm-dedup.service';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  // Pass-through interactive transaction so the service body runs against the mock.
  db.$transaction.mockImplementation((fn: any) => fn(db));
});

describe('createOrMerge — country-aware normalization', () => {
  it('parses a national number with the tenant country instead of legacy BE', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockResolvedValue({ id: 'new-1' });

    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie', phone: '0612345678' },
      { country: 'FR' },
    );
    expect(db.contact.create.mock.calls[0][0].data.phone).toBe('+33612345678');
  });

  it('keeps the legacy BE default when no country context is given', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockResolvedValue({ id: 'new-2' });

    await new CrmDedupService().createOrMerge(CLIENT_ID, { name: 'Marie', phone: '0475123456' });
    expect(db.contact.create.mock.calls[0][0].data.phone).toBe('+32475123456');
  });

  it('matches a legacy formatted stored row instead of creating a duplicate', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([{ id: 'legacy-1', phone: '0475 12 34 56' }]);
    db.contact.findUnique.mockResolvedValue({ notes: null, tags: [] });

    const id = await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie', phone: '+32475123456' },
      { country: 'BE' },
    );
    expect(id).toBe('legacy-1');
    expect(db.contact.create).not.toHaveBeenCalled();
  });

  it('never fuzzy-merges two different valid phone numbers even with the same name', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([{ id: 'other', name: 'Marie', phone: '+32477000000' }]);
    db.contact.create.mockResolvedValue({ id: 'created' });

    const id = await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie', phone: '+32477000001' },
      { country: 'BE' },
    );
    expect(id).toBe('created');
  });

  it('does not collapse anonymous placeholders via name matching', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([{ id: 'existing', name: 'Appelant inconnu', phone: null }]);
    db.contact.create.mockResolvedValue({ id: 'anon-new' });

    const id = await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Appelant inconnu', matchByName: true },
    );
    expect(id).toBe('anon-new');
    expect(db.contact.create).toHaveBeenCalled();
  });

  it('honours country inside the data object (chosen signature for the pipeline)', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockResolvedValue({ id: 'new-3' });

    await new CrmDedupService().createOrMerge(CLIENT_ID, {
      name: 'Marie',
      phone: '0612345678',
      country: 'FR',
    });
    expect(db.contact.create.mock.calls[0][0].data.phone).toBe('+33612345678');
  });

  it('stores an unparseable phone as null instead of a junk identity', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockResolvedValue({ id: 'junk' });

    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie', phone: '+abc3247701', country: 'BE' },
    );
    expect(db.contact.create.mock.calls[0][0].data.phone).toBeNull();
  });
});

describe('createOrMerge — strict leadScore', () => {
  function mergeSetup(existing: Record<string, unknown>) {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([{ id: 'existing-1', name: 'Marie', phone: '+32477012345' }]);
    db.contact.findUnique.mockResolvedValue(existing);
    return 'existing-1';
  }

  it('accepts 0 and writes it (the old truthy check dropped it)', async () => {
    const id = mergeSetup({ notes: null, tags: [] });
    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie', phone: '+32477012345', leadScore: 0 },
      { country: 'BE' },
    );
    expect(db.contact.update.mock.calls[0][0].data.leadScore).toBe(0);
    expect(id).toBe('existing-1');
  });

  it('rejects out-of-range and non-integer scores instead of writing them', async () => {
    const id = mergeSetup({ notes: null, tags: [] });
    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie', phone: '+32477012345', leadScore: 11 },
      { country: 'BE' },
    );
    expect(db.contact.update.mock.calls[0][0].data.leadScore).toBeUndefined();

    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie', phone: '+32477012345', leadScore: 7.5 },
      { country: 'BE' },
    );
    expect(db.contact.update.mock.calls[1][0].data.leadScore).toBeUndefined();
  });

  it('sanitizes the score on create too', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockResolvedValue({ id: 'created-score' });

    await new CrmDedupService().createOrMerge(CLIENT_ID, { name: 'Marie', phone: '+32477012345', leadScore: 42 }, { country: 'BE' });
    expect(db.contact.create.mock.calls[0][0].data.leadScore).toBeNull();

    await new CrmDedupService().createOrMerge(CLIENT_ID, { name: 'Marie', phone: '+32477012399', leadScore: 3 }, { country: 'BE' });
    expect(db.contact.create.mock.calls[1][0].data.leadScore).toBe(3);
  });
});

describe('createOrMerge — name safety', () => {
  it('does not let an anonymous/generic incoming name overwrite a real stored name', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([{ id: 'existing-1', name: 'Marie Dupont', phone: '+32477012345' }]);
    db.contact.findUnique.mockResolvedValue({ notes: null, tags: [] });

    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Appelant inconnu', phone: '+32477012345' },
      { country: 'BE' },
    );
    expect(db.contact.update.mock.calls[0][0].data.name).toBeUndefined();
  });

  it('keeps the existing real name when the pipeline has no name at all', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([{ id: 'existing-1', name: 'Marie Dupont', phone: '+32477012345' }]);
    db.contact.findUnique.mockResolvedValue({ notes: null, tags: [] });

    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { phone: '+32477012345' },
      { country: 'BE' },
    );
    const data = db.contact.update.mock.calls[0][0].data;
    expect(data.name).toBeUndefined();
    expect(data.phone).toBe('+32477012345');
  });

  it('a real incoming name still upgrades the stored one', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([{ id: 'existing-1', name: 'Marie', phone: '+32477012345' }]);
    db.contact.findUnique.mockResolvedValue({ notes: null, tags: [] });

    await new CrmDedupService().createOrMerge(
      CLIENT_ID,
      { name: 'Marie Dupont', phone: '+32477012345' },
      { country: 'BE' },
    );
    expect(db.contact.update.mock.calls[0][0].data.name).toBe('Marie Dupont');
  });
});

describe('createOrMerge — bounded country', () => {
  it('an invalid country string falls back to BE instead of throwing', async () => {
    db.contact.findFirst.mockResolvedValue(null);
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockResolvedValue({ id: 'cc-safe' });

    await expect(
      new CrmDedupService().createOrMerge(CLIENT_ID, { name: 'Marie', phone: '0475123456', country: 'XX' }),
    ).resolves.toBe('cc-safe');
    expect(db.contact.create.mock.calls[0][0].data.phone).toBe('+32475123456');
  });
});
