import { describe, it, expect } from 'vitest';
import { missingKeyBehaviour } from '../run-evals';

/**
 * Le harness sautait en sortant en 0: la CI affichait une étape verte en
 * n'ayant rien testé. Ces tests fixent la seule propriété qui compte — un saut
 * doit être VISIBLE, et doit pouvoir être rendu fatal.
 */
describe('missingKeyBehaviour', () => {
  it('rend l’absence de clé fatale quand EVALS_REQUIRE_KEY est posé', () => {
    const { fatal, message } = missingKeyBehaviour({ requireKey: true, isCI: true });
    expect(fatal).toBe(true);
    expect(message).toContain('ÉCHEC');
  });

  it('reste non bloquant par défaut, pour ne pas casser les forks', () => {
    expect(missingKeyBehaviour({ requireKey: false, isCI: false }).fatal).toBe(false);
  });

  it('émet une annotation GitHub quand il saute en CI', () => {
    // `::warning::` remonte dans l'interface de la PR; un console.log ordinaire
    // se perd dans les logs, ce qui est exactement le défaut qu'on corrige.
    const { message } = missingKeyBehaviour({ requireKey: false, isCI: true });
    expect(message.startsWith('::warning::')).toBe(true);
  });

  it('dit explicitement que rien n’a été prouvé', () => {
    for (const isCI of [true, false]) {
      const { message } = missingKeyBehaviour({ requireKey: false, isCI });
      expect(message).toMatch(/NON EXÉCUTÉES/);
      expect(message).toContain('ne prouve rien');
    }
  });
});
