/**
 * Le cadre arrondi qui passe d'une étape à la suivante.
 *
 * Il se DÉFORMAIT: chaque point de son contour avançait à son propre rythme, les
 * côtés gonflaient, et la silhouette n'était plus un rectangle en chemin. Le
 * rendu était mou, et le coin de sortie tirait la forme au lieu de la conduire
 * (retour utilisateur). Le cadre reste désormais un rectangle arrondi du départ
 * à l'arrivée: il RAPETISSE en s'en allant par son coin de sortie, traverse, et
 * REGRANDIT depuis le coin d'entrée de la carte suivante. Le mouvement est le
 * même, la matière ne l'est plus: rien ne se tord.
 *
 * Conséquence sur l'écriture: plus d'échantillonnage du contour, plus de
 * Catmull-Rom. Une boîte interpolée et un chemin d'arcs suffisent, et les
 * arrondis restent des arcs de cercle exacts à toutes les tailles, ce qu'une
 * courbe lissée ne garantissait pas.
 */

export interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangle arrondi, en arcs. Le rayon est bridé pour ne jamais se croiser. */
export function framePath(box: FrameBox, radius: number): string {
  const r = Math.max(0, Math.min(radius, box.w / 2, box.h / 2));
  const x0 = box.x;
  const y0 = box.y;
  const x1 = box.x + box.w;
  const y1 = box.y + box.h;
  const n = (v: number) => v.toFixed(2);

  return [
    `M ${n(x0 + r)} ${n(y0)}`,
    `H ${n(x1 - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x1)} ${n(y0 + r)}`,
    `V ${n(y1 - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x1 - r)} ${n(y1)}`,
    `H ${n(x0 + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x0)} ${n(y1 - r)}`,
    `V ${n(y0 + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x0 + r)} ${n(y0)}`,
    'Z',
  ].join(' ');
}

/**
 * Coin de la boîte tourné vers la direction donnée.
 *
 * Sur un trajet purement vertical (`ux` nul), `Math.sign(0)` vaut 0 et le point
 * retombe au milieu du bord: c'est le bon comportement, une colonne unique doit
 * partir par le bord et non par un coin arbitraire.
 */
function cornerToward(box: FrameBox, ux: number, uy: number): { x: number; y: number } {
  return {
    x: box.x + box.w / 2 + Math.sign(ux) * (box.w / 2),
    y: box.y + box.h / 2 + Math.sign(uy) * (box.h / 2),
  };
}

/**
 * Le cadre à un instant du trajet entre deux étapes.
 *
 * @param progress 0 = posé sur `from`, 1 = posé sur `to`.
 *
 * Deux choses seulement, et aucune ne touche à la silhouette:
 *
 *   - LA BOÎTE SE DÉPLACE ET CHANGE DE TAILLE, position et dimensions
 *     interpolées entre les deux étapes. C'est un rectangle arrondi tout du
 *     long, jamais autre chose.
 *   - ELLE RAPETISSE À MI-CHEMIN, autour d'un pivot qui glisse du coin de SORTIE
 *     de la carte de départ vers le coin d'ENTRÉE de la carte d'arrivée. C'est
 *     ce qui donne « il part par son coin droit et regrandit depuis le coin
 *     gauche de la suivante », et l'alternance vient toute seule de la mise en
 *     page alternée: le coin n'est jamais choisi à la main.
 *
 * Le rétrécissement est nul aux deux bouts, donc le cadre se pose à taille
 * pleine sur chaque étape, sans jamais y arriver de travers.
 */
export function frameJourney(params: {
  from: FrameBox;
  to: FrameBox;
  radius: number;
  progress: number;
  /** Rétrécissement à mi-parcours, en fraction de la taille (0 = aucun). */
  pinch?: number;
}): { path: string; radius: number } {
  const { from, to, radius, pinch = 0.42 } = params;
  const p = Math.max(0, Math.min(1, params.progress));

  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;

  /* Adoucissement aux deux bouts: une interpolation linéaire donnerait un
     démarrage et un arrêt secs, et le scroll les rend très lisibles. */
  const ease = p * p * (3 - 2 * p);
  const lerp = (a: number, b: number) => a + (b - a) * ease;

  const moving: FrameBox = {
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    w: lerp(from.w, to.w),
    h: lerp(from.h, to.h),
  };

  /* Nul aux deux bouts, maximal au milieu. */
  const tension = Math.sin(p * Math.PI);
  const shrink = 1 - pinch * tension;

  /* Le pivot glisse: fixe, la forme rentrerait dans un coin puis ressortirait
     du même, ce qui se lit comme un rebond au lieu d'une traversée. */
  const exit = cornerToward(from, ux, uy);
  const entry = cornerToward(to, -ux, -uy);
  const pivotX = exit.x + (entry.x - exit.x) * ease;
  const pivotY = exit.y + (entry.y - exit.y) * ease;

  const box: FrameBox = {
    x: pivotX + (moving.x - pivotX) * shrink,
    y: pivotY + (moving.y - pivotY) * shrink,
    w: moving.w * shrink,
    h: moving.h * shrink,
  };

  /* Le rayon suit la taille: un rayon fixe sur une boîte rapetissée ferait des
     coins proportionnellement plus ronds au milieu du trajet, donc une forme qui
     change de caractère alors qu'elle ne doit que changer de taille.
     Essayé une fois en valeur absolue, et repris: la demande d'arrondir « les
     angles pendant la transition » ne portait pas sur la silhouette, qui
     convient, mais sur les angles que le MASQUE lui découpe (voir StepFrame). */
  return { path: framePath(box, radius * shrink), radius: radius * shrink };
}
