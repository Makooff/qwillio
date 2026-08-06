/* Sondes d'environnement partagées par la couche motion V2.
   Les composants GSAP les lisent au montage (framer-motion a son propre
   useReducedMotion). Toujours défensif: en SSR ou sans matchMedia, on
   choisit l'option la plus sobre. */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Pointeur grossier (doigt) ou sans survol: pas de magnétisme, pas de halo. */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/* Courbe signature V2 (DA/v2-direction.md), en tableau pour framer-motion. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
