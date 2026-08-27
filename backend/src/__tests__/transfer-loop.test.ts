import { describe, it, expect } from 'vitest';
import { wouldLoop } from '../services/voice/transfer-loop';

/**
 * La boucle de transfert.
 *
 * Le numéro pro est renvoyé vers l'IA. Si l'IA transfère vers CE numéro,
 * l'appel repart vers elle. L'appelant entend la réceptionniste se présenter en
 * boucle, les minutes se facturent, et personne ne décroche jamais. Rien ne
 * gardait ce cas, et il ne se voit pas depuis un tableau de bord: il se voit
 * parce qu'un client a raccroché.
 */

describe('transférer vers une ligne qui renvoie vers nous', () => {
  it('refuse la ligne attribuée par la plateforme', () => {
    expect(wouldLoop('+3225550011', { vapiPhoneNumber: '+3225550011' })).toBe(true);
  });

  it('refuse un numéro que le client a déclaré et renvoyé', () => {
    expect(wouldLoop('+32470112233', {
      vapiPhoneNumber: '+3225550011',
      declared: [{ number: '+32470112233' }],
    })).toBe(true);
  });

  it("voit la boucle malgré une écriture différente du MÊME téléphone", () => {
    /* C'est le cas qui passerait à travers une comparaison de chaînes, et c'est
       exactement celui qu'un client produit: il tape son numéro à la main dans
       un écran et au format international dans l'autre. */
    expect(wouldLoop('0470 11 22 33', { declared: [{ number: '+32470112233' }] })).toBe(true);
    expect(wouldLoop('+32 470 11 22 33', { declared: [{ number: '0470112233' }] })).toBe(true);
    expect(wouldLoop('0032470112233', { declared: [{ number: '+32470112233' }] })).toBe(true);
  });
});

describe('ce qui doit rester autorisé', () => {
  it('laisse passer une SECONDE ligne, qui est la solution', () => {
    // Ligne pro renvoyée vers l'IA, transfert vers le mobile perso: c'est le
    // montage correct, et il ne doit jamais être refusé.
    expect(wouldLoop('+32470999888', {
      vapiPhoneNumber: '+3225550011',
      declared: [{ number: '+3225881904' }],
    })).toBe(false);
  });

  it('ne bloque rien quand le client n\'a encore aucune ligne', () => {
    expect(wouldLoop('+32470112233', {})).toBe(false);
    expect(wouldLoop('+32470112233', { vapiPhoneNumber: null, declared: [] })).toBe(false);
  });

  it('ignore un champ vide plutôt que de tout refuser', () => {
    expect(wouldLoop('', { vapiPhoneNumber: '+3225550011' })).toBe(false);
    expect(wouldLoop(null, { vapiPhoneNumber: '+3225550011' })).toBe(false);
    expect(wouldLoop(undefined, { vapiPhoneNumber: '+3225550011' })).toBe(false);
  });

  it("ne fait pas correspondre un numéro COURT à tout le monde", () => {
    /* Sans le plancher de huit chiffres, un « 4455 » saisi par erreur serait le
       suffixe de la moitié des numéros du pays et bloquerait des transferts
       parfaitement valides. */
    expect(wouldLoop('4455', { declared: [{ number: '+3223334455' }] })).toBe(false);
  });
});
