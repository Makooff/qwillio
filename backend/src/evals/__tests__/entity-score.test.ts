import { describe, it, expect } from 'vitest';
import {
  entitiesFrom,
  entityMatches,
  scoreEntities,
  formatEntityReport,
  type EntityObservation,
} from '../entity-score';

/**
 * L'exactitude par entité, et les deux erreurs qu'elle sépare.
 *
 * Un taux global confond « l'agent a oublié de demander le numéro » et
 * « l'agent a inventé un numéro ». Les deux se corrigent à des endroits
 * différents — le prompt pour le premier, la validation pour le second — et un
 * seul chiffre ne dit pas lequel.
 */

describe('entitiesFrom', () => {
  it('réconcilie les noms d\'argument des différents outils', () => {
    /* `captureLead` dit `name`, `bookAppointment` dit `customerName`. Le
       scénario ne doit pas avoir à deviner lequel l'agent choisira. */
    expect(entitiesFrom([{ name: 'bookAppointment', args: { customerName: 'Julie Mertens' } }]).name)
      .toBe('Julie Mertens');
    expect(entitiesFrom([{ name: 'captureLead', args: { name: 'Julie Mertens' } }]).name)
      .toBe('Julie Mertens');
  });

  it('garde le PREMIER appel, pour que le score ne dépende pas de leur ordre', () => {
    const found = entitiesFrom([
      { name: 'bookAppointment', args: { customerName: 'Sophie' } },
      { name: 'captureLead', args: { name: 'Sofie' } },
    ]);
    expect(found.name).toBe('Sophie');
  });

  it('ignore une valeur vide au lieu de la compter comme captée', () => {
    // Un champ rendu vide est un champ absent: le compter ferait chuter la
    // précision au lieu du rappel, et désignerait le mauvais correctif.
    expect(entitiesFrom([{ name: 'captureLead', args: { name: '   ', phone: 42 } }])).toEqual({});
  });
});

describe('entityMatches', () => {
  it('compare un numéro sur ses chiffres, indicatif compris', () => {
    expect(entityMatches('phone', '+32 475 12 34 56', '0475123456')).toBe(true);
    expect(entityMatches('phone', '+32475123456', '+32475123457')).toBe(false);
  });

  it('ignore la ponctuation et les accents ailleurs', () => {
    expect(entityMatches('address', 'rue de la Loi 16', 'Rue de la Loi, 16')).toBe(true);
    expect(entityMatches('name', 'Frédéric Dhaenens', 'Frederic Dhaenens')).toBe(true);
  });

  it('ne confond pas deux adresses voisines', () => {
    expect(entityMatches('address', 'rue de la Loi 16', 'rue de la Loi 18')).toBe(false);
  });
});

describe('scoreEntities', () => {
  const obs: EntityObservation[] = [
    { kind: 'name', expected: 'Sophie Vandenbossche', actual: 'Sophie Vandenbossche' },
    { kind: 'name', expected: 'Marc Dhaenens', actual: 'Marc Danens' },
    { kind: 'phone', expected: '0475123456', actual: undefined },
    { kind: 'address', expected: 'rue de la Loi 16', actual: 'rue de la Loi 16' },
  ];

  it('sépare oublier de se tromper', () => {
    const report = scoreEntities(obs);

    // Deux noms attendus, deux captés, un juste: l'agent répond toujours et se
    // trompe une fois sur deux. C'est un problème de compréhension.
    expect(report.name).toMatchObject({ expected: 2, captured: 2, correct: 1, precision: 0.5, recall: 0.5 });

    // Un numéro attendu, aucun capté: l'agent n'a pas demandé. Précision
    // INCONNUE et non nulle — il ne s'est pas trompé, il n'a rien tenté.
    expect(report.phone).toMatchObject({ expected: 1, captured: 0, correct: 0, precision: null, recall: 0 });
  });

  it('laisse à null une entité qu\'aucun scénario ne couvre', () => {
    /* Zéro ferait sonner l'alarme sur une entité non testée, et une alarme qui
       sonne pour rien finit ignorée. */
    const report = scoreEntities(obs);
    expect(report.reason).toMatchObject({ expected: 0, precision: null, recall: null });
  });
});

describe('formatEntityReport', () => {
  it('ne montre que les entités réellement observées', () => {
    const text = formatEntityReport(scoreEntities([
      { kind: 'name', expected: 'Sophie', actual: 'Sophie' },
    ]));
    expect(text).toContain('name');
    expect(text).not.toContain('address');
  });

  it('le dit quand rien n\'a été couvert', () => {
    expect(formatEntityReport(scoreEntities([]))).toContain('aucune entité');
  });
});

/**
 * Le motif est de la prose, les quatre autres désignent quelque chose.
 *
 * L'outil demande « pourquoi ils appellent, une phrase ». L'agent a répondu
 * « Demande de rendez-vous pour un détartrage » à « je vous appelle pour un
 * détartrage »: exactement ce qu'on lui demande, et l'égalité stricte le
 * déclarait faux. Le scénario mesurait alors la concision de sa formulation.
 */
describe('la ligne de partage entre prose et identifiant', () => {
  it('accepte un motif reformulé, tant que la substance y est', () => {
    expect(entityMatches('reason', 'détartrage', 'Demande de rendez-vous pour un détartrage')).toBe(true);
    expect(entityMatches('reason', 'devis', 'Le client souhaite un devis pour des travaux')).toBe(true);
  });

  it('refuse un motif qui a perdu la substance', () => {
    expect(entityMatches('reason', 'détartrage', 'Demande de rendez-vous')).toBe(false);
  });

  it('reste strict sur ce qui DÉSIGNE quelque chose', () => {
    /* Une lettre de travers sur un nom ou un chiffre sur une adresse, et le
       rappel n'aboutit pas. L'inclusion y ferait passer n'importe quoi. */
    expect(entityMatches('name', 'Mertens', 'Julie Mertens')).toBe(false);
    expect(entityMatches('address', 'rue de la Loi 16', 'rue de la Loi 16 bis')).toBe(false);
  });
});
