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
 * A sequence of outlines for one bubble, from arrival to rest.
 *
 * The amplitude decays across the sequence and the last frame is a perfect
 * circle, because the shape has to hand over to the real logo without a jump.
 * `seed` offsets the phase so the two bubbles never deform in unison — twins
 * are the fastest way to make something look computed.
 */
export function blobKeyframes(cx: number, cy: number, r: number, seed: number): string[] {
  const amplitudes = [0.17, 0.13, 0.09, 0.055, 0.025, 0];

  return amplitudes.map((amplitude, step) => {
    const radii = Array.from({ length: BLOB_POINTS }, (_, i) => {
      // Two waves of different frequency, drifting apart as the steps advance:
      // one wave alone gives a shape that visibly rotates rather than settles.
      const phase = seed + step * 1.7;
      const slow = Math.sin((i / BLOB_POINTS) * Math.PI * 2 + phase);
      const fast = Math.sin((i / BLOB_POINTS) * Math.PI * 4 + phase * 1.9);
      return 1 + amplitude * (slow * 0.72 + fast * 0.28);
    });
    return blobPath(cx, cy, r, radii);
  });
}
