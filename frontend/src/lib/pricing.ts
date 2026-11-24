/**
 * Le tarif annuel, calculé EXACTEMENT comme le backend le facture.
 *
 * La page tarifs faisait « arrondir le mensuel remisé, puis multiplier par
 * douze », le backend fait « remiser le total annuel, puis arrondir ». Sur trois
 * plans sur quatre, les deux ne tombent pas au même endroit: Solo était annoncé
 * 948 € et prélevé 950 €. Deux euros, mais c'est la même maladie que le prix
 * affiché contre le prix prélevé: le site dit un nombre, la caisse en prend un
 * autre, et c'est le client qui découvre l'écart.
 *
 * La formule vit donc ici, une seule fois, et elle recopie `annualPriceEur`
 * (`backend/src/config/plans.ts`) au caractère près. Les deux ne peuvent pas
 * être fusionnées, elles vivent dans deux déploiements: elles peuvent au moins
 * être identiques et le dire.
 */

/** Remise annuelle, la même que `ANNUAL_DISCOUNT` côté backend. */
export const ANNUAL_DISCOUNT = 0.2;

/** Ce que Stripe prélève en une fois pour douze mois. */
export function annualTotalEur(monthlyPriceEur: number): number {
  return Math.round(monthlyPriceEur * 12 * (1 - ANNUAL_DISCOUNT));
}

/**
 * Le mensuel ÉQUIVALENT en annuel, dérivé du total réellement prélevé.
 *
 * Dérivé, et non recalculé: un client qui divise le total annoncé par douze doit
 * retomber sur ce chiffre, sinon il a raison de se méfier.
 */
export function annualMonthlyEquivalentEur(monthlyPriceEur: number): number {
  return Math.round(annualTotalEur(monthlyPriceEur) / 12);
}
