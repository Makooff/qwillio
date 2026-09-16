import { describe, it, expect } from 'vitest';
import {
  ALL_PLANS, classicCost, flatOptionPriceEur, inclusionCostEur, planMargin,
  REALTIME_RATES, superagentCost, surchargeToKeepMarginEur,
} from '../voice-economics';
import { PLANS } from '../plans';

/**
 * Le prix de l'option se CALCULE. Ces tests tiennent les trois choses qui, si
 * elles glissent, font poser un prix qui perd de l'argent sans qu'on le sache.
 */

const MINI = 'gpt-realtime-mini-2025-12-15';
const GROS = 'gpt-realtime-2';
const DEFAUT_DU_CODE = 'gpt-realtime-2025-08-28';

describe('un tarif ne se déduit pas', () => {
  it('REFUSE de calculer sur un modèle dont le tarif n\'a jamais été relevé', () => {
    /* C'est 6quinvicies appliqué à l'argent: une valeur inventée qui a l'air
       d'une lecture coûte plus cher que pas de valeur du tout. Et c'est le
       DÉFAUT du code qui est dans ce cas, donc le calcul doit le dire fort. */
    expect(REALTIME_RATES[DEFAUT_DU_CODE]).toBeNull();
    const cost = superagentCost(DEFAUT_DU_CODE);
    expect(cost).toHaveProperty('unknownRate');
    expect(surchargeToKeepMarginEur(DEFAUT_DU_CODE)).toHaveProperty('unknownRate');
    expect(flatOptionPriceEur(PLANS.solo, DEFAUT_DU_CODE)).toHaveProperty('unknownRate');
  });

  it('refuse aussi un modèle inconnu du module, sans le confondre avec l\'autre cas', () => {
    const cost = superagentCost('gpt-realtime-3-imaginaire') as { unknownRate: string };
    expect(cost.unknownRate).toMatch(/n'est pas un modèle temps réel connu/);
  });

  it('chaque tarif retenu porte sa source', () => {
    for (const [model, rate] of Object.entries(REALTIME_RATES)) {
      if (rate) expect(rate.source.length).toBeGreaterThan(10);
      else expect(model).toBe(DEFAUT_DU_CODE);
    }
  });
});

describe('le coût de la chaîne classique', () => {
  it('reste sous les 0,15 €/min que la grille suppose', () => {
    /* `plans.ts` a été posé sur « ~0,15 EUR/min tout compris ». Si le calcul
       par poste passait au-dessus, toutes les marges annoncées seraient
       fausses et la grille demanderait une révision, pas une option. */
    expect(classicCost().eurPerMinute).toBeLessThan(0.15);
  });

  it('laisse chaque palier en marge positive', () => {
    for (const plan of ALL_PLANS) {
      expect(planMargin(plan, classicCost().eurPerMinute).marginEurPerMinute).toBeGreaterThan(0);
    }
  });
});

describe('le choix du modèle EST la décision tarifaire', () => {
  it('en mini, le surcoût est marginal et aucun palier ne perd d\'argent', () => {
    const delta = surchargeToKeepMarginEur(MINI) as number;
    expect(delta).toBeGreaterThan(0);
    // Moins de cinq centimes: à comparer aux 0,258 € que rapporte la minute la
    // moins chère de la grille.
    expect(delta).toBeLessThan(0.05);

    const cost = superagentCost(MINI) as { eurPerMinute: number };
    for (const plan of ALL_PLANS) {
      expect(planMargin(plan, cost.eurPerMinute).marginEurPerMinute).toBeGreaterThan(0);
    }
  });

  it('en gpt-realtime-2, CHAQUE palier paie pour vendre', () => {
    /* Le facteur dix de 6quinvicies, en euros: le modèle coûte plus qu'une
       minute ne rapporte, sur le palier le plus cher comme sur le moins cher.
       Aucun prix d'option ne rattrape ça, et l'inclure dans un forfait revient
       à payer chaque minute vendue. */
    const cost = superagentCost(GROS) as { eurPerMinute: number };
    for (const plan of ALL_PLANS) {
      expect(planMargin(plan, cost.eurPerMinute).marginEurPerMinute).toBeLessThan(0);
    }
  });

  it('inclure le mini coûte une part lisible du forfait, pas sa moitié', () => {
    for (const plan of ALL_PLANS) {
      const c = inclusionCostEur(plan, MINI) as number;
      expect(c / plan.monthlyPriceEur).toBeLessThan(0.10);
    }
  });
});

describe('le prix de l\'option', () => {
  it('vaut exactement le surcoût du moteur, ni plus ni moins, à la minute', () => {
    const delta = surchargeToKeepMarginEur(MINI) as number;
    const classique = classicCost().eurPerMinute;
    const s2s = (superagentCost(MINI) as { eurPerMinute: number }).eurPerMinute;
    expect(delta).toBeCloseTo(s2s - classique, 6);

    /* Facturer davantage que le surcoût ferait payer deux fois la marge du
       forfait; facturer moins l'éroderait. Le test fige la définition. */
    for (const plan of ALL_PLANS) {
      const avec = planMargin(plan, s2s - delta);
      const sans = planMargin(plan, classique);
      expect(avec.marginEurPerMinute).toBeCloseTo(sans.marginEurPerMinute, 6);
    }
  });

  it('le forfait mensuel se lit en euros ronds et croît avec les minutes incluses', () => {
    const prix = ALL_PLANS.map(p => flatOptionPriceEur(p, MINI) as number);
    for (const p of prix) expect(p % 10).toBe(0);
    for (let i = 1; i < prix.length; i++) expect(prix[i]).toBeGreaterThan(prix[i - 1]);
  });
});
