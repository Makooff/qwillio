/**
 * Closed bezier outlines for the launch animation's bubbles.
 *
 * This is the technique the reference Lottie uses, and the reason it looks like
 * liquid where a `border-radius` does not: it moves the outline's own control
 * points. A border-radius can only ever describe four corner ellipses, so every
 * shape it makes is a rounded rectangle in disguise — the silhouette stays
 * symmetrical and the deformation reads as a stretch. Moving vertices lets one
 * side bulge while another flattens, which is what a membrane under tension
 * actually does.
 *
 * The paths are generated rather than drawn by hand because every keyframe must
 * carry the same number of points in the same order for anything to interpolate
 * between them.
 */

/** Vertices around the outline. Eight is enough to bulge without rippling. */
export const BLOB_POINTS = 8;

/**
 * The circle-approximation constant for this many segments: the handle length
 * that makes cubic beziers pass through the vertices as a circle would.
 * Scaled per vertex so a longer radius carries a proportionally longer handle,
 * which keeps the curve smooth where the shape swells.
 */
const HANDLE = (4 / 3) * Math.tan(Math.PI / (2 * BLOB_POINTS));

/**
 * A closed outline whose radius varies per vertex.
 *
 * @param radii One multiplier per vertex, starting at 3 o'clock and going
 *              clockwise. Values around 1 give a circle; 0.85–1.15 is the range
 *              that still reads as one body of liquid rather than a splat.
 */
export function blobPath(cx: number, cy: number, r: number, radii: number[]): string {
  const n = radii.length;
  const point = (i: number) => {
    const angle = (i % n) * ((2 * Math.PI) / n);
    const radius = r * radii[i % n];
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      // The tangent at a vertex of a circle is perpendicular to its radius;
      // keeping that direction and only changing the length is what stops a
      // varying radius from putting kinks in the curve.
      tx: -Math.sin(angle) * radius * HANDLE,
      ty: Math.cos(angle) * radius * HANDLE,
    };
  };

  let d = '';
  for (let i = 0; i < n; i++) {
    const from = point(i);
    const to = point(i + 1);
    if (i === 0) d += `M ${from.x.toFixed(2)} ${from.y.toFixed(2)}`;
    d += ` C ${(from.x + from.tx).toFixed(2)} ${(from.y + from.ty).toFixed(2)}`
      + ` ${(to.x - to.tx).toFixed(2)} ${(to.y - to.ty).toFixed(2)}`
      + ` ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }
  return `${d} Z`;
}

/**
 * A small deterministic generator.
 *
 * The deformation has to look random — a sine wave, however layered, reads as a
 * pulse once you have watched it twice — but it must be the same on every
 * launch and in every test, so a seeded generator rather than Math.random.
 */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One bubble's whole journey, as outlines.
 *
 * The travel is in the path data, not in a transform. That is the difference
 * between a shape being *carried* across the screen and a shape *making its own
 * way* across it: a translated blob is a sticker sliding, while a blob whose
 * every vertex is redrawn a little further along flows. Nothing here is
 * animated but `d`.
 *
 * The last frame is a circle centred on the lobe, because the mark has to take
 * over without a jump.
 */
export function blobJourney(params: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Radius at rest. It arrives a little larger and settles. */
  r: number;
  seed: number;
  steps?: number;
}): string[] {
  const { from, to, r, seed, steps = 7 } = params;
  const random = rng(seed);
  const frames: string[] = [];

  for (let step = 0; step < steps; step++) {
    const progress = step / (steps - 1);
    // Ease-out on the path: most of the ground is covered early, so the last
    // frames are the settling rather than more travel.
    const eased = 1 - Math.pow(1 - progress, 2.2);

    const cx = from.x + (to.x - from.x) * eased;
    const cy = from.y + (to.y - from.y) * eased;

    // Deformation dies away as it arrives; the final frame is exactly round.
    const amplitude = 0.26 * Math.pow(1 - progress, 1.6);
    const radii = Array.from({ length: BLOB_POINTS }, () => 1 + (random() - 0.5) * 2 * amplitude);

    frames.push(blobPath(cx, cy, r * (1 + 0.18 * (1 - eased)), radii));
  }
  return frames;
}
