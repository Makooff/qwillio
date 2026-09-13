import { describe, it, expect, vi, beforeEach } from 'vitest';

/* « Je ne vais pas mettre à la main le numéro de chaque client » (13/09/2026):
   le SMS part de la ligne mobile attribuée au client, la plateforme en repli. */
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('../../config/database', () => ({ prisma: { phoneNumberStock: { findFirst }, smsLog: { create: vi.fn() }, analyticsDaily: { upsert: vi.fn() } } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../config/env', () => ({ env: { SMS_ENABLED: true, TWILIO_PHONE_NUMBER: '+19340000000', TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '' } }));

const { smsService } = await import('../sms.service');

beforeEach(() => { findFirst.mockReset(); });

describe('senderFor', () => {
  it("part de la ligne mobile du client quand il en a une", async () => {
    findFirst.mockResolvedValueOnce({ number: '+32460207490' });
    expect(await smsService.senderFor('c1')).toBe('+32460207490');
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ clientId: 'c1', status: 'assigned', numberType: 'mobile' });
  });

  it('retombe sur TWILIO_PHONE_NUMBER sans ligne mobile, ou sans client', async () => {
    findFirst.mockResolvedValueOnce(null);
    expect(await smsService.senderFor('c1')).toBe('+19340000000');
    expect(await smsService.senderFor(null)).toBe('+19340000000');
  });
});
