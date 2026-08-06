import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * « Une notification à chaque appel pris », promesse de la page d'accueil qui
 * n'était tenue par rien. Ces tests tiennent les trois garde-fous qui
 * l'accompagnent: le spam qui ne réveille personne, le plafond de SMS, et le
 * fait qu'un canal en panne n'emporte pas l'autre.
 */
const { sendSMS, sendEmail, smsCount } = vi.hoisted(() => ({
  sendSMS: vi.fn(),
  sendEmail: vi.fn(),
  smsCount: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: { smsLog: { count: smsCount } },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../email.service', () => ({ emailService: { send: sendEmail } }));
vi.mock('../sms.service', () => ({ smsService: { sendSMS } }));

import { callNotificationService, readPrefs } from '../call-notification.service';

const CLIENT = {
  id: 'client_1',
  businessName: 'Studio Lumen',
  contactName: 'Camille',
  contactEmail: 'camille@studio.test',
  contactPhone: '+32471221088',
  agentLanguage: 'fr',
  country: 'BE',
  vapiConfig: null as unknown,
};

const CALL = {
  id: 'call_1',
  callerNumber: '+32475221088',
  callerName: 'Amélie Rousseau',
  summary: 'Demande un rendez-vous coupe et couleur pour samedi matin. Créneau de 10 h proposé et accepté.',
  outcome: 'lead_captured',
  sentiment: 'positive',
  durationSeconds: 96,
  isSpam: false,
  isLead: true,
  bookingRequested: true,
};

const body = () => sendSMS.mock.calls[0][1] as string;

beforeEach(() => {
  vi.clearAllMocks();
  sendSMS.mockResolvedValue({ success: true });
  sendEmail.mockResolvedValue({ ok: true });
  smsCount.mockResolvedValue(0);
});

describe('ce que reçoit le propriétaire', () => {
  it('envoie un SMS par défaut, sans qu’il ait rien à régler', async () => {
    const r = await callNotificationService.notify(CLIENT, CALL);

    expect(r.sms).toBe(true);
    expect(sendSMS.mock.calls[0][0]).toBe('+32471221088');
    expect(sendSMS.mock.calls[0][2]).toMatchObject({ messageType: 'call_notification', clientId: 'client_1' });
  });

  it('dit qui a appelé, combien de temps, ce qui en est sorti', async () => {
    await callNotificationService.notify(CLIENT, CALL);

    expect(body()).toContain('Amélie Rousseau');
    expect(body()).toContain('1 min 36');
    expect(body()).toContain('Coordonnées prises');
    expect(body()).toContain('/dashboard/calls');
  });

  it('coupe un résumé bavard plutôt que de payer un segment de plus', async () => {
    await callNotificationService.notify(CLIENT, { ...CALL, summary: 'x'.repeat(400) });

    expect(body()).toContain('...');
    expect(body().length).toBeLessThan(320);
  });

  it('écrit en anglais à un client anglophone', async () => {
    await callNotificationService.notify({ ...CLIENT, agentLanguage: 'en' }, CALL);

    expect(body()).toContain('Details taken');
  });
});

describe('ce qui ne doit jamais sonner', () => {
  it('ne notifie pas un appel de spam', async () => {
    const r = await callNotificationService.notify(CLIENT, { ...CALL, isSpam: true });

    expect(r).toEqual({ sms: false, email: false });
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('se tait quand le propriétaire a coupé les notifications', async () => {
    const client = { ...CLIENT, vapiConfig: { callNotify: { channel: 'off' } } };

    expect(await callNotificationService.notify(client, CALL)).toEqual({ sms: false, email: false });
  });

  it('ne garde que les appels utiles quand c’est ce qui est demandé', async () => {
    const client = { ...CLIENT, vapiConfig: { callNotify: { channel: 'sms', leadsAndBookingsOnly: true } } };

    await callNotificationService.notify(client, { ...CALL, isLead: false, bookingRequested: false });
    expect(sendSMS).not.toHaveBeenCalled();

    await callNotificationService.notify(client, CALL);
    expect(sendSMS).toHaveBeenCalledOnce();
  });

  it('s’arrête au plafond quotidien de SMS', async () => {
    smsCount.mockResolvedValue(30);

    const r = await callNotificationService.notify(CLIENT, CALL);

    expect(r.sms).toBe(false);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('compte le plafond sur les SMS envoyés, pas sur les appels reçus', async () => {
    await callNotificationService.notify(CLIENT, CALL);

    expect(smsCount.mock.calls[0][0].where).toMatchObject({
      clientId: 'client_1',
      messageType: 'call_notification',
      status: 'sent',
    });
  });
});

describe('quand un canal tombe', () => {
  it('envoie encore le courriel si le SMS échoue', async () => {
    sendSMS.mockResolvedValue({ success: false, error: 'Twilio down' });
    const client = { ...CLIENT, vapiConfig: { callNotify: { channel: 'both' } } };

    expect(await callNotificationService.notify(client, CALL)).toEqual({ sms: false, email: true });
  });

  it('envoie encore le SMS si le courriel rebondit', async () => {
    sendEmail.mockRejectedValue(new Error('resend down'));
    const client = { ...CLIENT, vapiConfig: { callNotify: { channel: 'both' } } };

    expect(await callNotificationService.notify(client, CALL)).toEqual({ sms: true, email: false });
  });

  it('n’envoie pas de SMS à un client qui n’a pas donné de numéro', async () => {
    const r = await callNotificationService.notify({ ...CLIENT, contactPhone: null }, CALL);

    expect(r.sms).toBe(false);
  });
});

describe('les préférences', () => {
  it('valent SMS, tout appel, 30 par jour quand rien n’est réglé', () => {
    expect(readPrefs(CLIENT)).toEqual({ channel: 'sms', leadsAndBookingsOnly: false, dailySmsCap: 30 });
  });

  it('ignore une valeur de canal inconnue plutôt que de se taire', () => {
    const client = { ...CLIENT, vapiConfig: { callNotify: { channel: 'pigeon' } } };

    expect(readPrefs(client).channel).toBe('sms');
  });
});
