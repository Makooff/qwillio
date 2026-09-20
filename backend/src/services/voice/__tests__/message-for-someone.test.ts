import { describe, it, expect } from 'vitest';
import { buildSms, type LeadForAlert } from '../lead-alert.service';

/**
 * CE QU'UNE RÉCEPTIONNISTE HUMAINE NOTE ET QUE L'AGENT NE NOTAIT PAS
 * (20/09/2026).
 *
 * « Je voudrais parler à Marie. » Une humaine note le destinataire, et c'est
 * ce qui rend le message utilisable: dans un commerce à trois personnes, un
 * message sans destinataire oblige le gérant à rappeler pour savoir à qui il
 * s'adresse.
 *
 * « Rappelez-moi après 17h. » Elle le note aussi, dans les mots de l'appelant,
 * et elle ne le convertit pas en date: « demain » dépend du moment où on lit.
 */
const lead = (over: Partial<LeadForAlert> = {}): LeadForAlert => ({
  name: 'Jean-Luc de la Forge',
  email: null,
  phone: '32483620980',
  reason: 'Veut un devis pour un détartrage',
  urgency: 'normal',
  ...over,
});

describe('le message dit pour qui et pour quand', () => {
  it('porte le destinataire quand l\'appelant a demandé quelqu\'un', () => {
    const sms = buildSms(lead({ forPerson: 'Marie' }), null, 'fr');
    expect(sms).toContain('Pour : Marie');
  });

  it('porte le moment demandé, dans les mots de l\'appelant', () => {
    const sms = buildSms(lead({ callbackWhen: 'après 17h' }), null, 'fr');
    expect(sms).toContain('Quand : après 17h');
  });

  it('ne dit rien quand rien n\'a été demandé', () => {
    // Deux lignes vides dans chaque SMS le rendraient plus long pour rien.
    const sms = buildSms(lead(), null, 'fr');
    expect(sms).not.toContain('Pour :');
    expect(sms).not.toContain('Quand :');
  });

  it('garde l\'anglais aligné', () => {
    const sms = buildSms(lead({ forPerson: 'Marie', callbackWhen: 'after 5pm' }), null, 'en');
    expect(sms).toContain('For: Marie');
    expect(sms).toContain('When: after 5pm');
  });
});

describe('le numéro survit, quoi qu\'il arrive', () => {
  it('c\'est le MOTIF qui se fait couper, jamais le reste', () => {
    /* La règle existait déjà et elle a coûté un correctif: un motif bavard
       emportait la seule partie inutilisable si elle est coupée, le numéro.
       Deux champs de plus dans la partie réservée ne doivent pas rouvrir ce
       trou. */
    const sms = buildSms(
      lead({ reason: 'x'.repeat(600), forPerson: 'Marie-Christine', callbackWhen: 'après 17h30 en semaine' }),
      null,
      'fr',
    );
    expect(sms.length).toBeLessThanOrEqual(320);
    expect(sms).toContain('32483620980');
    expect(sms).toContain('Pour : Marie-Christine');
    expect(sms).toContain('Quand : après 17h30 en semaine');
  });

  it('reste dans deux segments SMS', () => {
    const sms = buildSms(
      lead({ reason: 'y'.repeat(400), forPerson: 'Marie', callbackWhen: 'demain matin' }),
      '32499000111',
      'fr',
    );
    expect(sms.length).toBeLessThanOrEqual(320);
  });
});
