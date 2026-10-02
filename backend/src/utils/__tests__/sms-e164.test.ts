import { describe, it, expect } from 'vitest';
import { toE164 } from '../sms-e164';

/* « Invalid 'To' Phone Number: 3248362XXXX [Twilio 21211] » (12/09/2026): le
   numéro de l'appelant arrive sans « + », Twilio le refuse, et l'agent avait
   promis le SMS.

   Puis « [SMS] destinataire illisible: « 0483620980 » » (02/10/2026): un
   appelant belge donne sa forme NATIONALE, et l'ancienne version rendait null
   faute de connaître le pays. La réservation était prise, la confirmation
   n'arrivait jamais, et rien ne le disait à l'appelant.

   La règle qui tient les deux: on ne DEVINE pas un indicatif, on le REÇOIT.
   Avec un pays connu le numéro national se convertit; sans pays il reste
   refusé, parce qu'un « 0 » de tête belge préfixé en +1 fabriquerait un
   numéro américain valide qui n'existe pas. */
describe('toE164', () => {
  it('remet le « + » devant un numéro réduit à ses chiffres', () => {
    expect(toE164('32483620980')).toBe('+32483620980');
    expect(toE164('+32 483 62 09 80')).toBe('+32483620980');
    expect(toE164('0032483620980')).toBe('+32483620980');
  });

  it("ne devine pas le pays d'un numéro local quand aucun pays n'est connu", () => {
    expect(toE164('0483620980', 'XX')).toBeNull();
    expect(toE164('inconnu')).toBeNull();
    expect(toE164(null)).toBeNull();
  });

  it('convertit un numéro national quand le pays est connu', () => {
    // Le cas de l'appel: un appelant belge sur une ligne belge.
    expect(toE164('0483620980', 'BE')).toBe('+32483620980');
    expect(toE164('0612345678', 'FR')).toBe('+33612345678');
    expect(toE164('0612345678', 'NL')).toBe('+31612345678');
  });

  it("retombe sur le marché principal quand le pays n'est pas transmis", () => {
    /* Le repli n'est pas un caprice: `BE` est le pays des lignes vendues, et la
       confirmation part vers un appelant qui vient d'appeler une ligne belge. */
    expect(toE164('0483620980')).toBe('+32483620980');
  });

  it('un numéro déjà international reste prioritaire sur le pays', () => {
    // Un appelant français sur une ligne belge: son « +33 » fait foi.
    expect(toE164('+33612345678', 'BE')).toBe('+33612345678');
  });
});
