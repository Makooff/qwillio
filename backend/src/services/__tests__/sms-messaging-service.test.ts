import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ── LE SMS PASSE PAR LE SERVICE DE MESSAGERIE QUAND IL EXISTE ───────────────
 *
 * Le motif d'échec, répété 15 fois entre le 30/09 et le 05/10 — dont le 05/10 à
 * 10h23, sur le même appel qui a réussi en e-mail :
 *
 *   SMS send failed: 'From' phone number routing configuration is incorrect
 *   [Twilio 21663]
 *
 * Ce n'était pas le DESTINATAIRE. C'est l'EXPÉDITEUR : un numéro mobile belge
 * (04xx) passé en `from` nu n'a pas de route d'envoi tant qu'aucun service de
 * messagerie ne le déclare comme expéditeur. Le numéro existait, portait la
 * voix, et refusait le SMS.
 *
 * Un Messaging Service (`MG…`) est la pièce qui manquait. Quand son SID est
 * configuré, on envoie PAR LUI et on ne passe plus `from` du tout : Twilio
 * choisit l'expéditeur dans le pool.
 *
 * On vérifie aussi ce qui NE change PAS : sans SID configuré, le comportement
 * d'avant est conservé à l'identique, y compris l'envoi depuis le numéro propre
 * d'un client — une ligne qu'un service imposerait à sa place.
 */

const { findFirst, clientFindUnique } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  clientFindUnique: vi.fn(),
}));

/* Les écritures d'après-envoi rendent une promesse : le service les chaîne en
   `.catch()`. Un `vi.fn()` nu rend `undefined`, et le test échouerait APRÈS
   l'envoi — sur un détail qui n'est pas le sujet. */
vi.mock('../../config/database', () => ({
  prisma: {
    phoneNumberStock: { findFirst },
    smsLog: { create: vi.fn().mockResolvedValue({}) },
    analyticsDaily: { upsert: vi.fn().mockResolvedValue({}) },
    client: { findUnique: clientFindUnique },
  },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* Un double de Twilio qui RETIENT les arguments. C'est tout l'intérêt du test :
   `messages.create` est le seul endroit où la différence se voit, et c'est
   exactement ce que l'API réelle a refusé pendant six jours.

   Injecté directement plutôt que par `vi.mock('twilio')` : le service charge la
   librairie par `require('twilio')` (voir `getTwilioClient`), et un mock ESM
   n'atteint pas un `require`. Le service expose `twilioClient` en privé, et on
   le pose — c'est le chemin prévu par son propre cache. */
const { creer } = vi.hoisted(() => ({ creer: vi.fn() }));

const { env } = await import('../../config/env');
const { smsService } = await import('../sms.service');

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null);
  clientFindUnique.mockReset().mockResolvedValue({ country: 'BE' });
  creer.mockReset().mockResolvedValue({ sid: 'SM' + '0'.repeat(32) });
  smsService['twilioClient'] = { messages: { create: creer } };
  (env as any).TWILIO_MESSAGING_SERVICE_SID = '';
  (env as any).TWILIO_PHONE_NUMBER = '+32' + '483620980';
  (env as any).SMS_ENABLED = true;
});

const args = () => creer.mock.calls[0][0] as Record<string, unknown>;

describe('sendSMS — expéditeur', () => {
  it('envoie par le service de messagerie quand son SID est configuré', async () => {
    (env as any).TWILIO_MESSAGING_SERVICE_SID = 'MG' + '1'.repeat(32);

    await smsService.sendSMS('+32' + '483620980', 'Bonjour');

    /* `messagingServiceSid` ET PAS `from` : passer les deux fait refuser
       l'envoi par Twilio, et un `from` en plus annulerait tout l'intérêt du
       service — c'est lui qui choisit l'expéditeur dans son pool. */
    expect(args().messagingServiceSid).toBe('MG' + '1'.repeat(32));
    expect(args().from).toBeUndefined();
  });

  it('sans SID configuré, le comportement d’avant est conservé', async () => {
    (env as any).TWILIO_MESSAGING_SERVICE_SID = '';

    await smsService.sendSMS('+32' + '483620980', 'Bonjour');

    // Le `from` nu : ce qui échouait, mais ce qui marchait pour les autres.
    expect(args().from).toBe('+32' + '483620980');
    expect(args().messagingServiceSid).toBeUndefined();
  });

  it('un SID vide ne compte pas comme configuré', async () => {
    /* Une variable posée à vide dans Render est le cas le plus courant d'une
       « configuration faite » qui ne fait rien. `'' || null` doit valoir null,
       pas une chaîne vide envoyée comme SID. */
    (env as any).TWILIO_MESSAGING_SERVICE_SID = '';

    await smsService.sendSMS('+32' + '483620980', 'Bonjour');

    expect(args().messagingServiceSid).toBeUndefined();
    expect(args().from).toBeTruthy();
  });

  it('envoie toujours au même destinataire, quel que soit le chemin', async () => {
    (env as any).TWILIO_MESSAGING_SERVICE_SID = 'MG' + '1'.repeat(32);

    await smsService.sendSMS('+32' + '483620980', 'Bonjour');

    // Le correctif ne doit rien changer au numéro joint.
    expect(args().to).toBe('+32' + '483620980');
  });
});
