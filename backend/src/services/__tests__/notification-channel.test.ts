import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * L'aiguillage SMS / WhatsApp, et la règle qui prime sur tout le reste:
 * un message ne se perd JAMAIS.
 *
 * WhatsApp n'accepte pas de texte libre vers quelqu'un qui n'a pas écrit le
 * premier: il faut un modèle approuvé par Meta, par type de message. Or nos
 * messages sont presque tous business-initiated (une confirmation de rendez-vous
 * part juste après un APPEL). Un type sans modèle, un compte non configuré, ou
 * un refus de Twilio doivent donc tous ramener au SMS, jamais au silence.
 */

const findUnique = vi.fn();
const messagesCreate = vi.fn();
const sendTemplate = vi.fn();

vi.mock('../../config/database', () => ({
  prisma: {
    client: { findUnique: (...a: unknown[]) => findUnique(...a) },
    smsLog: { create: vi.fn().mockResolvedValue({}) },
    analyticsDaily: { upsert: vi.fn().mockResolvedValue({}) },
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

const whatsappClient = () => findUnique.mockResolvedValue({ vapiConfig: { notificationChannel: 'whatsapp' } });
const smsClient = () => findUnique.mockResolvedValue({ vapiConfig: {} });

beforeEach(() => {
  findUnique.mockReset();
  sendTemplate.mockReset();
  messagesCreate.mockReset().mockResolvedValue({ sid: 'SM1' });
  /* Le client Twilio est posé directement plutôt que par un `vi.mock('twilio')`:
     le service l'obtient par un `require`, que le mock d'ESM n'intercepte pas.
     Poser le client mémorisé est plus court, et surtout ça ne demande pas de
     tordre le code de production pour le rendre testable. */
  (smsService as unknown as { twilioClient: unknown }).twilioClient = {
    messages: { create: (...a: unknown[]) => messagesCreate(...a) },
  };
});

describe('sendSMS — choix du canal', () => {
  it('passe par WhatsApp quand le client l’a demandé et que le modèle existe', async () => {
    whatsappClient();
    sendTemplate.mockResolvedValue({ sent: true });

    const r = await smsService.sendSMS('+32470111222', 'Rendez-vous confirmé', {
      messageType: 'booking_confirmed',
      clientId: 'c1',
    });

    expect(r).toMatchObject({ success: true, channel: 'whatsapp' });
    // Le SMS ne doit PAS partir en plus: le client recevrait deux fois le même
    // message, et on le facturerait deux fois.
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it('retombe sur le SMS quand le type n’a pas de modèle approuvé', async () => {
    whatsappClient();
    sendTemplate.mockResolvedValue({ sent: false, reason: 'no_template' });

    const r = await smsService.sendSMS('+32470111222', 'Rendez-vous confirmé', {
      messageType: 'booking_confirmed',
      clientId: 'c1',
    });

    expect(r.success).toBe(true);
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it('retombe sur le SMS quand Twilio refuse le modèle', async () => {
    whatsappClient();
    sendTemplate.mockResolvedValue({ sent: false, reason: 'send_failed' });

    await smsService.sendSMS('+32470111222', 'Rappel', { messageType: 'booking_reminder', clientId: 'c1' });
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it('n’essaie même pas WhatsApp pour un client qui ne l’a pas choisi', async () => {
    smsClient();
    await smsService.sendSMS('+32470111222', 'Coucou', { messageType: 'booking_confirmed', clientId: 'c1' });
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it('n’essaie pas WhatsApp sans client identifié (prospection)', async () => {
    // Les envois de prospection n'ont pas de `clientId`: ils ne doivent pas
    // aller chercher une préférence qui n'existe pas.
    await smsService.sendSMS('+32470111222', 'Démarchage', { messageType: 'interest_followup' });
    expect(findUnique).not.toHaveBeenCalled();
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it('envoie quand même le SMS si la base est indisponible', async () => {
    findUnique.mockRejectedValue(new Error('db down'));
    const r = await smsService.sendSMS('+32470111222', 'Important', {
      messageType: 'booking_confirmed',
      clientId: 'c1',
    });
    expect(r.success).toBe(true);
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });
});
