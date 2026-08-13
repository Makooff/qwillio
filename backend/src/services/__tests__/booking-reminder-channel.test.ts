import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findMany, update, sendWhatsApp, sendSms, sendEmail } = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  sendWhatsApp: vi.fn(),
  sendSms: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: { clientBooking: { findMany, update } },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../email.service', () => ({ emailService: { sendBookingReminderEmail: sendEmail } }));
vi.mock('../sms.service', () => ({ smsService: { sendBookingReminderSMS: sendSms } }));
vi.mock('../whatsapp.service', () => ({ whatsAppService: { sendBookingReminder: sendWhatsApp } }));

import { bookingReminderService } from '../booking-reminder.service';

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  customerName: 'Marie Dupont',
  customerPhone: '+32470123456',
  customerEmail: null,
  bookingDate: new Date('2026-08-14T10:00:00Z'),
  bookingTime: '10:00',
  serviceType: 'Détartrage',
  specialRequests: null,
  reminderSent: true,
  smsReminderSent: false,
  client: {
    businessName: 'Cabinet Lumen',
    businessType: 'dental',
    contactPhone: '+3221234567',
    vapiPhoneNumber: null,
    planType: 'pro',
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe('canal du rappel de rendez-vous', () => {
  it('passe par WhatsApp quand il aboutit, et N’ENVOIE PAS de SMS', async () => {
    /* Le point central: les deux ne partent jamais ensemble. Un même rappel
       reçu deux fois ne donne pas l'impression qu'on est prévenant, et le SMS
       est facturé au segment. */
    findMany.mockResolvedValue([booking()]);
    sendWhatsApp.mockResolvedValue(true);

    await bookingReminderService.processBookingReminders();

    expect(sendWhatsApp).toHaveBeenCalledOnce();
    expect(sendSms).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { smsReminderSent: true, reminderChannel: 'whatsapp' } }),
    );
  });

  it('retombe sur le SMS quand WhatsApp n’aboutit pas', async () => {
    // WhatsApp n'arrive que si le destinataire l'a et a une conversation
    // ouverte. Le repli doit être silencieux et automatique.
    findMany.mockResolvedValue([booking()]);
    sendWhatsApp.mockResolvedValue(false);
    sendSms.mockResolvedValue(true);

    await bookingReminderService.processBookingReminders();

    expect(sendSms).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { smsReminderSent: true, reminderChannel: 'sms' } }),
    );
  });

  it('ne marque rien comme envoyé si les deux canaux échouent', async () => {
    // Sinon le rappel serait perdu en silence: marqué envoyé, jamais reçu.
    findMany.mockResolvedValue([booking()]);
    sendWhatsApp.mockResolvedValue(false);
    sendSms.mockResolvedValue(false);

    await bookingReminderService.processBookingReminders();

    expect(update).not.toHaveBeenCalled();
  });

  it('donne le même contenu aux deux canaux', async () => {
    findMany.mockResolvedValue([booking()]);
    sendWhatsApp.mockResolvedValue(false);
    sendSms.mockResolvedValue(true);

    await bookingReminderService.processBookingReminders();

    // Deux rédactions divergeraient dès la première correction, et le client
    // entendrait deux voix selon le canal.
    expect(sendWhatsApp.mock.calls[0][0]).toEqual(sendSms.mock.calls[0][0]);
  });

  it('ne renvoie rien si le rappel est déjà parti', async () => {
    findMany.mockResolvedValue([booking({ smsReminderSent: true })]);

    await bookingReminderService.processBookingReminders();

    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });
});
