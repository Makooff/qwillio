/**
 * Ressort physique déterministe pour le suivi de scroll du cadre V2
 * (`StepFrame`).
 *
 * Le scroll donne la position CIBLE (celle de `staggeredAt`), le ressort donne
 * la trajectoire : inertie, rattrapage, ralenti en arrivée. C'est la demande
 * « le cadre suit le scroll avec un effet de ressort » — ni une interpolation
 * directe (trop abrupte, retour utilisateur) ni un tween à durée fixe (qui
 * déconnecterait le cadre du rythme du scroll). L'amortissement du preset est
 * proche du critique : le cadre traîne un peu, se pose sans rebond visible et
 * ne « gomme » pas non plus le scroll.
 *
 * Intégration semi-implicite d'Euler (stable à grands pas, contrairement à
 * Euler explicite qui explose quand le RAF accroche). `dt` est borné par
 * l'appelant, le helper reste fini même avec un `dt` aberrant.
 */

export interface SpringParams {
  /** Rigidité k (N/m équivalent). Plus elle est haute, plus le rattrapage est vif. */
  stiffness: number;
  /** Amortissement c. ζ = c / (2·√(k·m)); ζ < 1 = dépassement contrôlé. */
  damping: number;
  /** Masse m : l'inertie qui fait « traîner » le cadre derrière un scroll vif. */
  mass: number;
}

export interface SpringTracker {
  /** Position courante (unité de la cible : ici l'index de scène continu). */
  value: number;
  /** Vitesse courante, pour reprise d'animation sans couture. */
  velocity: number;
  /**
   * Avance le ressort vers `target` pendant `dt` secondes et rend la nouvelle
   * position. Ne mute rien d'autre que `value`/`velocity`.
   */
  update(target: number, dt: number): number;
  /** Le ressort est-il au repos assez près de `target` pour arrêter le RAF ? */
  isSettled(target: number): boolean;
}

/** Seuil de repos : en-dessous, l'écart est invisible (< ~1/50e d'étape). */
const SETTLE_DISTANCE = 0.0005;
const SETTLE_SPEED = 0.001;

/** Borne de sécurité sur le pas : au-delà on intègre comme si dt valait ce max. */
const MAX_DT = 1 / 30;

export function createSpringTracker(params: SpringParams): SpringTracker {
  const { stiffness, damping, mass } = params;
  const tracker: SpringTracker = {
    value: 0,
    velocity: 0,
    update(target, dt) {
      const step = Math.min(Math.max(dt, 0), MAX_DT);
      // Force du ressort + amortissement, intégration semi-implicite :
      // la vitesse est mise à jour AVANT la position, ce qui reste stable
      // même quand le pas dépasse la période propre du ressort.
      const accel = (stiffness * (target - tracker.value) - damping * tracker.velocity) / mass;
      tracker.velocity += accel * step;
      tracker.value += tracker.velocity * step;
      return tracker.value;
    },
    isSettled(target) {
      return (
        Math.abs(target - tracker.value) < SETTLE_DISTANCE &&
        Math.abs(tracker.velocity) < SETTLE_SPEED
      );
    },
  };
  return tracker;
}

/**
 * Réglages ressort de la couche motion V2, en un seul endroit.
 *
 * `stepFrame` — le cadre qui voyage entre les étapes. ζ ≈ 0.92 : presque
 * critique, donc un rattrapage souple sans oscillation visible, mais avec
 * assez d'inertie pour que le cadre « flotte » légèrement derrière un scroll
 * rapide au lieu de coller chaque pixel de molette.
 */
export const SPRING_PRESETS = {
  stepFrame: { stiffness: 170, damping: 24, mass: 1 },
} as const;
