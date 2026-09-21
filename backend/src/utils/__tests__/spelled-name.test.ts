import { describe, it, expect } from 'vitest';
import { normaliseSpelledName, spellOut, familyName, nameProblem, isPlaceholderName, spellingLostLetters } from '../spelled-name';

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

/**
 * L'ÉPELLATION QUI RACCOURCIT LE NOM (21/09/2026).
 *
 * Appel réel: « Virginie Barre » est entendu juste, l'agent lui demande
 * d'épeler, le transcripteur rend « BAR. », et c'est « Bar » qui part dans
 * l'agenda. L'étape qui existe pour fiabiliser le nom est celle qui l'a cassé.
 *
 * Ce que ces cas figent, c'est que la garde attrape CE défaut sans toucher aux
 * corrections que l'épellation existe pour capter.
 */
describe('spellingLostLetters', () => {
  it('voit une épellation tronquée: le cas réel du 21/09', () => {
    expect(spellingLostLetters('Virginie Barre', 'Virginie Bar')).toBe(true);
    expect(spellingLostLetters('Virginie Barre', 'Virginie Barr')).toBe(true);
    /* Les accents ne comptent pas: c'est la même lettre entendue. */
    expect(spellingLostLetters('Virginie Barré', 'Virginie Barr')).toBe(true);
  });

  it('ne touche PAS aux corrections qui ont fait naître l\'épellation', () => {
    /* Les deux appels réels qui ont posé « le nom épelé prime » (12 et 13/09).
       Si la garde attrapait ceux-là, elle annulerait la règle entière. */
    expect(spellingLostLetters('Paul', 'Polle')).toBe(false);
    expect(spellingLostLetters('Jean-Luc de la Ford', 'Jean-Luc Delaforge')).toBe(false);
    expect(spellingLostLetters('Mathieu', 'Matthieu')).toBe(false);
  });

  it('un vrai nom de famille court reste accepté', () => {
    /* « Bar », « Ng », « Li » sont de vrais noms. Une longueur minimale serait
       une politique inventée sur les noms des gens, et elle refuserait des
       appelants réels: la garde ne regarde que le RACCOURCISSEMENT. */
    expect(spellingLostLetters('Virginie Bar', 'Virginie Bar')).toBe(false);
    expect(spellingLostLetters('Lin Ng', 'Lin Ng')).toBe(false);
  });

  it('une épellation plus longue est une correction, pas une perte', () => {
    expect(spellingLostLetters('Virginie Bar', 'Virginie Barre')).toBe(false);
  });

  it('un AUTRE appelant que celui qui a épelé ne récupère pas son nom', () => {
    /* Un rendez-vous pris en cours d'appel pour un proche: « Marc Bar » n'est
       pas « Virginie Barre » raccourcie, et sans ce test il repartirait sous
       le nom de l'appelante — le mauvais nom sur la mauvaise réservation. */
    expect(spellingLostLetters('Virginie Barre', 'Marc Bar')).toBe(false);
  });

  it('un nom de famille seul ne se compare pas', () => {
    expect(spellingLostLetters('Virginie Barre', 'Bar')).toBe(false);
  });

  it('sans nom des deux côtés, elle ne conclut rien', () => {
    expect(spellingLostLetters('', 'Virginie Bar')).toBe(false);
    expect(spellingLostLetters('Virginie Barre', '')).toBe(false);
  });
});
