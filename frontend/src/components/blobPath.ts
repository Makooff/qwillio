/**
 * Closed bezier outlines for the launch animation's shapes.
 *
 * This is the technique the reference Lottie uses, and the reason it looks like
 * liquid where a `border-radius` does not: it moves the outline's own control
 * points. A border-radius can only ever describe four corner ellipses, so every
 * shape it makes is a rounded rectangle in disguise — the silhouette stays
 * symmetrical and the deformation reads as a stretch. Moving vertices lets one
 * side swell while another caves in, which is what a membrane under tension
 * actually does.
 *
 * The paths are generated rather than drawn by hand because every keyframe must
 * carry the same number of points in the same order for anything to interpolate
 * between them.
 */

/**
 * Vertices around the outline.
 *
 * Twenty, because the deformation is local: a hollow about 0.7 rad wide needs
 * several points across it or it arrives as a corner. Eight was enough when the
 * whole outline breathed at once; it is not enough for a dent.
 */
export const BLOB_POINTS = 28;

/**
 * A closed outline whose radius varies per vertex.
 *
 * @param radii One multiplier per vertex, starting at 3 o'clock and going
 *              clockwise.
 */
export function blobPath(cx: number, cy: number, r: number, radii: number[]): string {
  const n = radii.length;
  const point = (i: number) => {
    const k = ((i % n) + n) % n;
    const angle = k * ((2 * Math.PI) / n);
    const radius = r * radii[k];
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  };

  /**
   * Handles taken from each vertex's neighbours rather than from its own radius.
   *
   * The tangent of a circle is the obvious choice and it is wrong here: it only
   * knows the vertex it belongs to, so where a deep hollow meets a swell the two
   * control points of a segment overshoot past each other and the curve doubles
   * back — a nick in the outline, exactly where the shape was supposed to look
   * softest. Pointing each handle along the line between the vertex's neighbours
   * (a Catmull-Rom spline, written as beziers) makes the curve smooth for any
   * set of radii, however uneven.
   */
  const handleScale = 1 / 6;

  let d = '';
  for (let i = 0; i < n; i++) {
    const before = point(i - 1);
    const from = point(i);
    const to = point(i + 1);
    const after = point(i + 2);
    if (i === 0) d += `M ${from.x.toFixed(2)} ${from.y.toFixed(2)}`;
    d += ` C ${(from.x + (to.x - before.x) * handleScale).toFixed(2)}`
      + ` ${(from.y + (to.y - before.y) * handleScale).toFixed(2)}`
      + ` ${(to.x - (after.x - from.x) * handleScale).toFixed(2)}`
      + ` ${(to.y - (after.y - from.y) * handleScale).toFixed(2)}`
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
 * Shortest signed angle between two points on the outline, so a hollow sitting
 * either side of three o'clock is one hollow and not two.
 */
function around(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * One shape's whole life, as outlines.
 *
 * It starts big and still where it is put — over the edge of the screen by a
 * quarter — and deforms in place for a beat. Then, still deforming, it makes its
 * way to the mark's lobe, shrinking as it goes, and the deformation dies away
 * with the journey, so the last frame is an exact circle for the real logo to
 * take over from.
 *
 * The deformation is local, which is the whole character of the reference: a few
 * swells and hollows, each of its own width, drifting round the outline and
 * turning from swell to hollow at its own pace. Measured off the reference file,
 * its radius runs between about half and one and a quarter of nominal and its
 * hollows are around 0.7 rad wide, which is where the numbers below come from.
 *
 * The travel is in the path data, not in a transform. That is the difference
 * between a shape being *carried* across the screen and a shape *making its own
 * way*: a translated blob is a sticker sliding, while a blob whose every vertex
 * is redrawn a little further along flows. Nothing here is animated but `d`.
 */
export function liquidJourney(params: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Radius where it starts, and the lobe radius it has to end on. */
  r0: number;
  r1: number;
  seed: number;
  steps?: number;
  /** Fraction of the sequence spent deforming in place before setting off. */
  hold?: number;
}): string[] {
  const { from, to, r0, r1, seed, steps = 44, hold = 0.28 } = params;
  const random = rng(seed);

  /**
   * Where the shape starts, and where it turns to.
   *
   * The reference is not a circle with dents in it. Its silhouette is a rounded
   * square pulled about — flat-ish sides, corners that reach out — and that is
   * most of why it reads as a body of liquid rather than a ball. A superellipse
   * gives exactly that, and it has the property this animation needs: the
   * exponent is a dial. At 3.6 it is the reference's squarish body, at 2 it is a
   * circle, so easing it down over the journey lands on the mark's lobe without
   * a separate trick to round the shape off.
   */
  const SQUARENESS = 3.6;
  const spin = random() * Math.PI * 2;
  const spinDrift = (random() - 0.5) * 1.4;

  // Four, alternating out and in: one is a pulse, two is a see-saw, and past
  // three the poses stop repeating over a journey this long.
  const swells = Array.from({ length: 4 }, (_, j) => ({
    /** Where it sits on the outline, and how far round it drifts on the way. */
    angle: random() * Math.PI * 2,
    drift: (random() - 0.5) * 5,
    /**
     * How wide and how deep, in radians and in fractions of the radius.
     *
     * The two are not mirror images. A swell is broad and shallow — pull a wide
     * arc out too far and the shape stops being one body — while a hollow is
     * narrow and deep, because that is the only way to get a notch rather than a
     * flat spot. It is the notches that read as liquid.
     */
    width: j % 2 === 0 ? 0.85 + random() * 0.35 : 0.6 + random() * 0.3,
    depth: j % 2 === 0 ? 0.36 + random() * 0.18 : 0.5 + random() * 0.26,
    /** How fast it breathes. */
    speed: 1.1 + random() * 1.7,
    /**
     * Where in its breath it starts.
     *
     * Near the top of it, not anywhere: the first frame is the one held longest
     * on screen, and a shape that opens the splash as a circle and only finds
     * its character a moment later has already read as a circle.
     */
    phase: Math.PI / 2 + (random() - 0.5) * 1.1,
    /**
     * Out or in, decided once and kept.
     *
     * Letting each one swing through zero looked right on paper and washed out
     * on screen: several crossing at their own rates spend most of the time
     * cancelling, and what is left is a gentle throb. Alternating the signs
     * means there is a swell somewhere and a hollow somewhere else at every
     * moment, which is what the reference does.
     */
    sign: j % 2 === 0 ? 1 : -1,
  }));

  const frames: string[] = [];
  for (let step = 0; step < steps; step++) {
    const t = step / (steps - 1);
    // Still, then away: the shape holds its ground and deforms there before the
    // journey starts at all.
    const move = t <= hold ? 0 : (t - hold) / (1 - hold);
    // Smoothstep, so it leaves and arrives without a lurch at either end.
    const eased = move * move * (3 - 2 * move);

    const cx = from.x + (to.x - from.x) * eased;
    const cy = from.y + (to.y - from.y) * eased;
    const r = r0 + (r1 - r0) * eased;
    // The deformation goes with the journey: by the time it is on the lobe it is
    // round, which is what lets the real mark take over without a jump.
    const amplitude = Math.pow(1 - eased, 0.9);

    // Square to begin with, round on arrival, and the same dial does both.
    const exponent = 2 + (SQUARENESS - 2) * amplitude;
    // A superellipse reaches furthest at its corners; dividing by that keeps the
    // shape the size it was asked for rather than growing it.
    const corner = Math.pow(2, 0.5 - 1 / exponent);
    const turn = spin + spinDrift * t;

    const radii = Array.from({ length: BLOB_POINTS }, (_, k) => {
      const angle = (k * 2 * Math.PI) / BLOB_POINTS;

      const a = angle + turn;
      const body = Math.pow(
        Math.pow(Math.abs(Math.cos(a)), exponent) + Math.pow(Math.abs(Math.sin(a)), exponent),
        -1 / exponent,
      ) / corner;

      let offset = 0;
      for (const swell of swells) {
        const centre = swell.angle + swell.drift * t;
        // Breathes between a tenth of its depth and all of it, never through it.
        const depth = swell.sign * swell.depth
          * (0.55 + 0.45 * Math.sin(swell.phase + swell.speed * t * Math.PI * 2));
        const d = around(angle, centre);
        offset += depth * Math.exp(-(d * d) / (2 * swell.width * swell.width));
      }
      // Swells that happen to line up would otherwise pinch the outline to a
      // point or blow it out into a balloon.
      return Math.min(1.5, Math.max(0.32, body * (1 + amplitude * offset)));
    });

    frames.push(blobPath(cx, cy, r, radii));
  }
  return frames;
}
