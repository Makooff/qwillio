import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  client: { findUnique: vi.fn() },
  clientCall: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  contact: { findMany: vi.fn(), updateMany: vi.fn() },
  activity: { findMany: vi.fn() },
}));
vi.mock('../../config/database', () => ({ prisma: db }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../config/env', () => ({ env: {} }));
vi.mock('../../config/plan-features', () => ({ planFeatures: () => [] }));
vi.mock('../../config/plans', () => ({ getPlan: () => ({ id: 'starter', includedMinutes: 60 }), PLANS: {} }));
vi.mock('../../config/superagent-option', () => ({ superagentOffer: () => ({}) }));
vi.mock('../setup-completeness', () => ({ setupCompleteness: () => ({}) }));
vi.mock('./voice/knowledge-gap.service', () => ({ knowledgeGapService: { openCount: async () => 0 } }));

import { ClientDashboardService } from '../client-dashboard.service';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CLIENT = '22222222-2222-4222-8222-222222222222';

function leadCall(partial: Record<string, unknown> & { id: string }) {
  return {
    clientId: CLIENT_ID,
    callerNumber: null,
    callerName: null,
    nameCollected: null,
    phoneCollected: null,
    emailCollected: null,
    summary: null,
    leadScore: null,
    bookingRequested: false,
    bookingDetails: null,
    sentiment: null,
    durationSeconds: null,
    status: 'completed',
    tags: [],
    metadata: null,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    ...partial,
  };
}

beforeEach(() => { vi.clearAllMocks(); db.activity.findMany.mockResolvedValue([]); });

describe('getClientLeads — grouped identity list', () => {
  it('garde l’identité transport et rattache le contact réellement créé sur un autre numéro de rappel', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([leadCall({ id: 'c1', callerNumber: '+32477123456', phoneCollected: '+33612345678', callerName: 'Marie' })]);
    db.contact.findMany.mockResolvedValue([{ id: 'callback-contact', phone: '+33612345678' }]);
    db.activity.findMany.mockResolvedValue([{ callId: 'c1', contactId: 'callback-contact' }]);
    const result = await new ClientDashboardService().getClientLeads(CLIENT_ID);
    expect(result.data[0]).toMatchObject({ identityKey: 'phone:+32477123456', callerNumber: '+32477123456', phoneCollected: '+33612345678', contactId: 'callback-contact' });
    expect(db.activity.findMany.mock.calls[0][0].where).toMatchObject({ clientId: CLIENT_ID });
  });
  it('returns one row per phone identity, not one row per call (the reported symptom)', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([
      leadCall({ id: 'c1', callerNumber: '+32477012345', callerName: 'Test A', createdAt: new Date('2026-10-01T10:00:00Z'), leadScore: 8 }),
      leadCall({ id: 'c2', callerNumber: '32477012345', callerName: 'Test A B', createdAt: new Date('2026-10-03T10:00:00Z'), leadScore: 5 }),
      leadCall({ id: 'c3', callerNumber: '+32499999999', callerName: 'Inconnu', createdAt: new Date('2026-10-02T10:00:00Z'), leadScore: 7 }),
    ]);
    db.contact.findMany.mockResolvedValue([]);

    const result = await new ClientDashboardService().getClientLeads(CLIENT_ID, 1, 20);
    expect(result.pagination.total).toBe(2);
    const first = result.data[0];
    expect(first.callIds).toEqual(['c1', 'c2']);
    expect(first.callCount).toBe(2);
    expect(first.leadScore).toBe(5);
    expect(result.data[1].callCount).toBe(1);
  });

  it('counts pagination totals globally over groups, honouring the boundary', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    const calls = Array.from({ length: 25 }, (_, i) =>
      leadCall({ id: `c${i}`, callerNumber: `+324770000${String(i).padStart(2, '0')}`, createdAt: new Date(2026, 9, 1 + i) }),
    );
    db.clientCall.findMany.mockResolvedValue(calls);
    db.contact.findMany.mockResolvedValue([]);

    const svc = new ClientDashboardService();
    const p3 = await svc.getClientLeads(CLIENT_ID, 3, 10);
    expect(p3.pagination).toMatchObject({ total: 25, page: 3, limit: 10, totalPages: 3 });
    expect(p3.data).toHaveLength(5);
    // Clamping: absurd values never crash nor under-report.
    const clamped = await svc.getClientLeads(CLIENT_ID, 0, 500);
    expect(clamped.pagination).toMatchObject({ page: 1, limit: 100, total: 25 });
  });

  it('excludes spam and non-completed calls from the grouped pool', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([
      leadCall({ id: 'ok', callerNumber: '+32477012345', isSpam: false }),
    ]);
    db.contact.findMany.mockResolvedValue([]);

    await new ClientDashboardService().getClientLeads(CLIENT_ID);
    const where = db.clientCall.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ clientId: CLIENT_ID, isLead: true, isSpam: false, status: 'completed' });
  });

  it('filters by phone in national or international writing without leaking unrelated identities', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([
      leadCall({ id: 'c1', callerNumber: '+32475123456' }),
      leadCall({ id: 'c2', callerNumber: '+32477012345' }),
      leadCall({ id: 'c3', callerNumber: null, phoneCollected: null }),
    ]);
    db.contact.findMany.mockResolvedValue([]);

    const svc = new ClientDashboardService();
    const national = await svc.getClientLeads(CLIENT_ID, 1, 20, '0475 12 34 56');
    expect(national.pagination.total).toBe(1);
    expect(national.data[0].callIds).toEqual(['c1']);
    const intl = await svc.getClientLeads(CLIENT_ID, 1, 20, '+32477012345');
    expect(intl.data[0].callIds).toEqual(['c2']);
  });

  it('exposes contactId on exact normalized phone match only', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([leadCall({ id: 'c1', callerNumber: '+32477012345' })]);
    db.contact.findMany.mockResolvedValue([
      { id: 'contact-1', phone: '32477012345' },
      { id: 'contact-2', phone: '+33612345678' },
    ]);

    const result = await new ClientDashboardService().getClientLeads(CLIENT_ID);
    expect(result.data[0].contactId).toBe('contact-1');
  });

  it('exposes the explicit leadStatus alongside status on every canonical row', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([
      leadCall({ id: 'c1', callerNumber: '+32477012345', tags: ['converted'] }),
      leadCall({ id: 'c2', callerNumber: '+32477012345', createdAt: new Date('2026-10-05T10:00:00Z') }),
    ]);
    db.contact.findMany.mockResolvedValue([]);

    const result = await new ClientDashboardService().getClientLeads(CLIENT_ID);
    const row = result.data[0];
    expect(row.leadStatus).toBe('converted');
    expect(row.status).toBe('converted');
    /* Canonical contract: the frontend must NOT re-group. */
    expect(row.identityKey).toBe('phone:+32477012345');
    expect(row.callIds).toEqual(['c1', 'c2']);
    expect(row.callCount).toBe(2);
  });

  it('exposes the frontend contract aliases on every canonical row', async () => {
    /* Le frontend lit callerName/callerNumber/nameCollected/phoneCollected/
       emailCollected/createdAt — les champs canoniques du groupe (name/phone/
       lastInteractionAt) le laissaient blanc. Les alias pointent vers la
       valeur canonique, sans retirer les champs du groupe. */
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([
      leadCall({ id: 'c1', callerNumber: '+32477012345', callerName: 'Marie Dupont', emailCollected: 'marie@example.com', createdAt: new Date('2026-10-01T10:00:00Z') }),
      leadCall({ id: 'c2', callerNumber: '32477012345', callerName: 'Marie', createdAt: new Date('2026-10-03T10:00:00Z') }),
    ]);
    db.contact.findMany.mockResolvedValue([]);

    const row = (await new ClientDashboardService().getClientLeads(CLIENT_ID)).data[0];
    expect(row.callerNumber).toBe('+32477012345');
    expect(row.phoneCollected).toBe('+32477012345');
    expect(row.callerName).toBe('Marie');
    expect(row.nameCollected).toBe('Marie');
    expect(row.emailCollected).toBe('marie@example.com');
    expect(row.createdAt).toEqual(new Date('2026-10-03T10:00:00Z'));
    /* Canonical group fields are preserved alongside the aliases. */
    expect(row.phone).toBe('+32477012345');
    expect(row.name).toBe('Marie');
    expect(row.lastInteractionAt).toEqual(new Date('2026-10-03T10:00:00Z'));
    expect(row.leadStatus).toBe(row.status);
  });

  it('a non-blank phone filter without digits returns nothing instead of everything', async () => {
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([leadCall({ id: 'c1', callerNumber: '+32477012345' })]);
    db.contact.findMany.mockResolvedValue([]);

    const result = await new ClientDashboardService().getClientLeads(CLIENT_ID, 1, 20, 'abc');
    expect(result.pagination.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });
});

describe('updateLeadStatus', () => {
  it('synchronise le contact lié à l’appel même si le rappel diffère du numéro transport', async () => {
    db.clientCall.findFirst.mockResolvedValue(leadCall({ id: 'c1', callerNumber: '+32477123456', phoneCollected: '+33612345678' }));
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([leadCall({ id: 'c1', callerNumber: '+32477123456', phoneCollected: '+33612345678' })]);
    db.contact.findMany.mockResolvedValue([{ id: 'callback-contact', phone: '+33612345678' }]);
    db.activity.findMany.mockResolvedValue([{ callId: 'c1', contactId: 'callback-contact' }]);
    await new ClientDashboardService().updateLeadStatus(CLIENT_ID, 'c1', 'lost');
    expect(db.contact.updateMany).toHaveBeenCalledWith({ where: { id: 'callback-contact', clientId: CLIENT_ID }, data: { status: 'lost' } });
  });
  it('rejects an invalid status before any write', async () => {
    const result = await new ClientDashboardService().updateLeadStatus(CLIENT_ID, 'c1', 'bogus' as any);
    expect(result).toEqual({ ok: false, reason: 'invalid_status' });
    expect(db.clientCall.findFirst).not.toHaveBeenCalled();
    expect(db.clientCall.updateMany).not.toHaveBeenCalled();
  });

  it('returns not_found for a call owned by another tenant', async () => {
    db.clientCall.findFirst.mockResolvedValue(null);
    const result = await new ClientDashboardService().updateLeadStatus(CLIENT_ID, 'c1', 'lost');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(db.clientCall.updateMany).not.toHaveBeenCalled();
  });

  it('applies the status to the whole grouped identity and syncs the CRM contact', async () => {
    db.clientCall.findFirst.mockResolvedValue(leadCall({ id: 'c1', callerNumber: '+32477012345' }));
    db.client.findUnique.mockResolvedValue({ id: CLIENT_ID, country: 'BE' });
    db.clientCall.findMany.mockResolvedValue([
      leadCall({ id: 'c1', callerNumber: '+32477012345', tags: ['new'] }),
      leadCall({ id: 'c2', callerNumber: '32477012345', tags: [], createdAt: new Date('2026-10-04T10:00:00Z') }),
    ]);
    db.contact.findMany.mockResolvedValue([{ id: 'contact-1', phone: '+32477012345' }]);

    const result = await new ClientDashboardService().updateLeadStatus(CLIENT_ID, 'c1', 'converted');
    expect(result).toMatchObject({ ok: true, status: 'converted', updatedCalls: 2 });
    // Both calls of the identity got the write, scoped to the tenant.
    const writes = db.clientCall.updateMany.mock.calls.map(c => c[0]);
    expect(writes).toHaveLength(2);
    for (const w of writes) expect(w.where).toEqual({ id: expect.any(String), clientId: CLIENT_ID });
    // CRM contact synced, preserving tags/notes (only status written).
    expect(db.contact.updateMany).toHaveBeenCalledWith({
      where: { id: 'contact-1', clientId: CLIENT_ID },
      data: { status: 'converted' },
    });
  });
});

describe('updateLeadNotes', () => {
  it('rejects non-string notes without writing', async () => {
    const result = await new ClientDashboardService().updateLeadNotes(CLIENT_ID, 'c1', 42 as any);
    expect(result).toEqual({ ok: false, reason: 'invalid_notes' });
    expect(db.clientCall.updateMany).not.toHaveBeenCalled();
  });

  it('merges metadata instead of overwriting unrelated call history', async () => {
    db.clientCall.findFirst.mockResolvedValue(
      leadCall({ id: 'c1', metadata: { aiSummary: 'kept', clientNotes: 'ancienne' } }),
    );
    const result = await new ClientDashboardService().updateLeadNotes(CLIENT_ID, 'c1', 'nouvelle note');
    expect(result).toEqual({ ok: true });
    const data = db.clientCall.updateMany.mock.calls[0][0].data;
    expect(data.metadata).toMatchObject({ aiSummary: 'kept', clientNotes: 'nouvelle note' });
  });
});
