import { describe, it, expect } from 'vitest';
import { spokenDigits } from '../spoken-numbers';

/**
 * L'ÉNONCÉ d'un nombre, écrit ici pour pouvoir couvrir 0 à 100 en entier.
 *
 * C'est la fonction inverse de celle qu'on teste, et c'est volontaire: le
 * critère demande les deux variantes de 0 à 100 sans trou, et une table écrite
 * à la main de deux cent deux entrées se relit moins bien qu'une règle.
 */
function spell(n: number, variant: 'fr' | 'be'): string {
  const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  if (n < 20) return units[n];
  if (n === 100) return 'cent';

  const tens = Math.floor(n / 10) * 10;
  const rest = n % 10;

  const name = (t: number): string =>
    ({ 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' } as Record<number, string>)[t];

  // Belgique: septante et nonante. France: la composition sur soixante et
  // quatre-vingt, qui est exactement ce qui manque au normaliseur de référence.
  if (variant === 'be') {
    if (tens === 70) return rest === 0 ? 'septante' : rest === 1 ? 'septante-et-un' : `septante-${units[rest]}`;
    if (tens === 80) return rest === 0 ? 'quatre-vingts' : `quatre-vingt-${units[rest]}`;
    if (tens === 90) return rest === 0 ? 'nonante' : rest === 1 ? 'nonante-et-un' : `nonante-${units[rest]}`;
  } else {
    if (tens === 70) return rest === 1 ? 'soixante-et-onze' : `soixante-${units[10 + rest]}`;
    if (tens === 80) return rest === 0 ? 'quatre-vingts' : `quatre-vingt-${units[rest]}`;
    if (tens === 90) return `quatre-vingt-${units[10 + rest]}`;
  }

  if (rest === 0) return name(tens);
  if (rest === 1) return `${name(tens)}-et-un`;
  return `${name(tens)}-${units[rest]}`;
}

describe('spokenDigits — 0 à 100, France et Belgique', () => {
  for (const variant of ['fr', 'be'] as const) {
    it(`couvre 0 à 100 sans trou (${variant})`, () => {
      const wrong: string[] = [];
      for (let n = 0; n <= 100; n++) {
        const said = spell(n, variant);
        const got = spokenDigits(said);
        if (got !== String(n)) wrong.push(`${n} dit « ${said} » → ${got || 'rien'}`);
      }
      expect(wrong).toEqual([]);
    });
  }

  /**
   * Les formes en « et un », que le normaliseur de référence en français ne
   * connaît pas: 71 et 91 en belge échouent silencieusement chez lui. C'est la
   * raison d'être de ce module, donc elles sont testées à part.
   */
  it('prend les formes belges en « et un », que NeMo rate', () => {
    expect(spokenDigits('septante et un')).toBe('71');
    expect(spokenDigits('nonante et un')).toBe('91');
    expect(spokenDigits('septante-et-un')).toBe('71');
    expect(spokenDigits('nonante-et-un')).toBe('91');
  });

  it('ne compose pas ce qui ne se dit pas', () => {
    // « septante-douze » n'existe pas: deux nombres dictés à la suite, et les
    // fondre en un seul fabriquerait un chiffre que personne n'a dit.
    expect(spokenDigits('septante douze')).toBe('7012');
    expect(spokenDigits('nonante quinze')).toBe('9015');
    // Alors que soixante et quatre-vingt, eux, absorbent la dizaine.
    expect(spokenDigits('soixante douze')).toBe('72');
    expect(spokenDigits('quatre-vingt-dix-sept')).toBe('97');
  });
});

describe('spokenDigits — une dictée de numéro', () => {
  const cases: Array<[string, string]> = [
    ['zéro quatre septante-cinq douze trente-quatre cinquante-six', '0475123456'],
    ['zéro deux cinq cent douze trente-quatre cinquante-six', '025123456'],
    ['zéro quatre nonante-et-un vingt-trois quarante-cinq soixante-sept', '0491234567'],
    ['zéro six douze trente-quatre cinquante-six septante-huit', '0612345678'],
    ['mon numéro c\'est le zéro quatre septante-cinq, douze, trente-quatre, cinquante-six', '0475123456'],
    ['zéro quatre double sept douze trente-quatre cinquante-six', '0477123456'],
    ['0475 12 34 56', '0475123456'],
    ['plus trente-deux quatre septante-cinq douze trente-quatre cinquante-six', '32475123456'],
  ];

  for (const [said, expected] of cases) {
    it(`« ${said} » → ${expected}`, () => {
      expect(spokenDigits(said)).toBe(expected);
    });
  }

  it('rend une chaîne vide quand rien n\'a été dicté', () => {
    expect(spokenDigits('je rappellerai plus tard merci')).toBe('');
  });
});
