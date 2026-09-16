/**
 * Ce qu'une minute COÛTE, ce qu'elle RAPPORTE, et ce que l'option doit valoir.
 *
 * ## Pourquoi un module et pas un calcul de coin de table
 *
 * `plans.ts` annonce en commentaire « ~0,15 EUR/min tout compris » et personne
 * ne peut dire de quoi c'est fait. Tant que le coût reste une phrase, décider
 * du prix d'une option qui MULTIPLIE ce coût par dix se fait à l'aveugle. Les
 * postes sont donc nommés un par un, avec leur source, et le calcul devient
 * relisable plutôt que crédible.
 *
 * ## La règle qui tient tout: un tarif ne se DÉDUIT pas
 *
 * C'est 6quinvicies, appliqué à l'argent au lieu des identifiants de modèle.
 * Le tarif d'un modèle temps réel se lit sur le tableau de bord Vapi, qui est
 * l'intermédiaire qui nous facture. Deux seulement ont été relevés. Le
 * troisième, `gpt-realtime-2025-08-28`, est le DÉFAUT du code et son tarif n'a
 * jamais été lu: ce module refuse alors de calculer et NOMME ce qui manque,
 * au lieu de rendre un nombre qui aurait l'air d'une réponse.
 *
 * ## L'écart de dix, et pourquoi il décide de toute la grille
 *
 * Le modèle temps réel REMPLACE la transcription, le modèle texte et la
 * synthèse. En `mini`, il coûte à peu près ce qu'il remplace: l'option est
 * alors quasi gratuite pour nous et se vend à la valeur. En `gpt-realtime-2`,
 * il coûte plus cher que la recette d'une minute incluse sur CHAQUE palier:
 * l'inclure dans un forfait revient à payer pour chaque minute vendue, et
 * aucun prix d'option raisonnable ne rattrape ça. Le choix du modèle n'est
 * donc pas un réglage technique, c'est la décision tarifaire elle-même.
 */
import { PLANS, type Plan, type PlanId } from './plans';

/** Un tarif fournisseur, avec d'où il vient. Sans source, ce n'est pas un tarif. */
export interface ProviderRate {
  usdPerMinute: number;
  source: string;
}

/**
 * Le taux de change, posé ICI parce qu'il entre dans chaque conversion.
 *
 * Il bouge, et une grille tarifaire calculée sur un taux figé vieillit en
 * silence. Le script l'affiche avec le reste pour qu'on le voie vieillir.
 */
export const USD_PER_EUR = 1.08;

export const eur = (usd: number): number => usd / USD_PER_EUR;

/**
 * Les postes COMMUNS aux deux moteurs: l'appel existe, quel que soit ce qui
 * le fait parler.
 */
export const COMMON_RATES: Record<string, ProviderRate> = {
  vapi: { usdPerMinute: 0.05, source: 'Vapi, frais de plateforme par minute' },
  telephonie: { usdPerMinute: 0.0085, source: 'Twilio, entrant sur un mobile belge' },
};

/** Les postes que le temps réel SUPPRIME, parce que le modèle les fait lui-même. */
export const CLASSIC_RATES: Record<string, ProviderRate> = {
  transcription: { usdPerMinute: 0.0077, source: 'Deepgram Nova-3, flux' },
  synthese: { usdPerMinute: 0.020, source: 'Cartesia Sonic, au caractère, ramené à la minute parlée' },
  modeleTexte: { usdPerMinute: 0.015, source: 'gpt-4.1-mini, au jeton, densité conversationnelle' },
};

/**
 * Les tarifs temps réel RELEVÉS, et ceux qui ne l'ont pas été.
 *
 * `null` veut dire « jamais lu », et c'est une valeur utile: elle fait refuser
 * le calcul au lieu de le fabriquer. Les deux chiffres présents viennent du
 * tableau de bord Vapi (CLAUDE.md, 6quinvicies).
 */
export const REALTIME_RATES: Record<string, ProviderRate | null> = {
  'gpt-realtime-mini-2025-12-15': {
    usdPerMinute: 0.060,
    source: 'tableau de bord Vapi, relevé le 10/09/2026',
  },
  'gpt-realtime-2': {
    usdPerMinute: 0.645,
    source: 'tableau de bord Vapi, relevé le 10/09/2026',
  },
  /* Le DÉFAUT du code (`VOICE_REALTIME_MODEL`), et son tarif n'a jamais été
     relevé. Le poser au hasard ferait passer une supposition pour une lecture,
     et c'est exactement la faute qui a coûté trois identifiants faux. */
  'gpt-realtime-2025-08-28': null,
};

const sum = (rates: Record<string, ProviderRate>): number =>
  Object.values(rates).reduce((t, r) => t + r.usdPerMinute, 0);

export interface MinuteCost {
  eurPerMinute: number;
  /** Chaque poste, pour que le total se relise. */
  breakdown: Array<{ poste: string; eurPerMinute: number; source: string }>;
}

/** Ce qu'une minute CLASSIQUE nous coûte. */
export function classicCost(): MinuteCost {
  const all = { ...COMMON_RATES, ...CLASSIC_RATES };
  return {
    eurPerMinute: eur(sum(all)),
    breakdown: Object.entries(all).map(([poste, r]) => ({
      poste, eurPerMinute: eur(r.usdPerMinute), source: r.source,
    })),
  };
}

/**
 * Ce qu'une minute SUPERAGENT nous coûte, ou pourquoi on ne peut pas le dire.
 *
 * Le modèle temps réel remplace les trois postes de la chaîne classique: il
 * entend et parle lui-même. Seuls la plateforme et la téléphonie restent.
 */
export function superagentCost(realtimeModel: string): MinuteCost | { unknownRate: string } {
  const rate = REALTIME_RATES[realtimeModel];
  if (!rate) {
    return {
      unknownRate: realtimeModel in REALTIME_RATES
        ? `le tarif de ${realtimeModel} n'a jamais été relevé sur le tableau de bord Vapi`
        : `${realtimeModel} n'est pas un modèle temps réel connu de ce module`,
    };
  }
  const all = { ...COMMON_RATES, tempsReel: rate };
  return {
    eurPerMinute: eur(sum(all)),
    breakdown: Object.entries(all).map(([poste, r]) => ({
      poste, eurPerMinute: eur(r.usdPerMinute), source: r.source,
    })),
  };
}

/** Ce qu'une minute INCLUSE rapporte: le forfait divisé par ses minutes. */
export function revenuePerIncludedMinuteEur(plan: Plan): number {
  return plan.monthlyPriceEur / plan.includedMinutes;
}

export interface PlanMargin {
  planId: PlanId;
  revenueEurPerMinute: number;
  costEurPerMinute: number;
  marginEurPerMinute: number;
  /** Part de la recette qui reste, entre 0 et 1. Négative = on paie pour vendre. */
  marginRatio: number;
}

export function planMargin(plan: Plan, costEurPerMinute: number): PlanMargin {
  const revenue = revenuePerIncludedMinuteEur(plan);
  const margin = revenue - costEurPerMinute;
  return {
    planId: plan.id,
    revenueEurPerMinute: revenue,
    costEurPerMinute,
    marginEurPerMinute: margin,
    marginRatio: revenue > 0 ? margin / revenue : 0,
  };
}

/**
 * Le prix de l'option, à la minute, pour que le palier RETROUVE la marge qu'il
 * a sur une minute classique.
 *
 * C'est la lecture la plus fidèle de « que j'aie toujours la marge »: l'option
 * ne doit pas éroder ce que le forfait gagne déjà, et pas davantage, sinon on
 * facture deux fois la même chose. Le supplément vaut donc exactement le
 * surcoût du moteur.
 *
 * Il ne dépend PAS du palier, et c'est normal: le surcoût d'une minute est le
 * même pour tout le monde. Ce qui dépend du palier, c'est de pouvoir l'offrir.
 */
export function surchargeToKeepMarginEur(realtimeModel: string): number | { unknownRate: string } {
  const s2s = superagentCost(realtimeModel);
  if ('unknownRate' in s2s) return s2s;
  return s2s.eurPerMinute - classicCost().eurPerMinute;
}

/**
 * Ce que coûte le fait d'INCLURE le superagent dans un forfait, au pire mois:
 * toutes les minutes incluses passées en temps réel.
 *
 * C'est le chiffre qui dit si l'inclure est tenable. Un client qui consomme
 * tout son forfait en superagent est le cas normal, pas le cas extrême: c'est
 * précisément ce qu'on lui vend.
 */
export function inclusionCostEur(plan: Plan, realtimeModel: string): number | { unknownRate: string } {
  const delta = surchargeToKeepMarginEur(realtimeModel);
  if (typeof delta !== 'number') return delta;
  return delta * plan.includedMinutes;
}

/**
 * Le prix d'une option FORFAITAIRE mensuelle, pour un palier.
 *
 * Un supplément à la minute est juste mais illisible sur un devis; un forfait
 * se vend. Il n'est tenable que si le surcoût par minute est petit: sinon un
 * client qui double sa consommation fait perdre de l'argent à chaque minute
 * au-delà, et le dépassement ne le rattrape pas (il est calculé sur le coût
 * CLASSIQUE). Le multiple demandé est donc appliqué au pire mois, pas à une
 * consommation moyenne qu'on ne connaît pas.
 */
export function flatOptionPriceEur(
  plan: Plan,
  realtimeModel: string,
  markup = 3,
): number | { unknownRate: string } {
  const worst = inclusionCostEur(plan, realtimeModel);
  if (typeof worst !== 'number') return worst;
  // Arrondi au multiple de 10 supérieur: un prix public ne se lit pas à la virgule.
  return Math.ceil((worst * markup) / 10) * 10;
}

export const ALL_PLANS: Plan[] = [PLANS.solo, PLANS.starter, PLANS.pro, PLANS.enterprise];
