import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { policyNote } from '../tool-runtime.service';

/**
 * « NOS RENDEZ-VOUS SE PRENNENT A L'HEURE PILE » (relevé le 16/09, corrigé le
 * 20/09/2026).
 *
 * Personne n'a jamais écrit cette règle. C'est la GRANULARITÉ de nos créneaux,
 * une commodité de calcul, que le modèle a lue comme une politique de
 * l'entreprise et annoncée à un client.
 *
 * Même famille que la fermeture inventée (6duoquinquagesies): le modèle comble
 * un vide avec une règle plausible. Un fait faux sur l'entreprise, dit à
 * quelqu'un qui voulait venir, coûte plus cher qu'un créneau manqué, parce que
 * l'appelant repart en le croyant.
 */
describe('la liste des créneaux ne fonde aucune politique', () => {
  it('dit que ce sont des créneaux libres, pas une règle de la maison', () => {
    const fr = policyNote('fr');
    expect(fr).toMatch(/LIBRES/);
    expect(fr).toMatch(/pas une regle/i);
  });

  it("nomme les politiques exactes que le modèle a inventées ou pourrait inventer", () => {
    /* « heure pile » est le cas relevé. Les trois autres sont de la même
       famille: une contrainte de notre calcul prise pour une règle du
       commerce. Les nommer vaut mieux qu'un « n'invente rien » abstrait, qui
       n'a pas empêché celle-ci. */
    const fr = policyNote('fr');
    expect(fr).toMatch(/heure pile/);
    expect(fr).toMatch(/duree/);
    expect(fr).toMatch(/delai/);
  });

  it("garde l'anglais aligné sur le français", () => {
    // Deux rédactions à la main pour la même règle divergent (6vicies).
    const en = policyNote('en');
    expect(en).toMatch(/FREE slots/);
    expect(en).toMatch(/on the hour/);
    expect(en).toMatch(/no booking\s+policy|no booking policy/);
  });

  it('coûte zéro caractère au prompt rejoué à chaque tour', () => {
    /* Elle vit dans le RÉSULTAT D'OUTIL. C'est la forme qui a marché pour
       `weekdayNote` et `windowNote`, et le plafond du prompt est déjà à 3900. */
    const PROMPT = readFileSync(join(__dirname, '..', 'system-prompt.ts'), 'utf8');
    expect(PROMPT).not.toMatch(/heure pile/);
  });

  it('est branchée sur le résultat de checkAvailability', () => {
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const RUNTIME = stripComments(
      readFileSync(join(__dirname, '..', 'tool-runtime.service.ts'), 'utf8'),
    );
    expect(RUNTIME).toMatch(/\+ policyNote\(profile\.language\)/);
  });
});
