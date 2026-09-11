import { describe, it, expect } from 'vitest';
import { transferAdvice, TRANSFER_CONSTRAINT, FORWARDING_CODES, type ForwardingType } from './forwarding-codes';

/**
 * L'aide du champ « Numéro de transfert ».
 *
 * Ce qu'elle empêche: qu'un client conclue que Qwillio exige deux numéros.
 * La règle réelle est plus simple, une même ligne ne peut pas être à la fois
 * celle qui renvoie vers l'IA et celle vers qui l'IA renvoie, et le refus de
 * boucle ne l'énonçait qu'APRÈS une saisie ratée.
 */

const TOUS: ForwardingType[] = ['', 'unconditional', 'busy', 'no_answer', 'scheduled'];

describe('transferAdvice', () => {
  it('couvre les cinq valeurs du sélecteur', () => {
    for (const t of TOUS) {
      expect(transferAdvice(t, true).constraint.length, `« ${t} » sans consigne`).toBeGreaterThan(20);
    }
  });

  it('reste aligné sur les types de renvoi réellement proposés', () => {
    /* Le vrai risque n'est pas qu'une phrase ressemble à une autre: c'est
       qu'un sixième renvoi apparaisse dans `FORWARDING_CODES` sans la sienne
       et retombe en silence sur la consigne générique. On compare donc les
       JEUX DE CLÉS, pas les textes. `unconditional` partage volontairement sa
       phrase avec « Automatique », et une comparaison de textes l'aurait
       signalé à tort. */
    const attendues = new Set<string>(['', ...Object.keys(FORWARDING_CODES)]);
    expect(new Set(Object.keys(TRANSFER_CONSTRAINT))).toEqual(attendues);
  });

  it('donne une RAISON différente selon le renvoi', () => {
    /* Une formule générique décrirait mal les quatre cas: occupé retombe sur
       une ligne occupée, non-réponse sonne dans le vide, inconditionnel boucle.
       Nommer la bonne raison est ce qui fait comprendre du premier coup. */
    expect(transferAdvice('busy', true).constraint).toMatch(/occupée/);
    expect(transferAdvice('no_answer', true).constraint).toMatch(/dans le vide/);
    expect(transferAdvice('unconditional', true).constraint).toMatch(/boucle/);
    expect(transferAdvice('scheduled', true).constraint).toMatch(/heures/);
  });

  it('traite « Automatique » comme le cas le plus exigeant', () => {
    /* Vide veut dire que le client ne nous a rien dit. Supposer le renvoi
       conditionnel laisserait passer la boucle sans un mot. */
    expect(transferAdvice('', true).constraint).toBe(transferAdvice('unconditional', true).constraint);
  });

  it('dit ce qu\'il se passe quand le champ est VIDE', () => {
    /* Sans cette phrase, un champ vide se lit comme un oubli. C'est un choix
       légitime: l'agent prend un message, ce qui est le comportement par
       défaut d'un client sans seconde ligne. */
    const vide = transferAdvice('no_answer', false);
    expect(vide.effect).toMatch(/message/);
    expect(vide.effect).not.toBe(transferAdvice('no_answer', true).effect);
  });

  it('n\'emploie aucun tiret cadratin', () => {
    // Banni par le guide du projet, y compris dans la copie produit.
    for (const t of TOUS) {
      const { effect, constraint } = transferAdvice(t, true);
      expect(effect + constraint).not.toContain('—');
    }
  });
});
