import { describe, it, expect } from 'vitest';
import { PLAN_MONTHLY_EUR, PLAN_MINUTES, PLAN_OVERAGE_EUR, effectivePerMinute } from './pricing-plans';

/**
 * Le prix effectif à la minute.
 *
 * La page n'affichait que le prix d'abonnement, or c'est le seul chiffre qui ne
 * se compare pas: une offre à 29 € qui contient 50 minutes coûte 0,58 € la
 * minute, presque le double d'un abonnement à 99 € qui en contient 250. Un
 * prospect qui aligne deux grilles prend la moins chère à l'affichage et se
 * trompe, et la comparaison est perdue sans avoir eu lieu.
 */

describe('le prix effectif à la minute', () => {
  it('rend ce que le client paie vraiment, palier par palier', () => {
    expect(effectivePerMinute(99, 250)).toBe(0.4);
    expect(effectivePerMinute(249, 750)).toBe(0.33);
    expect(effectivePerMinute(599, 2000)).toBe(0.3);
    expect(effectivePerMinute(1290, 5000)).toBe(0.26);
  });

  it('baisse à chaque palier, sinon la grille ne récompense pas le volume', () => {
    /* Un palier supérieur plus cher à la minute que le précédent est une
       erreur de grille, pas un choix: personne ne monterait. */
    const ids = ['solo', 'starter', 'pro', 'enterprise'] as const;
    const prix = ids.map(id => effectivePerMinute(PLAN_MONTHLY_EUR[id], PLAN_MINUTES[id]));
    for (let i = 1; i < prix.length; i++) {
      expect(prix[i], `${ids[i]} coûte plus cher à la minute que ${ids[i - 1]}`).toBeLessThan(prix[i - 1]);
    }
  });

  it('reste sous le tarif de dépassement du même palier', () => {
    /* Sinon dépasser son forfait coûterait MOINS cher que le forfait lui-même,
       et le client rationnel prendrait le palier le plus bas puis dépasserait. */
    const overage = PLAN_OVERAGE_EUR;
    for (const id of ['solo', 'starter', 'pro', 'enterprise'] as const) {
      expect(effectivePerMinute(PLAN_MONTHLY_EUR[id], PLAN_MINUTES[id])).toBeLessThan(overage[id]);
    }
  });

  it("suit la remise annuelle au lieu d'annoncer le tarif mensuel", () => {
    // La vue annuelle applique 20 % de remise: le prix à la minute doit suivre,
    // sinon la page annonce un chiffre que la facture ne portera pas.
    const annuel = Math.round(PLAN_MONTHLY_EUR.solo * 0.8);
    expect(effectivePerMinute(annuel, PLAN_MINUTES.solo))
      .toBeLessThan(effectivePerMinute(PLAN_MONTHLY_EUR.solo, PLAN_MINUTES.solo));
  });

  it('couvre exactement les mêmes paliers dans les deux tables', () => {
    /* Elles étaient recopiées à deux endroits du même fichier, et la page
       Partenaires ne lisait que la première: un prix changé d'un seul côté
       aurait fait citer à l'affiliation un tarif que la page tarifs
       n'affichait pas. */
    expect(Object.keys(PLAN_MONTHLY_EUR)).toEqual(Object.keys(PLAN_MINUTES));
  });
});
