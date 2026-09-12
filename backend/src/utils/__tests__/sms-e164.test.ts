import { describe, it, expect } from 'vitest';
import { toE164 } from '../sms-e164';

/* « Invalid 'To' Phone Number: 3248362XXXX [Twilio 21211] » (12/09/2026): le
   numéro de l'appelant arrive sans « + », Twilio le refuse, et l'agent avait
   promis le SMS. */
describe('toE164', () => {
  it('remet le « + » devant un numéro réduit à ses chiffres', () => {
    expect(toE164('32483620980')).toBe('+32483620980');
    expect(toE164('+32 483 62 09 80')).toBe('+32483620980');
    expect(toE164('0032483620980')).toBe('+32483620980');
  });

  it("ne devine pas le pays d'un numéro local, ni d'un texte", () => {
    expect(toE164('0483620980')).toBeNull();
    expect(toE164('inconnu')).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});
