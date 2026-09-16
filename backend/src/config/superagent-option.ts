/**
 * Le Superagent vendu au FORFAIT mensuel: son prix public, et ce qui interdit
 * de le vendre.
 *
 * ## Pourquoi un forfait plutôt qu'un supplément à la minute
 *
 * Les deux existaient sur le papier (`voice-economics.ts`). Le supplément est
 * plus juste: il facture exactement le surcoût du moteur, minute par minute.
 * Mais il est illisible sur un devis, il ne se décide pas à l'achat, et il
 * arrive sur la facture du mois suivant sous une ligne que personne n'a
 * choisie. Un forfait se vend, se compare et s'annule. C'est celui-là.
 *
 * ## Le prix est un LITTÉRAL, et c'est volontaire
 *
 * Il serait tentant d'appeler `flatOptionPriceEur` à la volée. Ce serait un
 * prix public qui change tout seul le jour où un tarif fournisseur bouge, donc
 * un abonnement en cours reprécisé sans que personne l'ait décidé. Un prix
 * annoncé se pose une fois, comme ceux de `plans.ts`.
 *
 * Ce que le calcul garde, c'est le rôle de JUGE: `superagent-option.test.ts`
 * vérifie que ces littéraux valent bien ce que `flatOptionPriceEur` donne pour
 * `PRICED_FOR_MODEL`, donc le chiffre ne peut pas dériver de l'arithmétique qui
 * l'a produit.
 *
 * ## Ce qui interdit de vendre: le MODÈLE
 *
 * Le forfait ne tient que parce que le surcoût d'une minute temps réel est
 * petit (1,6 centime avec le mini). Avec `gpt-realtime-2`, la même minute coûte
 * un demi-euro de plus: l'option Solo devrait se vendre 420 €/mois pour tenir,
 * et à 20 € elle ferait perdre de l'argent à chaque minute. Le modèle n'est
 * donc pas un réglage technique à côté du prix, c'est lui qui décide si le prix
 * existe.
 *
 * `optionViability` refuse alors la VENTE, au lieu de la laisser partir. Deux
 * cas la font refuser, et le second est celui de la configuration par défaut:
 *
 *  - un modèle dont le tarif rendrait le forfait déficitaire ;
 *  - un modèle dont le tarif n'a JAMAIS été relevé (le défaut,
 *    `gpt-realtime-2025-08-28`). C'est 6quinvicies appliqué à l'argent: une
 *    valeur supposée qui a l'air d'une lecture coûte plus cher que pas de
 *    valeur. Tant que personne n'a lu ce tarif sur le tableau de bord Vapi, on
 *    ne peut pas dire si 20 € couvrent quoi que ce soit.
 *
 * Le refus n'est pas un mur: il NOMME les deux sorties (lire le tarif, ou
 * poser `VOICE_REALTIME_MODEL` sur le modèle pour lequel le prix a été calculé),
 * et les deux sont une variable d'environnement.
 */
import { PLANS, getPlan, ANNUAL_DISCOUNT, type BillingPeriod, type PlanId } from './plans';
import { inclusionCostEur } from './voice-economics';
import { planAllows } from './plan-features';

/**
 * Le modèle temps réel pour lequel les prix ci-dessous ont été calculés.
 *
 * Relevé, jamais déduit: il figure au catalogue que l'API de Vapi a renvoyé
 * (6quinvicies) et son tarif est lu sur le tableau de bord Vapi
 * (`REALTIME_RATES`).
 */
export const PRICED_FOR_MODEL = 'gpt-realtime-mini-2025-12-15';

/**
 * Le prix public mensuel de l'option, par forfait.
 *
 * Absent d'un forfait = l'option ne s'y vend pas. Pro et Enterprise INCLUENT le
 * Superagent (`PLAN_CAPABILITIES`), donc leur vendre l'option serait facturer
 * deux fois la même chose: c'est la même faute que le double prélèvement que
 * `reportRealtimeSurcharge` évite depuis l'autre bout de la chaîne.
 */
export const OPTION_MONTHLY_EUR: Partial<Record<PlanId, number>> = {
  solo: 20,
  starter: 40,
};

/**
 * Le prix de l'option pour ce forfait et cette période, ou `null` si elle ne
 * s'y vend pas.
 *
 * ## Pourquoi l'annuel existe ici, alors que l'option est pensée au mois
 *
 * Stripe REFUSE un abonnement dont les lignes n'ont pas le même intervalle. Une
 * option mensuelle posée à côté d'un forfait annuel ne produit donc pas une
 * facturation bancale: elle produit une caisse qui ne s'ouvre pas, ou un ajout
 * qui échoue. Sans prix annuel, l'option serait invendable à tous les clients
 * annuels, en silence, et c'est le genre d'absence qui ne se voit qu'au
 * premier client qui la demande.
 *
 * La remise annuelle est la MÊME que celle des forfaits (`ANNUAL_DISCOUNT`), et
 * ce n'est pas une faveur calculée à part: deux règles de remise écrites
 * séparément divergent, et la page tarifs n'en annonce qu'une.
 */
export function optionPriceEur(
  planType: string | null | undefined,
  period: BillingPeriod = 'monthly',
): number | null {
  const plan = getPlan(planType);
  /* Un forfait qui l'inclut n'a pas d'option à vendre, même si la table en
     portait un prix: la capacité décide, pas la table. */
  if (planAllows(plan.id, 'superagent')) return null;
  const monthly = OPTION_MONTHLY_EUR[plan.id];
  if (monthly === undefined) return null;
  return period === 'annual' ? Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT)) : monthly;
}

/**
 * La clé de recherche du prix Stripe, stable par forfait et par période.
 *
 * Même mécanique que les forfaits (`qwillio_<plan>_<période>_eur`): le code
 * crée son prix et le retrouve par cette clé, donc aucun objet n'est créé à la
 * main dans le tableau de bord Stripe. C'est précisément le geste qui a produit
 * le 1297 € de 6duodecies.
 */
export function optionLookupKey(planId: PlanId, period: BillingPeriod = 'monthly'): string {
  return `qwillio_superagent_${planId}_${period}_eur`;
}

/** Une clé de prix Stripe désigne-t-elle une ligne d'option ? */
export const OPTION_LOOKUP_PREFIX = 'qwillio_superagent_';

export type OptionViability =
  | { sellable: true }
  | { sellable: false; reason: string; remedy: string };

/**
 * Ce modèle temps réel permet-il de vendre le forfait au prix affiché ?
 *
 * Le test est fait sur le PIRE mois de chaque forfait où l'option se vend:
 * toutes les minutes incluses passées en temps réel. Ce n'est pas un cas
 * extrême, c'est ce qu'on vend.
 *
 * La période n'entre pas dans le calcul, et c'est démontrable plutôt que
 * supposé: le prix annuel vaut douze mensualités remisées de 20 %, donc il
 * couvre douze pires mois dès que la mensualité en couvre un. Vérifier le mois
 * suffit.
 */
export function optionViability(realtimeModel: string): OptionViability {
  const remedy =
    `Poser VOICE_REALTIME_MODEL=${PRICED_FOR_MODEL} (le modèle pour lequel ces prix ont été calculés), `
    + 'ou relever le tarif du modèle voulu sur le tableau de bord Vapi et le poser dans REALTIME_RATES.';

  for (const [planId, price] of Object.entries(OPTION_MONTHLY_EUR) as Array<[PlanId, number]>) {
    const worst = inclusionCostEur(PLANS[planId], realtimeModel);
    if (typeof worst !== 'number') {
      return {
        sellable: false,
        reason: `impossible de dire ce que l'option coûte: ${worst.unknownRate}`,
        remedy,
      };
    }
    if (worst > price) {
      return {
        sellable: false,
        reason:
          `avec ${realtimeModel}, un client ${PLANS[planId].name} qui passe ses `
          + `${PLANS[planId].includedMinutes} minutes incluses en temps réel nous coûte `
          + `${worst.toFixed(2)} € pour une option vendue ${price} €.`,
        remedy,
      };
    }
  }
  return { sellable: true };
}

/**
 * Ce que le portail doit montrer à ce client, en une seule lecture.
 *
 * Une seule fonction répond, pour la même raison que `superagentAllowed`: deux
 * lectures d'un même droit divergent, et celle qui décide n'est jamais celle
 * qu'on a corrigée.
 */
export interface SuperagentOffer {
  /** Le forfait l'inclut: rien à vendre, rien à annuler. */
  included: boolean;
  /** L'option est payée aujourd'hui. */
  active: boolean;
  /** Prix pour la période de l'abonnement, `null` si elle ne se vend pas sur ce forfait. */
  priceEur: number | null;
  /** La période à laquelle ce prix se rapporte. */
  period: BillingPeriod;
  /** Peut-on l'acheter maintenant ? */
  sellable: boolean;
  /** Pourquoi pas, quand `sellable` est faux et que le forfait ne l'inclut pas. */
  blockedReason: string | null;
}

export function superagentOffer(
  client: { planType?: string | null; superagentOption?: boolean | null },
  realtimeModel: string,
  period: BillingPeriod = 'monthly',
): SuperagentOffer {
  const included = planAllows(client.planType, 'superagent');
  const active = client.superagentOption === true;
  const priceEur = optionPriceEur(client.planType, period);

  if (included) {
    return { included: true, active, priceEur: null, period, sellable: false, blockedReason: null };
  }
  if (priceEur === null) {
    return {
      included: false, active, priceEur: null, period, sellable: false,
      blockedReason: "Le Superagent ne se vend pas en option sur ce forfait.",
    };
  }

  const viability = optionViability(realtimeModel);
  return {
    included: false,
    active,
    priceEur,
    period,
    /* Déjà active: il n'y a plus rien à vendre, seulement à annuler. Et une
       option DÉJÀ payée ne se coupe pas parce que le modèle a changé: on
       arrête d'en vendre, on ne résilie pas celles qui tournent. */
    sellable: !active && viability.sellable,
    blockedReason: viability.sellable ? null : `${viability.reason} ${viability.remedy}`,
  };
}
