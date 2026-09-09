import { describe, it, expect } from 'vitest';
import { annualTotalEur, annualMonthlyEquivalentEur, ANNUAL_DISCOUNT } from './pricing';

/**
 * Ces nombres sont ceux que STRIPE prélèvera, pas ceux qu'une page a envie
 * d'afficher. Le backend calcule `Math.round(mensuel * 12 * 0,8)`
 * (`backend/src/config/plans.ts`, `annualPriceEur`), et la page tarifs faisait
 * « arrondir le mensuel remisé, puis multiplier par douze ». Les deux ne
 * tombent pas au même endroit sur trois plans sur quatre: Solo était annoncé
 * 948 € et prélevé 950 €.
 *
 * Deux euros, mais c'est la maladie du 09/09 en miniature: le site dit un
 * nombre, la caisse en prend un autre. Ce test fige les quatre montants réels.
 */
describe("le tarif annuel annoncé est celui qui sera prélevé", () => {
  it('vaut douze mois remisés puis arrondis, comme le backend', () => {
    expect(annualTotalEur(99)).toBe(950);
    expect(annualTotalEur(249)).toBe(2390);
    expect(annualTotalEur(599)).toBe(5750);
    expect(annualTotalEur(1290)).toBe(12384);
  });

  it("ne retombe PAS sur l'ancien calcul, sur les plans où il divergeait", () => {
    const ancien = (m: number) => Math.round(m * (1 - ANNUAL_DISCOUNT)) * 12;
    expect(annualTotalEur(99)).not.toBe(ancien(99));
    expect(annualTotalEur(249)).not.toBe(ancien(249));
    expect(annualTotalEur(599)).not.toBe(ancien(599));
    // Enterprise tombait juste par hasard: 1290 × 0,8 est un entier.
    expect(annualTotalEur(1290)).toBe(ancien(1290));
  });

  it("dérive l'équivalent mensuel du total, jamais l'inverse", () => {
    expect(annualMonthlyEquivalentEur(99)).toBe(Math.round(950 / 12));
    expect(annualMonthlyEquivalentEur(599)).toBe(Math.round(5750 / 12));
  });

  it('remise de 20 %, la même valeur que côté backend', () => {
    expect(ANNUAL_DISCOUNT).toBe(0.2);
  });
});
