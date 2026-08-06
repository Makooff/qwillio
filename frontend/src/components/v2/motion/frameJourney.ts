/**
 * Le cadre arrondi qui passe d'une étape à la suivante en se déformant.
 *
 * `blobPath.liquidJourney` (splash) fait voyager une GOUTTE: son silhouette est
 * radiale, elle part d'un point et arrive à un autre. Ici la forme est un
 * RECTANGLE arrondi qui doit épouser des boîtes de tailles différentes, donc ni
 * le même échantillonnage ni la même déformation. Le principe, lui, est repris
 * tel quel du Lottie de référence: on déplace les points de l'outline, jamais
 * la forme entière.
 *
 * Pourquoi pas un `border-radius` animé: il ne sait décrire que quatre ellipses
 * de coin, donc la silhouette reste symétrique et la déformation se lit comme
 * un étirement. En bougeant les sommets, un coin peut partir devant pendant que
 * le coin opposé traîne, ce qui est exactement ce que fait une membrane tendue,
 * et ce que l'utilisateur a demandé: « la transition par les coins ».
 */

export interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Points échantillonnés sur le tour du cadre.
 *
 * Multiple de 4 pour qu'un coin tombe toujours sur un sommet: sinon le coin est
 * interpolé entre deux points et la déformation y arrive molle, alors que c'est
 * précisément là qu'elle doit se voir.
 */
export const FRAME_POINTS = 48;

/** Un point du tour d'un rectangle arrondi, à l'abscisse curviligne t (0..1). */
function pointOnRoundedRect(box: FrameBox, radius: number, t: number): { x: number; y: number } {
  const r = Math.min(radius, box.w / 2, box.h / 2);
  const straightW = box.w - 2 * r;
  const straightH = box.h - 2 * r;
  const arc = (Math.PI / 2) * r;
  const perimeter = 2 * straightW + 2 * straightH + 4 * arc;

  let d = ((t % 1) + 1) % 1 * perimeter;
  const x0 = box.x;
  const y0 = box.y;
  const x1 = box.x + box.w;
  const y1 = box.y + box.h;

  // Départ au milieu du bord haut, puis sens horaire.
  const half = straightW / 2;
  if (d < half) return { x: x0 + r + half + d, y: y0 };
  d -= half;

  if (d < arc) {
    const a = (d / arc) * (Math.PI / 2);
    return { x: x1 - r + Math.sin(a) * r, y: y0 + r - Math.cos(a) * r };
  }
  d -= arc;

  if (d < straightH) return { x: x1, y: y0 + r + d };
  d -= straightH;

  if (d < arc) {
    const a = (d / arc) * (Math.PI / 2);
    return { x: x1 - r + Math.cos(a) * r, y: y1 - r + Math.sin(a) * r };
  }
  d -= arc;

  if (d < straightW) return { x: x1 - r - d, y: y1 };
  d -= straightW;

  if (d < arc) {
    const a = (d / arc) * (Math.PI / 2);
    return { x: x0 + r - Math.sin(a) * r, y: y1 - r + Math.cos(a) * r };
  }
  d -= arc;

  if (d < straightH) return { x: x0, y: y1 - r - d };
  d -= straightH;

  if (d < arc) {
    const a = (d / arc) * (Math.PI / 2);
    return { x: x0 + r - Math.cos(a) * r, y: y0 + r - Math.sin(a) * r };
  }
  d -= arc;

  return { x: x0 + r + d, y: y0 };
}

/**
 * Chemin fermé lissé passant par les points donnés.
 *
 * Poignées prises sur les VOISINS de chaque sommet (Catmull-Rom écrit en
 * béziers), pas sur la tangente locale: là où un côté gonfle pendant que le
 * suivant creuse, deux poignées calculées chacune de son côté se croisent et la
 * courbe fait un crochet, juste à l'endroit censé être le plus doux. Même
 * raisonnement que `blobPath`, appliqué à un tour de rectangle.
 */
function smoothClosedPath(points: { x: number; y: number }[]): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  const k = 1 / 6;

  let d = `M ${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const before = at(i - 1);
    const from = at(i);
    const to = at(i + 1);
    const after = at(i + 2);
    const c1x = from.x + (to.x - before.x) * k;
    const c1y = from.y + (to.y - before.y) * k;
    const c2x = to.x - (after.x - from.x) * k;
    const c2y = to.y - (after.y - from.y) * k;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }
  return `${d} Z`;
}

/** Cadre au repos, sans déformation. */
export function framePath(box: FrameBox, radius: number): string {
  const points = Array.from({ length: FRAME_POINTS }, (_, i) =>
    pointOnRoundedRect(box, radius, i / FRAME_POINTS),
  );
  return smoothClosedPath(points);
}

/**
 * Le cadre à un instant du trajet entre deux étapes.
 *
 * @param progress 0 = posé sur `from`, 1 = posé sur `to`.
 *
 * Deux effets se superposent, et c'est leur combinaison qui donne la matière:
 *
 *   - AVANCE PAR LES COINS. Chaque point avance selon sa position par rapport
 *     au sens du déplacement: ceux qui sont du côté de l'arrivée prennent de
 *     l'avance sur la progression, ceux de l'arrière traînent. Le cadre s'étire
 *     donc en chemin et se rassemble en arrivant, au lieu de glisser d'un bloc.
 *   - RESPIRATION DES BORDS. Un léger renflement perpendiculaire, maximal à
 *     mi-parcours et nul aux deux bouts, pour que les côtés ne restent pas des
 *     droites pendant que les coins travaillent.
 */
export function frameJourney(params: {
  from: FrameBox;
  to: FrameBox;
  radius: number;
  progress: number;
  /** Avance maximale d'un coin sur la progression, en fraction du trajet. */
  lead?: number;
  /** Renflement des bords à mi-parcours, en pixels. */
  swell?: number;
}): string {
  const { from, to, radius, lead = 0.22, swell = 10 } = params;
  const p = Math.max(0, Math.min(1, params.progress));

  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;

  /* Nul aux deux bouts, maximal au milieu: le cadre arrive net sur l'étape,
     il ne s'y pose pas encore tordu. */
  const tension = Math.sin(p * Math.PI);

  const points = Array.from({ length: FRAME_POINTS }, (_, i) => {
    const t = i / FRAME_POINTS;
    const a = pointOnRoundedRect(from, radius, t);
    const b = pointOnRoundedRect(to, radius, t);

    /* Le point est-il devant ou derrière, dans le sens du voyage ? Mesuré sur
       le rectangle de départ, centre à centre: +1 en tête, -1 en queue. */
    const rx = a.x - (from.x + from.w / 2);
    const ry = a.y - (from.y + from.h / 2);
    const norm = Math.hypot(rx, ry) || 1;
    const facing = (rx / norm) * ux + (ry / norm) * uy;

    const local = Math.max(0, Math.min(1, p + facing * lead * tension));
    const x = a.x + (b.x - a.x) * local;
    const y = a.y + (b.y - a.y) * local;

    /* Renflement perpendiculaire au déplacement, alterné le long du tour pour
       que les quatre côtés ne gonflent pas ensemble. */
    const wobble = Math.sin(t * Math.PI * 2 + p * Math.PI) * swell * tension;
    return { x: x + -uy * wobble, y: y + ux * wobble };
  });

  return smoothClosedPath(points);
}
