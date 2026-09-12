import { describe, it, expect } from 'vitest';
import { normaliseSpelledName, spellOut, familyName } from '../spelled-name';

/**
 * Un nom épelé arrive lettre par lettre; il faut le recoller. « Polle »
 * entendu « Paul » (appel réel, 12/09/2026): la relecture fait épeler, et
 * l'épellation ne doit pas finir telle quelle dans l'agenda.
 */
describe('normaliseSpelledName', () => {
  it('recolle une suite de lettres isolées', () => {
    expect(normaliseSpelledName('Mathieu P O L L E')).toBe('Mathieu Polle');
    expect(normaliseSpelledName('P. O. L. L. E.')).toBe('Polle');
    expect(normaliseSpelledName('p-o-l-l-e')).toBe('Polle');
  });

  it('laisse un nom ordinaire tel quel', () => {
    expect(normaliseSpelledName('Mathieu Polle')).toBe('Mathieu Polle');
    expect(normaliseSpelledName('Jean-Luc Van Damme')).toBe('Jean-Luc Van Damme');
  });

  it('ne recolle pas une initiale isolée', () => {
    expect(normaliseSpelledName('J. Dupont')).toBe('J Dupont');
  });
});

describe('spellOut', () => {
  it("épelle le nom de famille pour que l'agent le dise lettre par lettre", () => {
    expect(spellOut(familyName('Mathieu Polle'))).toBe('P-O-L-L-E');
    expect(spellOut(familyName('Jean-Luc Van Damme'))).toBe('D-A-M-M-E');
    expect(spellOut('Émile')).toBe('É-M-I-L-E');
  });
});
