import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * `fr-discipline-agenda` est passé sur un commit et a échoué sur le suivant,
 * dont le diff n'était qu'un script autonome importé par personne: il ne
 * pouvait toucher ni le prompt ni les outils. La couleur de la CI dépendait
 * donc d'un tirage, et bloquait une PR au hasard.
 *
 * Ce test lit le SOURCE du harnais: ce qu'il vérifie est une propriété de sa
 * forme, et l'exécuter coûterait de vrais appels au modèle.
 */
describe('le harnais rejoue avant de conclure', () => {
  const source = readFileSync(join(__dirname, '..', 'run-evals.ts'), 'utf8');

  it('prend un second échantillon, et pas davantage', () => {
    // Deux, parce que le système sous test est probabiliste. Davantage
    // masquerait une vraie régression sous la répétition.
    expect(source).toMatch(/MAX_ATTEMPTS\s*=\s*2\b/);
  });

  it('ne touche pas à l\'assertion elle-même', () => {
    // Rejouer n'est pas assouplir: `checkAssertions` reste le seul juge, et
    // deux échecs consécutifs restent rouges.
    expect(source).toContain('checkAssertions(scenario, answer)');
    expect(source).toMatch(/if \(failed > 0\) process\.exit\(1\)/);
  });

  it('signale un scénario qui n\'a pas passé du premier coup', () => {
    // Vert aujourd'hui et fragile: le taux monte avant que la couleur change,
    // et c'est le seul moment où l'on peut agir avant de bloquer une PR.
    expect(source).toMatch(/comportement instable/);
  });
});
