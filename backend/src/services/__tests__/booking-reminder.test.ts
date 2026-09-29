import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
  sendReschedule: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: { clientBooking: { findMany: h.findMany, updateMany: h.updateMany, update: vi.fn() } },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../email.service', () => ({ emailService: { sendBookingReminderEmail: h.sendEmail, sendRescheduleEmail: h.sendReschedule } }));
vi.mock('../discord.service', () => ({ discordService: { notify: vi.fn() } }));
vi.mock('../sms.service', () => ({ smsService: { sendBookingReminderSMS: h.sendSms } }));

import { bookingReminderService, bookingInstant } from '../booking-reminder.service';

/** Un jour tel que la plateforme le stocke: MIDI UTC, jamais minuit. */
const day = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

const client = {
  businessName: 'Garage Leblanc', businessType: 'garage', contactPhone: '+3225550011',
  vapiPhoneNumber: null, planType: 'pro',
  onboardingData: { timezone: 'Europe/Brussels' }, country: 'BE', city: 'Bruxelles', agentLanguage: 'fr',
};

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1', bookingDate: day('2026-07-02'), bookingTime: '14:30',
  customerName: 'Jean Dupont', customerEmail: 'jean@x.be', customerPhone: '+32470111222',
  serviceType: 'vidange', specialRequests: null,
  reminderSent: false, smsReminderSent: false,
  client, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
  h.sendEmail.mockResolvedValue(undefined);
  h.sendSms.mockResolvedValue(true);
  h.sendReschedule.mockResolvedValue(undefined);
});

/**
 * La fenêtre de rappel comparait `bookingDate` — le JOUR, posé à MIDI UTC —
 * à l'heure qu'il est. Un rendez-vous aujourd'hui à 20 h portait donc une
 * date déjà passée dès 13 h et ne recevait JAMAIS de rappel. Le décalage
 * allait jusqu'à douze heures dans les deux sens, et rien ne le disait: un
 * rappel qui manque ne fait aucun bruit.
 */
describe('bookingInstant — le jour est à midi, l’heure est murale', () => {
  it('compose l’instant dans le fuseau du commerce', () => {
    // 14:30 à Bruxelles en juillet (UTC+2) = 12:30 UTC.
    expect(bookingInstant({ bookingDate: day('2026-07-02'), bookingTime: '14:30' }, 'Europe/Brussels')
      ?.toISOString()).toBe('2026-07-02T12:30:00.000Z');
  });

  it('suit le changement d’heure au lieu d’un décalage figé', () => {
    expect(bookingInstant({ bookingDate: day('2026-01-15'), bookingTime: '14:30' }, 'Europe/Brussels')
      ?.toISOString()).toBe('2026-01-15T13:30:00.000Z');
  });

  it('accepte l’heure sans zéro initial et la forme parlée', () => {
    expect(bookingInstant({ bookingDate: day('2026-07-02'), bookingTime: '9:05' }, 'Europe/Brussels')
      ?.toISOString()).toBe('2026-07-02T07:05:00.000Z');
    expect(bookingInstant({ bookingDate: day('2026-07-02'), bookingTime: '14h30' }, 'Europe/Brussels')
      ?.toISOString()).toBe('2026-07-02T12:30:00.000Z');
  });

  it('rend null sur une heure illisible au lieu d’en inventer une', () => {
    for (const t of [null, '', 'après-midi', '25:00', '14:70']) {
      expect(bookingInstant({ bookingDate: day('2026-07-02'), bookingTime: t }, 'Europe/Brussels')).toBeNull();
    }
  });
});

describe('processBookingReminders — la fenêtre', () => {
  it('rappelle un rendez-vous de DEMAIN après-midi', async () => {
    h.findMany.mockResolvedValue([booking()]);
    // 12:30 UTC le 02 moins 20 h → 16:30 UTC le 01.
    const sent = await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    expect(sent).toBe(1);
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendSms).toHaveBeenCalledOnce();
  });

  it("rappelle un rendez-vous D'AUJOURD'HUI en soirée — le cas qui ne partait jamais", async () => {
    /* Le rendez-vous est à 20 h, il est 13 h. L'ancienne fenêtre comparait
       midi UTC à 13 h et l'excluait: ce client n'a jamais été rappelé. */
    h.findMany.mockResolvedValue([booking({ bookingTime: '20:00' })]);
    const sent = await bookingReminderService.processBookingReminders(new Date('2026-07-02T11:00:00Z'));
    expect(sent).toBe(1);
  });

  it('ne rappelle pas trop tôt', async () => {
    h.findMany.mockResolvedValue([booking()]);
    const sent = await bookingReminderService.processBookingReminders(new Date('2026-06-30T12:00:00Z'));
    expect(sent).toBe(0);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('ne rappelle pas un rendez-vous imminent: la confirmation vient de partir', async () => {
    h.findMany.mockResolvedValue([booking()]);
    // Une heure avant: sous le plancher de deux heures.
    const sent = await bookingReminderService.processBookingReminders(new Date('2026-07-02T11:30:00Z'));
    expect(sent).toBe(0);
  });

  it('ne rappelle jamais un rendez-vous passé', async () => {
    h.findMany.mockResolvedValue([booking()]);
    const sent = await bookingReminderService.processBookingReminders(new Date('2026-07-02T15:00:00Z'));
    expect(sent).toBe(0);
  });

  it('passe une heure illisible au lieu de rappeler à midi', async () => {
    h.findMany.mockResolvedValue([booking({ bookingTime: 'après-midi' })]);
    const sent = await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    expect(sent).toBe(0);
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});

describe('processBookingReminders — ce que la base est priée de filtrer', () => {
  it('ne filtre plus sur le forfait: le rappel est dans le socle', async () => {
    /* Il était réservé à Pro et Enterprise par un tableau écrit en dur dans
       le service — donc absent des deux tables de `plan-features.ts`, vendu
       nulle part, et refusé à des clients qui ignoraient qu'il existait. Ce
       test épingle la décision du 29/09/2026: le rappel appartient au socle,
       et toute restriction future devra passer par `PLAN_CAPABILITIES`. */
    h.findMany.mockResolvedValue([]);
    await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    const where = h.findMany.mock.calls[0][0].where;
    expect(where.client).toBeUndefined();
    expect(where.status).toBe('confirmed');
  });

  it('rappelle un client Solo exactement comme un client Pro', async () => {
    h.findMany.mockResolvedValue([booking({ client: { ...client, planType: 'solo' } })]);
    const sent = await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    expect(sent).toBe(1);
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendSms).toHaveBeenCalledOnce();
  });

  it('ratisse large sur le jour, parce que le fuseau se décide en mémoire', async () => {
    h.findMany.mockResolvedValue([]);
    const now = new Date('2026-07-01T16:30:00Z');
    await bookingReminderService.processBookingReminders(now);
    const { gte, lte } = h.findMany.mock.calls[0][0].where.bookingDate;
    expect(now.getTime() - gte.getTime()).toBe(36 * 3600e3);
    expect(lte.getTime() - now.getTime()).toBe(36 * 3600e3);
  });
});

describe('processBookingReminders — deux instances, un seul rappel', () => {
  it('réserve la ligne AVANT d’envoyer', async () => {
    h.findMany.mockResolvedValue([booking()]);
    await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));

    const claim = h.updateMany.mock.calls[0][0];
    expect(claim.where).toMatchObject({ id: 'b1', reminderSent: false });
    expect(h.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(h.sendEmail.mock.invocationCallOrder[0]);
  });

  it('n’envoie rien quand une autre instance a déjà pris la ligne', async () => {
    h.findMany.mockResolvedValue([booking()]);
    h.updateMany.mockResolvedValue({ count: 0 });
    await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.sendSms).not.toHaveBeenCalled();
  });

  it('REND la ligne quand le SMS échoue, pour la reprendre au passage suivant', async () => {
    // Sans cette libération, une panne Twilio d'une minute effacerait les
    // rappels de la journée: marqués envoyés, jamais partis.
    h.findMany.mockResolvedValue([booking({ customerEmail: null })]);
    h.sendSms.mockResolvedValue(false);
    await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    expect(h.updateMany.mock.calls.at(-1)![0].data).toMatchObject({ smsReminderSent: false });
  });

  it("rend aussi la ligne quand l'envoi du SMS LÈVE", async () => {
    h.findMany.mockResolvedValue([booking({ customerEmail: null })]);
    h.sendSms.mockRejectedValue(new Error('twilio down'));
    await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    expect(h.updateMany.mock.calls.at(-1)![0].data).toMatchObject({ smsReminderSent: false });
  });

  it("rend la ligne quand l'email LÈVE", async () => {
    h.findMany.mockResolvedValue([booking({ customerPhone: null })]);
    h.sendEmail.mockRejectedValue(new Error('resend down'));
    await bookingReminderService.processBookingReminders(new Date('2026-07-01T16:30:00Z'));
    expect(h.updateMany.mock.calls.at(-1)![0].data).toMatchObject({ reminderSent: false, reminderSentAt: null });
  });
});

/**
 * La relance d'absence lisait `bookingDate` — le JOUR posé à midi UTC — pour
 * décider qu'un rendez-vous était passé « depuis plus de deux heures ». Un
 * rendez-vous AUJOURD'HUI à 20 h basculait donc en `no_show` dès 14 h, et son
 * client recevait un mail lui proposant de reprendre un rendez-vous qu'il
 * n'avait pas encore manqué. Le commerce, lui, voyait son créneau libéré.
 */
describe('processNoShowFollowUps — ne déclarer absent que ce qui l\u2019est', () => {
  it("ne déclare PAS absent un rendez-vous qui n'a pas encore eu lieu", async () => {
    h.findMany.mockResolvedValue([booking({ bookingTime: '20:00' })]);
    // 20 h à Bruxelles en juillet = 18:00 UTC. Il est 14:00 UTC: il reste 4 h.
    const done = await bookingReminderService.processNoShowFollowUps(new Date('2026-07-02T14:00:00Z'));
    expect(done).toBe(0);
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.sendReschedule).not.toHaveBeenCalled();
  });

  it('déclare absent trois heures après l\u2019heure dite, et relance', async () => {
    h.findMany.mockResolvedValue([booking()]); // 14:30 mural = 12:30 UTC
    const done = await bookingReminderService.processNoShowFollowUps(new Date('2026-07-02T15:30:00Z'));
    expect(done).toBe(1);
    expect(h.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'b1', status: 'confirmed' },
      data: { status: 'no_show' },
    });
    expect(h.sendReschedule).toHaveBeenCalledOnce();
  });

  it('attend le plancher de deux heures avant de constater quoi que ce soit', async () => {
    h.findMany.mockResolvedValue([booking()]);
    const done = await bookingReminderService.processNoShowFollowUps(new Date('2026-07-02T13:30:00Z'));
    expect(done).toBe(0);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it('relance un client Solo exactement comme un client Pro', async () => {
    /* Le filtre de forfait sautait aussi le passage en `no_show`: un commerce
       en Solo lisait un taux d'absence de zéro qui n'a jamais été vrai. */
    h.findMany.mockResolvedValue([booking({ client: { ...client, planType: 'solo' } })]);
    const done = await bookingReminderService.processNoShowFollowUps(new Date('2026-07-02T15:30:00Z'));
    expect(done).toBe(1);
    expect(h.sendReschedule).toHaveBeenCalledOnce();
  });

  it('ne fait rien quand une autre instance a déjà pris la ligne', async () => {
    h.findMany.mockResolvedValue([booking()]);
    h.updateMany.mockResolvedValue({ count: 0 });
    const done = await bookingReminderService.processNoShowFollowUps(new Date('2026-07-02T15:30:00Z'));
    expect(done).toBe(0);
    expect(h.sendReschedule).not.toHaveBeenCalled();
  });

  it('GARDE le statut absent même si le mail de relance échoue', async () => {
    /* Contrairement aux rappels: `no_show` est un fait constaté, le mail n'est
       qu'une courtoisie. Repasser le rendez-vous en « confirmé » pour un
       incident Resend mentirait sur ce qui s'est passé. */
    h.findMany.mockResolvedValue([booking()]);
    h.sendReschedule.mockRejectedValue(new Error('resend down'));
    const done = await bookingReminderService.processNoShowFollowUps(new Date('2026-07-02T15:30:00Z'));
    expect(done).toBe(1);
    expect(h.updateMany).toHaveBeenCalledOnce();
  });

  it('passe une heure illisible au lieu de déclarer une absence', async () => {
    h.findMany.mockResolvedValue([booking({ bookingTime: 'après-midi' })]);
    const done = await bookingReminderService.processNoShowFollowUps(new Date('2026-07-02T15:30:00Z'));
    expect(done).toBe(0);
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});
