/**
 * Les prix et ce qu'ils achètent, séparés de la page qui les affiche.
 *
 * Sortis de `Pricing.tsx` parce qu'ils sont des DONNÉES: les y laisser rendait
 * impossible de les vérifier sans monter la page entière, et donc GSAP, le
 * ScrollTrigger et un DOM. Un argument commercial qu'on ne peut pas tester est
 * un argument qu'on finit par ne plus tester.
 */

export const PLAN_MONTHLY_EUR = { solo: 99, starter: 249, pro: 599, enterprise: 1290 } as const;

/**
 * Les minutes incluses, à côté des prix et pour la même raison.
 *
 * Le prix d'abonnement seul ne se compare pas: une offre à 29 € qui contient
 * 50 minutes coûte 0,58 € la minute, presque le double d'un abonnement à 99 €
 * qui en contient 250. Les deux tables sont indissociables, et les séparer
 * ferait de nouveau afficher un prix sans dire ce qu'il achète.
 */
export const PLAN_MINUTES = { solo: 250, starter: 750, pro: 2000, enterprise: 5000 } as const;

/** Le dépassement, par palier. Doit rester AU-DESSUS du prix effectif. */
export const PLAN_OVERAGE_EUR = { solo: 0.45, starter: 0.39, pro: 0.35, enterprise: 0.30 } as const;

/**
 * Le prix réellement payé par minute incluse, arrondi au centime.
 *
 * Pure et exportée pour être vérifiable: c'est l'argument commercial de la
 * page, et une erreur d'arrondi y coûte plus qu'un défaut d'affichage.
 */
export function effectivePerMinute(monthlyPrice: number, minutes: number): number {
  return Math.round((monthlyPrice / minutes) * 100) / 100;
}
