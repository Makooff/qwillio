import { describe, it, expect } from 'vitest';
import { numberWords, phoneWords, timeWords, priceWords, addressWords } from '../text-for-speech';
import { spokenDigits } from '../spoken-numbers';
import { parseSpokenPhone } from '../phone-spoken';

/**
 * La propriété qui rend tout ça vérifiable: ce que l'agent DIT doit pouvoir
 * être relu par notre propre lecteur, et rendre les mêmes chiffres.
 *
 * Un aller-retour qui se referme prouve les deux sens d'un coup, là où deux
 * tables écrites à la main ne prouvent que leur propre cohérence.
 */
describe('aller-retour: ce qui est dit se relit', () => {
  it('referme la boucle sur 0 à 999, dans les deux variantes', () => {
    const broken: string[] = [];
    for (const variant of ['fr', 'be'] as const) {
      for (let n = 0; n <= 999; n++) {
        const said = numberWords(n, variant);
        const read = spokenDigits(said);
        if (read !== String(n)) broken.push(`${variant} ${n} → « ${said} » → ${read || 'rien'}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

/**
 * Trente numéros relus, comme le demande le critère. Chiffre par chiffre: pour
 * CONFIRMER, l'appelant doit pouvoir suivre sans convertir, et c'est la seule
 * forme qui ne dépende pas de sa variante régionale.
 */
describe('phoneWords — la relecture de trente numéros', () => {
  const nationals = [
    '0475 12 34 56', '0486 23 45 67', '0497 34 56 78', '0468 45 67 89', '0455 56 78 90',
    '02 512 34 56', '02 640 12 34', '03 234 56 78', '04 223 45 67', '09 223 45 67',
    '081 23 45 67', '071 23 45 67', '056 23 45 67', '010 23 45 67', '011 23 45 67',
    '012 23 45 67', '013 23 45 67', '014 23 45 67', '015 23 45 67', '016 23 45 67',
    '019 23 45 67', '050 23 45 67', '051 23 45 67', '053 23 45 67', '054 23 45 67',
    '055 23 45 67', '057 23 45 67', '058 23 45 67', '060 23 45 67', '061 23 45 67',
  ];

  it('relit les trente sans perdre ni inventer un chiffre', () => {
    const broken: string[] = [];
    for (const national of nationals) {
      const said = phoneWords(national);
      const read = spokenDigits(said);
      const expected = national.replace(/\D/g, '');
      if (read !== expected) broken.push(`${national} → « ${said} » → ${read}`);
    }
    expect(broken).toEqual([]);
  });

  it('garde les groupes que l\'appelant a en tête, sous forme de pauses', () => {
    // La virgule EST la pause: comprise des deux synthétiseurs, sans balise.
    expect(phoneWords('0475 12 34 56')).toBe('zéro quatre sept cinq, un deux, trois quatre, cinq six');
  });

  it('se relit jusqu\'au numéro validé, bout en bout', () => {
    const said = phoneWords('0475 12 34 56');
    const back = parseSpokenPhone(said, { country: 'BE' });
    expect(back.ok && back.e164).toBe('+32475123456');
  });
});

describe('numberWords — la variante n\'est pas un détail de style', () => {
  it('dit septante et nonante à un Belge', () => {
    expect(numberWords(71, 'be')).toBe('septante-et-un');
    expect(numberWords(75, 'be')).toBe('septante-cinq');
    expect(numberWords(91, 'be')).toBe('nonante-et-un');
    expect(numberWords(99, 'be')).toBe('nonante-neuf');
  });

  it('dit soixante-quinze à un Français', () => {
    expect(numberWords(71, 'fr')).toBe('soixante-et-onze');
    expect(numberWords(75, 'fr')).toBe('soixante-quinze');
    expect(numberWords(91, 'fr')).toBe('quatre-vingt-onze');
    expect(numberWords(99, 'fr')).toBe('quatre-vingt-dix-neuf');
  });

  it('dit quatre-vingts pareil des deux côtés', () => {
    expect(numberWords(80, 'be')).toBe('quatre-vingts');
    expect(numberWords(80, 'fr')).toBe('quatre-vingts');
  });
});

describe('timeWords et priceWords', () => {
  const cases: Array<[string, string]> = [
    ['9h30', 'neuf heures et demie'],
    ['14h', 'quatorze heures'],
    ['14h15', 'quatorze heures et quart'],
    ['14h45', 'quinze heures moins le quart'],
    ['8h05', 'huit heures cinq'],
    ['1h', 'une heure'],
  ];
  for (const [raw, expected] of cases) {
    it(`dit « ${raw} » comme « ${expected} »`, () => expect(timeWords(raw)).toBe(expected));
  }

  it('dit les prix en euros, centimes compris', () => {
    expect(priceWords('45€')).toBe('quarante-cinq euros');
    expect(priceWords('75 EUR')).toBe('septante-cinq euros');
    expect(priceWords('12,50 €')).toBe('douze euros cinquante');
    expect(priceWords('1 euro')).toBe('un euro');
  });

  it('laisse le texte autour intact', () => {
    expect(timeWords('Nous ouvrons à 9h30 et fermons à 18h.')).toBe(
      'Nous ouvrons à neuf heures et demie et fermons à dix-huit heures.',
    );
  });
});

/**
 * Vingt adresses, comme le demande le critère. « bd » se lit « bédé » chez
 * tous les synthétiseurs testés: aucun modèle ne devinera « boulevard » sans
 * qu'on le lui écrive.
 */
describe('addressWords — vingt adresses', () => {
  const addresses: Array<[string, RegExp]> = [
    ['av. Louise 143', /avenue louise cent quarante-trois/i],
    ['bd Anspach 12', /boulevard anspach douze/i],
    ['bvd du Souverain 25', /boulevard du souverain vingt-cinq/i],
    ['ch. de Waterloo 71', /chaussée de waterloo septante-et-un/i],
    ['chée de Charleroi 90', /chaussée de charleroi nonante/i],
    ['pl. Flagey 7', /place flagey sept/i],
    ['imp. des Lilas 3', /impasse des lilas trois/i],
    ['sq. Marie-Louise 18', /square marie-louise dix-huit/i],
    ['st. Gilles 2', /saint gilles deux/i],
    ['ste. Catherine 5', /sainte catherine cinq/i],
    ['fg de Namur 44', /faubourg de namur quarante-quatre/i],
    ['rte de Liège 96', /route de liège nonante-six/i],
    ['rue Neuve 1000 Bruxelles', /rue neuve mille bruxelles/i],
    ['n° 42 rue Haute', /numéro quarante-deux rue haute/i],
    ['rue Haute 42 bte 3', /boîte trois/i],
    ['rue Haute 42 étg. 2', /étage deux/i],
    ['M. Dupont, rue Verte 8', /monsieur dupont/i],
    ['Mme Leroy, rue Verte 9', /madame leroy/i],
    ['Dr. Peeters, av. de la Gare 21', /docteur peeters/i],
    ['Mlle Martin, pl. du Jeu de Balle 6', /mademoiselle martin/i],
  ];

  for (const [raw, expected] of addresses) {
    it(`dit « ${raw} »`, () => expect(addressWords(raw)).toMatch(expected));
  }

  it('ne coupe pas un mot qui commence comme une abréviation', () => {
    // « av. » ne doit pas manger « avenue », ni « pl. » manger « plusieurs ».
    expect(addressWords('avenue des Arts 3')).toMatch(/^avenue des arts trois$/i);
    expect(addressWords('plusieurs entrées')).toBe('plusieurs entrées');
  });
});
