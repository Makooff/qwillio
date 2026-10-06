import { describe, it, expect, vi, beforeEach } from 'vitest';

/* A1 — la route support ne doit plus déclarer un succès quand l'e-mail n'est
   pas parti. Avant: l'échec Resend était avalé (« best-effort ») et la réponse
   disait success: true. Le client repartait sans sa demande, sans le savoir. */

const h = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  findUniqueClient: vi.fn(),
  emailSend: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: h.findUniqueUser },
    client: { findUnique: h.findUniqueClient },
  },
}));

vi.mock('../../services/email.service', () => ({
  emailService: { send: (...a: unknown[]) => h.emailSend(...a) },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../config/env', () => ({
  env: { RESEND_REPLY_TO: 'contact@qwillio.com' },
}));

import { ClientDashboardController } from '../client-dashboard.controller';

function req(body: unknown) {
  return { body, userId: 'user-1', clientId: 'client-1' };
}

function res() {
  const r: { statusCode?: number; body?: unknown } = {};
  return {
    json: (b: unknown) => { r.body = b; return r; },
    status: (c: number) => { r.statusCode = c; return { json: (b: unknown) => { r.body = b; return r; } }; },
    _r: r,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.findUniqueUser.mockResolvedValue({ id: 'user-1', email: 'gerant@exemple.com', name: 'Gérant' });
  h.findUniqueClient.mockResolvedValue({ id: 'client-1', businessName: 'Boulangerie', planType: 'solo' });
});

describe('POST /my-dashboard/support', () => {
  it('répond 200 quand le fournisseur accepte', async () => {
    h.emailSend.mockResolvedValue({ ok: true, id: 'email_1' });
    const r = res();
    await new ClientDashboardController().sendSupport(req({ subject: '[general] Bug', message: 'Bonjour' }) as any, r as any);
    expect(r._r.statusCode).toBeUndefined();
    expect(r._r.body).toEqual({ success: true });
  });

  it('répond 502 avec un code stable quand le fournisseur refuse (result.error)', async () => {
    h.emailSend.mockRejectedValue(new Error('email_send_failed'));
    const r = res();
    await new ClientDashboardController().sendSupport(req({ subject: '[general] Bug', message: 'Bonjour' }) as any, r as any);
    expect(r._r.statusCode).toBe(502);
    expect(r._r.body).toEqual({ error: 'email_send_failed' });
  });

  it('ne renvoie ni l’erreur brute du fournisseur ni de secret', async () => {
    h.emailSend.mockRejectedValue(new Error('email_send_failed'));
    const r = res();
    await new ClientDashboardController().sendSupport(req({ subject: '[general] Bug', message: 'Bonjour' }) as any, r as any);
    expect(JSON.stringify(r._r.body)).not.toContain('re_');
    expect(JSON.stringify(r._r.body)).not.toContain('Resend');
  });

  it('répond 400 quand le sujet ou le message manque', async () => {
    const r = res();
    await new ClientDashboardController().sendSupport(req({ subject: '  ', message: 'x' }) as any, r as any);
    expect(r._r.statusCode).toBe(400);
    expect(h.emailSend).not.toHaveBeenCalled();
  });
});
