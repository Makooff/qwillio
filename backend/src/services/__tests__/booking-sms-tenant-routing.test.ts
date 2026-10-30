import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * AUDIT — Les SMS de rendez-vous (rappel 24 h, relance d'absence) appelaient
 * `sendSMS(phone, body)` SANS métadonnées. Conséquences réelles, toutes
 * silencieuses:
 *   - un numéro NATIONAL (« 0483620980 ») n'était pas convertible: le pays
 *     se lit via `clientId`, qui n'était pas fourni;
 *   - l'expéditeur tombait sur la ligne plateforme au lieu de la ligne mobile
 *     du client (`senderFor(clientId)`);
 *   - `sms_log` ne rattachait le message à aucun client (attribution perdue);
 *   - la préférence WhatsApp n'était jamais consultée, et aucun type de
 *     message n'était posé.
 * Ce fichier épingle: le type dédié par message (le no-show N'EST PAS un
 * rappel ordinaire: gabarit WhatsApp différent), le clientId, la conversion
 * nationale via le pays du client, et l'attribution dans `sms_log`.
 */

const findUnique = vi.fn();
const findFirst = vi.fn();
const messagesCreate = vi.fn();
const sendTemplate = vi.fn();
const smsLogCreate = vi.fn().mockResolvedValue({});
const analyticsUpsert = vi.fn().mockResolvedValue({});

vi.mock('../../config/database', () => ({
  prisma: {
    client: { findUnique: (...a: unknown[]) => findUnique(...a) },
    phoneNumberStock: { findFirst: (...a: unknown[]) => findFirst(...a) },
    smsLog: { create: (...a: unknown[]) => smsLogCreate(...a) },
    analyticsDaily: { upsert: (...a: unknown[]) => analyticsUpsert(...a) },
  },
}));

vi.mock('../whatsapp.service', () => ({
  whatsAppService: { sendTemplate: (...a: unknown[]) => sendTemplate(...a) },
}));

vi.mock('../../config/env', () => ({
  env: {
    SMS_ENABLED: true,
    TWILIO_ACCOUNT_SID: 'AC' + '0'.repeat(32),
    TWILIO_AUTH_TOKEN: 'token',
    TWILIO_PHONE_NUMBER: '+3225550000',
  },
}));

const { smsService } = await import('../sms.service');

const smsClient = () => findUnique.mockResolvedValue({ vapiConfig: {}, country: 'BE' });

beforeEach(() => {
  vi.clearAllMocks();
  smsLogCreate.mockResolvedValue({});
  messagesCreate.mockResolvedValue({ sid: 'SM1' });
  sendTemplate.mockResolvedValue({ sent: false, reason: 'no_template' });
  /* Le client Twilio est posé directement (require non intercepté en ESM),
     même technique que notification-channel.test.ts. */
  (smsService as unknown as { twilioClient: unknown }).twilioClient = {
    messages: { create: (...a: unknown[]) => messagesCreate(...a) },
  };
});

describe('sendBookingReminderSMS — métadonnées tenant', () => {
  it('marque le message booking_reminder ET rattache le client dans sms_log', async () => {
    smsClient();
    await smsService.sendBookingReminderSMS({
      customerPhone: '+32483620980',
      customerName: 'Jean Dupont',
      businessName: 'Garage Leblanc',
      bookingDate: '2026-07-02T12:00:00.000Z',
      bookingTime: '14:30',
      serviceType: 'vidange',
      clientId: 'c1',
    });

    expect(messagesCreate).toHaveBeenCalledOnce();
    expect(smsLogCreate).toHaveBeenCalledOnce();
    expect(smsLogCreate.mock.calls[0][0].data).toMatchObject({
      messageType: 'booking_reminder',
      clientId: 'c1',
    });
  });

  it('convertit un numéro NATIONAL grâce au pays lu via clientId', async () => {
    /* « 0483620980 » tout seul est ambigu et refusé; le pays du client (lu
       par clientId) le convertit en +32483620980. */
    findUnique.mockResolvedValue({ vapiConfig: {}, country: 'BE' });
    await smsService.sendBookingReminderSMS({
      customerPhone: '0483620980',
      customerName: 'Jean Dupont',
      businessName: 'Garage Leblanc',
      bookingDate: '2026-07-02T12:00:00.000Z',
      bookingTime: '14:30',
      serviceType: null,
      clientId: 'c1',
    });

    expect(messagesCreate).toHaveBeenCalledOnce();
    expect(messagesCreate.mock.calls[0][0].to).toBe('+32483620980');
  });

  it('utilise la ligne mobile du client comme expéditeur quand elle existe', async () => {
    smsClient();
    findFirst.mockResolvedValue({ number: '+32470123456' });
    await smsService.sendBookingReminderSMS({
      customerPhone: '+32483620980',
      customerName: 'Jean Dupont',
      businessName: 'Garage Leblanc',
      bookingDate: '2026-07-02T12:00:00.000Z',
      bookingTime: '14:30',
      serviceType: null,
      clientId: 'c1',
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clientId: 'c1' }) }),
    );
    expect(messagesCreate.mock.calls[0][0].from).toBe('+32470123456');
  });
});

describe('sendNoShowRescheduleSMS — un type à part, jamais un « rappel »', () => {
  it('marque le message booking_no_show (≠ booking_reminder) avec clientId', async () => {
    smsClient();
    await smsService.sendNoShowRescheduleSMS({
      customerPhone: '+32483620980',
      customerName: 'Jean Dupont',
      businessName: 'Garage Leblanc',
      bookingDate: '2026-07-02T12:00:00.000Z',
      bookingTime: '14:30',
      serviceType: 'vidange',
      businessPhone: '+3225550011',
      clientId: 'c1',
    });

    expect(smsLogCreate).toHaveBeenCalledOnce();
    const log = smsLogCreate.mock.calls[0][0].data;
    expect(log.messageType).toBe('booking_no_show');
    expect(log.messageType).not.toBe('booking_reminder');
    expect(log.clientId).toBe('c1');
  });

  it('le contenu parle d’une absence manquée, pas d’un rappel', async () => {
    smsClient();
    await smsService.sendNoShowRescheduleSMS({
      customerPhone: '+32483620980',
      customerName: 'Jean',
      businessName: 'Garage Leblanc',
      bookingDate: '2026-07-02T12:00:00.000Z',
      bookingTime: '14:30',
      serviceType: null,
      businessPhone: '+3225550011',
      clientId: 'c1',
    });

    const body = messagesCreate.mock.calls[0][0].body as string;
    expect(body).toMatch(/manqu|missed/i);
    expect(body).not.toMatch(/^Rappel|^Reminder/i);
  });

  it('convertit un numéro national belge via le pays du client', async () => {
    findUnique.mockResolvedValue({ vapiConfig: {}, country: 'BE' });
    await smsService.sendNoShowRescheduleSMS({
      customerPhone: '0483620980',
      customerName: 'Jean',
      businessName: 'Garage Leblanc',
      bookingDate: '2026-07-02T12:00:00.000Z',
      bookingTime: '14:30',
      serviceType: null,
      businessPhone: null,
      clientId: 'c1',
    });

    expect(messagesCreate.mock.calls[0][0].to).toBe('+32483620980');
  });
});
