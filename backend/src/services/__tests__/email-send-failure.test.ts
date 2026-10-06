import { describe, it, expect, vi, beforeEach } from 'vitest';

/* A1 — « aucun succès fictif »: Resend ne lève PAS sur une erreur HTTP, elle
   la rend dans `result.error`. Un `send` qui ne regarde que `result.data`
   répondait ok à un refus du fournisseur, et le client du support lisait
   « Message envoyé ! » pour une demande qui n'est jamais partie. */

const h = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../../config/resend', () => ({
  resend: { emails: { send: h.send } },
}));

vi.mock('../../config/env', () => ({
  env: {
    API_BASE_URL: 'https://api.test',
    RESEND_FROM_EMAIL: 'Qwillio <no-reply@qwillio.com>',
    RESEND_REPLY_TO: 'contact@qwillio.com',
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { EmailService } from '../email.service';

beforeEach(() => vi.clearAllMocks());

describe('EmailService.send — l’échec du fournisseur se propage', () => {
  it('rejette quand Resend rend result.error sans lever', async () => {
    h.send.mockResolvedValue({ data: null, error: { message: 'Invalid API key shape', name: 'validation_error' } });
    const service = new EmailService();
    await expect(service.send({ to: 'client@exemple.com', subject: 'S', html: '<p>x</p>' }))
      .rejects.toThrow('email_send_failed');
  });

  it('rejette aussi quand Resend lève (panne réseau / 5xx en exception)', async () => {
    h.send.mockRejectedValue(new Error('fetch failed'));
    const service = new EmailService();
    await expect(service.send({ to: 'client@exemple.com', subject: 'S', html: '<p>x</p>' }))
      .rejects.toThrow();
  });

  it('ne fuite ni le message brut du fournisseur ni la clé dans l’erreur', async () => {
    h.send.mockResolvedValue({ data: null, error: { message: 'Invalid re_live_xxxxxxxx key for account' } });
    const service = new EmailService();
    await service.send({ to: 'client@exemple.com', subject: 'S', html: '<p>x</p>' }).catch((e: Error) => {
      expect(e.message).toBe('email_send_failed');
      expect(JSON.stringify(e)).not.toContain('re_live_');
    });
  });

  it('résout { ok: true, id } quand le fournisseur accepte', async () => {
    h.send.mockResolvedValue({ data: { id: 'email_123' }, error: null });
    const service = new EmailService();
    await expect(service.send({ to: 'client@exemple.com', subject: 'S', html: '<p>x</p>' }))
      .resolves.toEqual({ ok: true, id: 'email_123' });
  });
});
