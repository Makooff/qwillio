import { describe, it, expect } from 'vitest';
import { normaliseSpelledName, spellOut, familyName, nameProblem, isPlaceholderName } from '../spelled-name';

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

  it('un nom ne contient jamais de chiffre: « Mar0n » est « Maron », « MASR0N » « Masron »', () => {
    expect(normaliseSpelledName('Marc Mar0n')).toBe('Marc Maron');
    expect(normaliseSpelledName('MASR0N')).toBe('Masron');
    expect(normaliseSpelledName('0livier Dupont')).toBe('Olivier Dupont');
  });

  it('lit « VAN espace H0LD » comme « Van Hold »: capitales recollées, 0 pour O, « espace » dit', () => {
    expect(normaliseSpelledName('Stéphane VAN espace H0LD')).toBe('Stéphane Van Hold');
    expect(normaliseSpelledName('Stéphane Van H 0 L D')).toBe('Stéphane Van Hold');
  });

  it('ne recolle pas une initiale isolée', () => {
    expect(normaliseSpelledName('J. Dupont')).toBe('J Dupont');
  });
});

describe('spellOut', () => {
  it('épelle 0 comme la lettre O, au lieu de la perdre ou de dire « zéro »', () => {
    expect(spellOut('Mar0n')).toBe('M-A-R-O-N');
  });

  it("épelle le nom de famille pour que l'agent le dise lettre par lettre", () => {
    expect(spellOut(familyName('Mathieu Polle'))).toBe('P-O-L-L-E');
    expect(spellOut(familyName('Jean-Luc Van Damme'))).toBe('D-A-M-M-E');
    expect(spellOut('Émile')).toBe('É-M-I-L-E');
  });
});

/* Appel réel du 15/09/2026: le modèle a réservé au nom de « client » pour
   remplir le champ obligatoire, puis a annoncé la réservation. */
describe('nameProblem: un nom bidon vaut absence de nom', () => {
  it('reconnaît les remplissages du modèle, avec ou sans article ni titre', () => {
    for (const n of ['client', 'Client', 'le client', 'Inconnu', 'Monsieur', 'Madame', 'unknown', 'Caller', 'the caller', 'N/A', 'Prénom Nom', 'Monsieur le client', 'Mr. Unknown']) {
      expect(isPlaceholderName(n), n).toBe(true);
      expect(nameProblem(n), n).toBe('placeholder');
    }
  });
  it('un prénom seul manque le nom de famille', () => {
    expect(nameProblem('Marc')).toBe('firstOnly');
    expect(nameProblem('Monsieur Marc')).toBe('firstOnly');
  });
  it('un vrai nom passe, titre ou pas, particule ou pas', () => {
    for (const n of ['Marc Dupont', 'Madame Marie Client', 'Jean-Luc de la Forge', 'Mr Van Hold', 'Mathieu Polle']) {
      expect(nameProblem(n), n).toBeNull();
    }
  });
  it('vide: manquant', () => {
    expect(nameProblem('')).toBe('missing');
    expect(nameProblem('   ')).toBe('missing');
  });
});
