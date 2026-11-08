import { beforeEach, describe, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), claim: vi.fn(), allocate: vi.fn(), buy: vi.fn() }));
vi.mock('../../../config/database', () => ({ prisma: { client: { findUnique: boundary.findUnique, update: boundary.update } } }));
vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../phone-stock.service', () => ({ claimNumberForClient: boundary.claim }));
vi.mock('../phone-allocation.service', () => ({ allocateInboundNumber: boundary.allocate, normalizeNumber: (number: string) => number || '' }));
vi.mock('../phone-provisioning.service', () => ({ autoProvisionNumber: boundary.buy, autoProvisionEnabled: () => true }));
import { phoneSetupService } from '../phone-setup.service';
beforeEach(() => {
  vi.clearAllMocks();
  boundary.findUnique.mockResolvedValue({ id: 'core-tenant', vapiAssistantId: 'legacy-id-retained-for-rollback', subscriptionStatus: 'active', phoneSetupState: 'none', vapiPhoneNumber: null });
  boundary.claim.mockResolvedValue({ kind: 'claimed', number: 'synthetic-stock-line', vapiNumberId: null, reused: false });
});
describe('SIP line provisioning has no legacy assistant dependency', () => {
  it('does not attach a core stock line to a retained Vapi assistant', async () => {
    const result = await phoneSetupService.ensureLine('core-tenant', undefined, { runtime: 'core' });
    expect(result.state).toBe('active');
    expect(boundary.claim).toHaveBeenCalledWith('core-tenant', '');
    expect(boundary.buy).not.toHaveBeenCalled();
  });
  it('uses the available exclusive SIP fallback rather than waiting for a nonexistent Vapi assistant', async () => {
    boundary.claim.mockResolvedValue({ kind: 'empty' });
    boundary.allocate.mockResolvedValue({ kind: 'allocated', number: 'synthetic-fallback-line', numberId: null });
    const result = await phoneSetupService.ensureLine('core-tenant', undefined, { runtime: 'core' });
    expect(result).toMatchObject({ state: 'shared', number: 'synthetic-fallback-line' });
    expect(boundary.buy).not.toHaveBeenCalled();
  });
});
