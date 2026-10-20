import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ call: vi.fn(), activity: vi.fn(), update: vi.fn(), remember: vi.fn() }));
vi.mock('../../../config/database', () => ({ prisma: {
  clientCall: { findUnique: db.call },
  agentCrmActivity: { findUnique: db.activity, update: db.update },
} }));
vi.mock('../caller-memory.service', () => ({ callerMemoryService: { remember: db.remember } }));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { realtimeOrchestratorService } from '../realtime-orchestrator.service';

describe('Vapi completion memory uses the same event identity as live capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.call.mockResolvedValue({ id: 'stored-call', summary: 'Suivi devis', outcome: 'lead',
      nameCollected: 'Alice Martin', emailCollected: 'alice@example.invalid', endedAt: new Date('2026-10-18T10:00:00Z') });
    db.remember.mockResolvedValue(undefined);
  });
  it('passes stable call id, completion phase and actual event date', async () => {
    await realtimeOrchestratorService.persistMemory({ clientId: 'tenant-a', vapiCallId: 'room-a',
      callerNumber: '33612345678', metrics: null });
    expect(db.call.mock.calls[0][0].where).toMatchObject({ vapiCallId: 'room-a', clientId: 'tenant-a' });
    expect(db.remember).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'tenant-a',
      callId: 'room-a', phase: 'completed', identitySource: 'analysis',
      occurredAt: new Date('2026-10-18T10:00:00Z') }));
  });
  it('never remembers a completion whose persisted call is absent', async () => {
    db.call.mockResolvedValue(null);
    await realtimeOrchestratorService.persistMemory({ clientId: 'tenant-a', vapiCallId: 'absent',
      callerNumber: '33612345678', metrics: null });
    expect(db.remember).not.toHaveBeenCalled();
  });
});
