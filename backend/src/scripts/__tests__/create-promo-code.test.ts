import { describe, it, expect } from 'vitest';
import { checkCode } from '../create-promo-code';

/**
 * La contrainte vient du SDK Stripe embarqué dans le dépôt
 * (`node_modules/stripe/types/PromotionCodesResource.d.ts`, champ `code`):
 *
 *   « Valid characters are lower case letters (a-z), upper case letters (A-Z),
 *     and digits (0-9). »
 *
 * Ni tiret, ni point. L'exemple que le script donnait lui-même, avec des tirets,
 * envoyait donc l'utilisateur dans le mur: l'API refusait, et le message de
 * Stripe nommait le champ sans nommer le caractère fautif.
 */
describe('le code promo, avant tout appel à Stripe', () => {
  it('accepte lettres et chiffres', () => {
    expect(checkCode('QWILLIOTEST2026').erreur).toBeNull();
    expect(checkCode('promo2026').code).toBe('PROMO2026');
  });

  it('refuse le point, et dit lequel', () => {
    const { erreur } = checkCode('QWILLIOTEST2026.');
    expect(erreur).toMatch(/« \. »/);
  });

  it('refuse le tiret, que le script proposait pourtant en exemple', () => {
    const { erreur } = checkCode('QWILLIO-TEST-2026');
    expect(erreur).toMatch(/« - »/);
  });

  it('propose la version nettoyée, pour que la commande suivante marche', () => {
    expect(checkCode('QWILLIO-TEST-2026.').erreur).toMatch(/--code=QWILLIOTEST2026/);
  });

  it('nomme chaque caractère fautif une seule fois', () => {
    const { erreur } = checkCode('A--B..C');
    expect(erreur).toMatch(/« - », « \. »/);
  });

  it('ignore les espaces autour, qui viennent du copier-coller', () => {
    expect(checkCode('  PROMO2026  ')).toEqual({ code: 'PROMO2026', erreur: null });
  });

  it('signale un code vide sans proposer de remplacement', () => {
    expect(checkCode('').erreur).toBe('vide');
  });

  it('ne propose rien quand il ne reste rien à proposer', () => {
    const { erreur } = checkCode('---');
    expect(erreur).toMatch(/Caractère\(s\) refusé\(s\)/);
    expect(erreur).not.toMatch(/--code=/);
  });
});
