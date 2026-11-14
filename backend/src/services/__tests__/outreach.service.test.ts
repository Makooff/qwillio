import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  prospect: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}));
const emailMock = vi.hoisted(() => ({ send: vi.fn() }));
const smsMock = vi.hoisted(() => ({ sendSMS: vi.fn() }));
const readyMock = vi.hoisted(() => ({ smsReadiness: vi.fn() }));

vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../config/env', () => ({ env: { RESEND_REPLY_TO: 'contact@qwillio.com' } }));
vi.mock('../email.service', () => ({ emailService: emailMock }));
vi.mock('../sms.service', () => ({ smsService: smsMock }));
vi.mock('../sms-ready', () => readyMock);

import { outreachService } from '../outreach.service';

const sender = { prenom: 'Matthieu', telephone: '+32470123456', lienVideo: 'https://youtu.be/abc' };
const prospect = {
  id: 'p1', email: 'info@plomberie.be', phone: '+32470998877', country: 'BE', status: 'new',
  emailUnsubscribed: false, emailBounced: false, smsOptedOut: false, callOptedOut: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.prospect.findUnique.mockResolvedValue(prospect);
  prismaMock.prospect.findMany.mockResolvedValue([]);
  prismaMock.prospect.update.mockResolvedValue({});
  emailMock.send.mockResolvedValue({ ok: true });
  smsMock.sendSMS.mockResolvedValue({ success: true });
  readyMock.smsReadiness.mockReturnValue({ ok: true, missing: [] });
});

describe('le mail', () => {
  it('part vers l\'adresse générale de la fiche, sans accord à attester', async () => {
    const r = await outreachService.send(
      { channel: 'email', templateId: 'appel_manque', prospectId: 'p1', vars: { heure: '14 h 10' }, sender },
      'moi@qwillio.com',
    );
    expect(r).toMatchObject({ ok: true, channel: 'email', to: 'info@plomberie.be' });
    const sent = emailMock.send.mock.calls[0][0];
    expect(sent.subject).toBe('Appel manqué à 14 h 10');
    expect(sent.replyTo).toBe('moi@qwillio.com');
  });

  it('avance le statut sans compter un appel', async () => {
    await outreachService.send({ channel: 'email', templateId: 'dernier', prospectId: 'p1', sender });
    const data = prismaMock.prospect.update.mock.calls[0][0].data;
    expect(data.status).toBe('contacted');
    expect(data).not.toHaveProperty('callAttempts');
  });

  it('exige l\'accord pour une adresse nominative, saisie à la main', async () => {
    const base = { channel: 'email' as const, templateId: 'dernier', to: 'jean.dupont@gmail.com', sender };
    expect(await outreachService.send(base)).toMatchObject({ ok: false, error: 'consent_required' });
    expect(emailMock.send).not.toHaveBeenCalled();
    expect(await outreachService.send({ ...base, accord: true })).toMatchObject({ ok: true, to: 'jean.dupont@gmail.com' });
  });

  it('refuse une adresse désinscrite, même depuis une autre fiche', async () => {
    prismaMock.prospect.findMany.mockResolvedValue([{ emailUnsubscribed: true, emailBounced: false }]);
    const r = await outreachService.send({ channel: 'email', templateId: 'dernier', to: 'info@ailleurs.be', sender });
    expect(r).toMatchObject({ ok: false, error: 'opted_out' });
    expect(emailMock.send).not.toHaveBeenCalled();
  });

  it('refuse une adresse en échec et une adresse mal formée', async () => {
    prismaMock.prospect.findMany.mockResolvedValue([{ emailUnsubscribed: false, emailBounced: true }]);
    expect(await outreachService.send({ channel: 'email', templateId: 'dernier', prospectId: 'p1', sender }))
      .toMatchObject({ ok: false, error: 'bounced' });
    expect(await outreachService.send({ channel: 'email', templateId: 'dernier', to: 'pas une adresse', sender }))
      .toMatchObject({ ok: false, error: 'invalid_email' });
  });

  it('dit que l\'envoi a échoué quand le fournisseur refuse, sans consigner de contact', async () => {
    emailMock.send.mockRejectedValue(new Error('email_send_failed'));
    const r = await outreachService.send({ channel: 'email', templateId: 'dernier', prospectId: 'p1', sender });
    expect(r).toMatchObject({ ok: false, error: 'send_failed' });
    expect(prismaMock.prospect.update).not.toHaveBeenCalled();
  });
});

describe('le SMS', () => {
  const base = { channel: 'sms' as const, templateId: 'sms_rdv', prospectId: 'p1', vars: { jour: 'jeudi 14 h' }, sender };

  it('ne part jamais sans accord attesté', async () => {
    expect(await outreachService.send(base)).toMatchObject({ ok: false, error: 'consent_required' });
    expect(smsMock.sendSMS).not.toHaveBeenCalled();
  });

  it('part avec l\'accord, rattaché à la fiche', async () => {
    const r = await outreachService.send({ ...base, accord: true });
    expect(r).toMatchObject({ ok: true, channel: 'sms', to: '+32470998877', segments: 1 });
    const [to, body, meta] = smsMock.sendSMS.mock.calls[0];
    expect(to).toBe('+32470998877');
    expect(body).toContain('jeudi 14 h');
    expect(meta).toMatchObject({ messageType: 'outreach_sms_rdv', prospectId: 'p1' });
  });

  it('convertit un numéro national saisi à la main', async () => {
    prismaMock.prospect.findUnique.mockResolvedValue(null);
    const r = await outreachService.send({ ...base, prospectId: null, to: '0470 11 22 33', accord: true });
    expect(r).toMatchObject({ ok: true, to: '+32470112233' });
  });

  it('respecte « ne me rappelez plus » comme un refus de SMS', async () => {
    prismaMock.prospect.findMany.mockResolvedValue([{ smsOptedOut: false, callOptedOut: true }]);
    expect(await outreachService.send({ ...base, accord: true })).toMatchObject({ ok: false, error: 'opted_out' });
    expect(smsMock.sendSMS).not.toHaveBeenCalled();
  });

  it('nomme ce qui manque quand le SMS n\'est pas configuré', async () => {
    readyMock.smsReadiness.mockReturnValue({ ok: false, missing: ['SMS_ENABLED'] });
    expect(await outreachService.send({ ...base, accord: true }))
      .toMatchObject({ ok: false, error: 'sms_unavailable', detail: 'SMS_ENABLED' });
  });

  it('remonte l\'erreur de l\'opérateur', async () => {
    smsMock.sendSMS.mockResolvedValue({ success: false, error: 'boom [Twilio 21408]' });
    expect(await outreachService.send({ ...base, accord: true }))
      .toMatchObject({ ok: false, error: 'send_failed', detail: 'boom [Twilio 21408]' });
  });
});

describe('les garde-fous de forme', () => {
  it('refuse un modèle du mauvais canal et une fiche inconnue', async () => {
    expect(await outreachService.send({ channel: 'sms', templateId: 'dernier', prospectId: 'p1', sender, accord: true }))
      .toMatchObject({ ok: false, error: 'wrong_channel' });
    prismaMock.prospect.findUnique.mockResolvedValue(null);
    expect(await outreachService.send({ channel: 'email', templateId: 'dernier', prospectId: 'nope', sender }))
      .toMatchObject({ ok: false, error: 'unknown_prospect' });
  });

  it('l\'aperçu rend le message même sans destinataire', async () => {
    prismaMock.prospect.findUnique.mockResolvedValue(null);
    const p = await outreachService.preview({ channel: 'email', templateId: 'dernier', sender });
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.recipient.problem).toBe('missing_recipient');
  });
});
