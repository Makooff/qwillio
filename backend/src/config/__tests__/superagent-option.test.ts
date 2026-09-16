import { describe, it, expect } from 'vitest';
import { PLANS } from '../plans';
import { flatOptionPriceEur, inclusionCostEur } from '../voice-economics';
import {
  OPTION_MONTHLY_EUR,
  PRICED_FOR_MODEL,
  optionLookupKey,
  optionPriceEur,
  optionViability,
  superagentOffer,
} from '../superagent-option';

/**
 * Le forfait mensuel de l'option Superagent.
 *
 * Trois choses peuvent mal tourner, et deux coûtent de l'argent:
 * vendre sous le coût, vendre à un forfait qui l'inclut déjà, et vendre alors
 * que le modèle temps réel rend le prix impossible. Ces tests tiennent les
 * trois, sans réseau ni base.
 */

describe('le prix affiché vaut ce que le calcul donne', () => {
  /* Le prix est un littéral pour ne pas bouger tout seul (voir l'en-tête du
     module). Ce test est ce qui l'empêche de dériver de l'arithmétique qui l'a
     produit: si un tarif fournisseur change, c'est ICI qu'on l'apprend, pas sur
     un relevé. */
  it('Solo et Starter portent exactement flatOptionPriceEur pour le modèle de référence', () => {
    for (const planId of ['solo', 'starter'] as const) {
      expect(OPTION_MONTHLY_EUR[planId]).toBe(flatOptionPriceEur(PLANS[planId], PRICED_FOR_MODEL));
    }
  });

  it('couvre le pire mois: toutes les minutes incluses passées en temps réel', () => {
    for (const planId of ['solo', 'starter'] as const) {
      const worst = inclusionCostEur(PLANS[planId], PRICED_FOR_MODEL) as number;
      expect(typeof worst).toBe('number');
      expect(OPTION_MONTHLY_EUR[planId]!).toBeGreaterThan(worst);
    }
  });
});

describe('à qui l\'option se vend', () => {
  it('ne se vend pas à un forfait qui l\'inclut déjà', () => {
    /* Facturer une option à un client Pro, c'est lui prélever deux fois la
       même chose: son abonnement la porte. */
    expect(optionPriceEur('pro')).toBeNull();
    expect(optionPriceEur('enterprise')).toBeNull();
  });

  it('se vend à Solo et Starter', () => {
    expect(optionPriceEur('solo')).toBe(20);
    expect(optionPriceEur('starter')).toBe(40);
  });

  it('un forfait inconnu retombe sur Starter, comme getPlan', () => {
    expect(optionPriceEur(null)).toBe(40);
  });
});

describe('la période', () => {
  it('l\'annuel porte la MÊME remise que les forfaits, pas une remise à part', () => {
    expect(optionPriceEur('solo', 'annual')).toBe(Math.round(20 * 12 * 0.8));
    expect(optionPriceEur('starter', 'annual')).toBe(Math.round(40 * 12 * 0.8));
  });

  it('chaque période a sa propre clé de prix Stripe', () => {
    /* Stripe refuse un abonnement dont les lignes n'ont pas le même
       intervalle: une seule clé pour les deux ferait poser une ligne mensuelle
       sur un abonnement annuel, donc un ajout qui échoue. */
    expect(optionLookupKey('solo', 'monthly')).toBe('qwillio_superagent_solo_monthly_eur');
    expect(optionLookupKey('solo', 'annual')).toBe('qwillio_superagent_solo_annual_eur');
    expect(optionLookupKey('solo', 'monthly')).not.toBe(optionLookupKey('solo', 'annual'));
  });

  it('le prix annuel couvre douze pires mois', () => {
    for (const planId of ['solo', 'starter'] as const) {
      const worstYear = (inclusionCostEur(PLANS[planId], PRICED_FOR_MODEL) as number) * 12;
      expect(optionPriceEur(planId, 'annual')!).toBeGreaterThan(worstYear);
    }
  });
});

describe('le modèle temps réel décide si le prix existe', () => {
  it('le modèle de référence rend l\'option vendable', () => {
    expect(optionViability(PRICED_FOR_MODEL)).toEqual({ sellable: true });
  });

  it('REFUSE un modèle dont le tarif n\'a jamais été relevé', () => {
    /* 6quinvicies appliqué à l'argent: une valeur supposée qui a l'air d'une
       lecture coûte plus cher que pas de valeur. Tant que le tarif n'est pas
       lu, on ne peut pas dire si 20 € couvrent quoi que ce soit. */
    const verdict = optionViability('gpt-realtime-2025-08-28');
    expect(verdict.sellable).toBe(false);
    if (verdict.sellable) throw new Error('unreachable');
    expect(verdict.reason).toMatch(/jamais été relevé/);
    expect(verdict.remedy).toContain(PRICED_FOR_MODEL);
  });

  it('REFUSE un modèle qui rendrait le forfait déficitaire, en disant de combien', () => {
    const verdict = optionViability('gpt-realtime-2');
    expect(verdict.sellable).toBe(false);
    if (verdict.sellable) throw new Error('unreachable');
    // Le premier forfait qui casse est nommé, avec le coût en face du prix.
    expect(verdict.reason).toMatch(/Solo/);
    expect(verdict.reason).toMatch(/20 €/);
  });

  it('REFUSE un modèle inconnu du module plutôt que de le supposer gratuit', () => {
    expect(optionViability('un-modele-invente').sellable).toBe(false);
  });
});

describe('ce que le portail doit afficher', () => {
  const MINI = PRICED_FOR_MODEL;

  it('forfait Pro: inclus, rien à vendre', () => {
    const offer = superagentOffer({ planType: 'pro' }, MINI);
    expect(offer.included).toBe(true);
    expect(offer.sellable).toBe(false);
    expect(offer.priceEur).toBeNull();
    expect(offer.blockedReason).toBeNull();
  });

  it('forfait Solo sans option: achetable, à son prix', () => {
    const offer = superagentOffer({ planType: 'solo', superagentOption: false }, MINI);
    expect(offer).toMatchObject({ included: false, active: false, priceEur: 20, sellable: true });
  });

  it('forfait Solo avec option: active, et plus rien à vendre', () => {
    const offer = superagentOffer({ planType: 'solo', superagentOption: true }, MINI);
    expect(offer.active).toBe(true);
    expect(offer.sellable).toBe(false);
  });

  it('une option DÉJÀ payée ne se coupe pas parce que le modèle a changé', () => {
    /* On arrête d'en VENDRE, on ne résilie pas celles qui tournent: le client
       a payé son mois, et le défaut de configuration n'est pas le sien. */
    const offer = superagentOffer({ planType: 'solo', superagentOption: true }, 'gpt-realtime-2');
    expect(offer.active).toBe(true);
    expect(offer.blockedReason).not.toBeNull();
  });

  it('modèle invendable: bloqué, et la raison dit quoi faire', () => {
    const offer = superagentOffer({ planType: 'solo', superagentOption: false }, 'gpt-realtime-2025-08-28');
    expect(offer.sellable).toBe(false);
    expect(offer.blockedReason).toContain('VOICE_REALTIME_MODEL');
  });
});
