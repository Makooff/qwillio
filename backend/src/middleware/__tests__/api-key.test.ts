import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La porte de l'API publique.
 *
 * « Accès API complet » était vendu sur Enterprise sans qu'aucune route ne lise
 * de clé. Maintenant qu'elle existe, ce qui compte est ce qu'elle REFUSE.
 */
const { keyFindUnique, keyUpdate, clientFindUnique } = vi.hoisted(() => ({
  keyFindUnique: vi.fn(),
  keyUpdate: vi.fn(),
  clientFindUnique: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    apiKey: { findUnique: keyFindUnique, update: keyUpdate },
    client: { findUnique: clientFindUnique },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { apiKeyAuth, requirePermission } from '../api-key.middleware';

function mockReq(headers: Record<string, string> = {}) {
  return {
    header: (name: string) => headers[name.toLowerCase()],
    query: {},
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const ENTERPRISE = { id: 'client_1', planType: 'enterprise', subscriptionStatus: 'active' };
const VALID_KEY = { id: 'key_1', userId: 'user_1', permissions: ['read'], expiresAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  keyFindUnique.mockResolvedValue(VALID_KEY);
  keyUpdate.mockResolvedValue({});
  clientFindUnique.mockResolvedValue(ENTERPRISE);
});

describe('qui entre', () => {
  it('accepte une clé valide dans X-API-Key', async () => {
    const req = mockReq({ 'x-api-key': 'qw_abc' });
    const next = vi.fn();

    await apiKeyAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.apiClientId).toBe('client_1');
  });

  it('accepte aussi le porteur Authorization: Bearer', async () => {
    const req = mockReq({ authorization: 'Bearer qw_abc' });
    const next = vi.fn();

    await apiKeyAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(keyFindUnique.mock.calls[0][0].where.key).toBe('qw_abc');
  });

  it('note l’usage sans faire attendre la réponse', async () => {
    await apiKeyAuth(mockReq({ 'x-api-key': 'qw_abc' }), mockRes(), vi.fn());

    expect(keyUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'key_1' } }));
  });
});

describe('qui reste dehors', () => {
  it('refuse une requête sans clé', async () => {
    const res = mockRes();
    const next = vi.fn();

    await apiKeyAuth(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('donne la MÊME réponse pour une clé inconnue et une clé expirée', async () => {
    const unknown = mockRes();
    keyFindUnique.mockResolvedValue(null);
    await apiKeyAuth(mockReq({ 'x-api-key': 'qw_nope' }), unknown, vi.fn());

    const expired = mockRes();
    keyFindUnique.mockResolvedValue({ ...VALID_KEY, expiresAt: new Date('2020-01-01') });
    await apiKeyAuth(mockReq({ 'x-api-key': 'qw_old' }), expired, vi.fn());

    // Distinguer les deux dirait à qui essaie des clés laquelle a existé.
    expect(unknown.status.mock.calls[0][0]).toBe(expired.status.mock.calls[0][0]);
    expect(unknown.json.mock.calls[0][0]).toEqual(expired.json.mock.calls[0][0]);
  });

  it('refuse un forfait qui ne comprend pas l’API', async () => {
    clientFindUnique.mockResolvedValue({ ...ENTERPRISE, planType: 'pro' });
    const res = mockRes();

    await apiKeyAuth(mockReq({ 'x-api-key': 'qw_abc' }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe('plan_required');
  });

  it('refuse un abonnement résilié, même sur Enterprise', async () => {
    clientFindUnique.mockResolvedValue({ ...ENTERPRISE, subscriptionStatus: 'cancelled' });
    const res = mockRes();

    await apiKeyAuth(mockReq({ 'x-api-key': 'qw_abc' }), res, vi.fn());

    expect(res.json.mock.calls[0][0].error).toBe('subscription_inactive');
  });

  it('refuse une clé qui n’est rattachée à aucun compte', async () => {
    clientFindUnique.mockResolvedValue(null);
    const res = mockRes();

    await apiKeyAuth(mockReq({ 'x-api-key': 'qw_abc' }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('ne laisse pas fuiter une panne de base en 200', async () => {
    keyFindUnique.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    const next = vi.fn();

    await apiKeyAuth(mockReq({ 'x-api-key': 'qw_abc' }), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('les permissions', () => {
  it('laisse passer la permission portée par la clé', () => {
    const req = { apiPermissions: ['read'] } as any;
    const next = vi.fn();

    requirePermission('read')(req, mockRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('refuse une permission absente de la clé', () => {
    const req = { apiPermissions: ['read'] } as any;
    const res = mockRes();

    requirePermission('write')(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
