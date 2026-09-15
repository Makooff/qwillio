import { describe, it, expect } from 'vitest';
import { transferAdvice, TRANSFER_CONSTRAINT, FORWARDING_CODES, activationCode, activationLink, NO_ANSWER_DELAY_SECONDS, type ForwardingType } from './forwarding-codes';

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
    /* Inconditionnel: le téléphone ne sonne jamais, donc boucle. Conditionnel
       (15/09/2026): le téléphone sonne d'abord, donc le propre numéro du
       client CONVIENT, et c'est dit au lieu d'être refusé. */
    expect(transferAdvice('busy', true).constraint).toMatch(/occupée/);
    expect(transferAdvice('unconditional', true).constraint).toMatch(/boucle/);
    for (const t of ['busy', 'no_answer', 'scheduled'] as const) {
      expect(transferAdvice(t, true).constraint, t).toMatch(/Votre propre numéro convient/);
      expect(transferAdvice(t, true).constraint, t).not.toMatch(/autre ligne/);
    }
  });

  it('le renvoi sur non-réponse porte son délai, plus long que la sonnerie du transfert (20 s)', () => {
    /* Sans délai écrit, l'opérateur applique le sien (souvent 15 s) et le
       transfert vers le mobile du client reviendrait vers l'IA. */
    expect(NO_ANSWER_DELAY_SECONDS).toBeGreaterThan(20);
    expect(activationCode('no_answer', '+32460207490')).toBe('*61*+32460207490**30#');
    expect(activationLink('no_answer', '+32460207490')).toBe('tel:*61*+32460207490**30%23');
    expect(activationCode('scheduled', '+32460207490')).toBe('**004*+32460207490**30#');
    expect(activationCode('unconditional', '+32460207490')).toBe('*21*+32460207490#');
    expect(activationCode('busy', '+32460207490')).toBe('*67*+32460207490#');
    expect(activationCode('no_answer', '')).toBe('*61*NUMERO**30#');
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
