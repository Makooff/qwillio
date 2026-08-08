/**
 * La teinte du verre sombre, écrite une fois.
 *
 * La barre du site et celle du tableau de bord sont le même objet: une pilule
 * flottante en verre, posée sur du sombre. Elles avaient pourtant deux
 * recettes. Celle du tableau de bord partait d'un GRIS bleuté dense
 * (`oklch(30% 0.01 265 / 0.14)` jusqu'à `0.24`, repli à 60-74 %), exactement
 * l'erreur déjà corrigée sur le site: à cette densité la barre ne se lit plus
 * comme du verre mais comme une plaque grise posée sur du noir.
 *
 * Ces valeurs-ci sont celles du site: on part du NOIR DE LA MARQUE, on reste
 * très bas, et c'est le flou qui donne la matière. Le repli (WebKit sans
 * filtre SVG) monte à 42-52 %, assez pour que la barre ne soit pas
 * traversable, pas assez pour redevenir une plaque.
 */

export const DARK_GLASS = {
  tint: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(8,9,10,0.10) 100%)',
  tintFallback: 'linear-gradient(180deg, rgba(8,9,10,0.42) 0%, rgba(8,9,10,0.52) 100%)',
  /** Le filet du bord, celui de la barre du site sur fond sombre. */
  border: 'rgba(255,255,255,0.10)',
} as const;

/** La même chose sur fond clair, pour la barre du site au repos. */
export const LIGHT_GLASS = {
  tint: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)',
  tintFallback: 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgb(var(--q2-canvas) / 0.40) 100%)',
  border: 'rgba(255,255,255,0.40)',
} as const;
