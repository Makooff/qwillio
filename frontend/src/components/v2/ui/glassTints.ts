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

/**
 * La même chose sur fond clair.
 *
 * Elle sert la bulle flottante AU-DESSUS DE LA VIDÉO du hero, et c'est ce qui
 * a fixé ses valeurs. À 14 % puis 4 %, le verre ne portait rien: le texte de la
 * barre, qui est en encre sur ce registre, tombait directement sur des sapins.
 * Il monte donc là où il faut pour que du noir tienne dessus, et reste un
 * dégradé descendant: dense sous le texte, plus léger vers le bas de la bulle,
 * pour ne pas devenir une pastille blanche opaque.
 *
 * Le repli (WebKit sans filtre SVG) va plus haut encore: sans flou, la seule
 * chose qui sépare le texte de l'image est cette teinte.
 */
export const LIGHT_GLASS = {
  tint: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.58) 100%)',
  tintFallback: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgb(var(--q2-canvas) / 0.78) 100%)',
  border: 'rgba(255,255,255,0.40)',
} as const;
