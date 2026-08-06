/**
 * Turn the reference Lottie's animated outline into plain SVG path strings.
 *
 * The file is a single layer whose shape is animated vertex by vertex. That data
 * is all we want: extracting it at build time gives the exact artwork with none
 * of the runtime — no player library, no JSON parsed in the browser.
 *
 * Six keyframes is what the file stores, but not what it plays: between them
 * every vertex and every handle is interpolated on the keyframe's own easing
 * curve. Handing those six poses straight to an animation and letting it blend
 * them linearly gives a different, lumpier motion. So this samples the timeline
 * the way a player would and writes out the poses it actually passes through.
 *
 * Usage: node lottie-to-paths.mjs <in.lottie|in.json> <out.ts> [samples]
 */
import { readFileSync, writeFileSync } from 'fs';
import { inflateRawSync } from 'zlib';

/**
 * A .lottie is a zip. Rather than take a dependency to read one two-entry
 * archive, walk the local file headers: they carry the name, the method and the
 * compressed size, which is everything needed to pull the animation out.
 */
function readLottie(file) {
  const buf = readFileSync(file);
  if (file.endsWith('.json')) return JSON.parse(buf.toString('utf8'));

  let at = 0;
  while (at + 30 <= buf.length && buf.readUInt32LE(at) === 0x04034b50) {
    const method = buf.readUInt16LE(at + 8);
    const size = buf.readUInt32LE(at + 18);
    const nameLength = buf.readUInt16LE(at + 26);
    const extraLength = buf.readUInt16LE(at + 28);
    const name = buf.subarray(at + 30, at + 30 + nameLength).toString('utf8');
    const start = at + 30 + nameLength + extraLength;
    const body = buf.subarray(start, start + size);
    if (/^animations\/.+\.json$/.test(name)) {
      return JSON.parse((method === 8 ? inflateRawSync(body) : body).toString('utf8'));
    }
    at = start + size;
  }
  throw new Error(`no animation found in ${file}`);
}

const lottie = readLottie(process.argv[2]);
const samples = Number(process.argv[4] ?? 24);
const layer = lottie.layers[0];

// Lottie nests transforms: the layer places and scales the group, the group
// places and scales the shape. Both have to be applied or the outline lands
// somewhere else at the wrong size.
const layerScale = layer.ks.s.k[0] / 100;
const layerPos = layer.ks.p.k;
const layerAnchor = layer.ks.a.k;
const group = layer.shapes.find(s => s.it?.some(it => it.ty === 'sh' && it.ks.a === 1));
const groupTr = group.it.find(i => i.ty === 'tr');
const groupScale = groupTr.s.k[0] / 100;
const groupPos = groupTr.p.k;

const toDoc = ([x, y]) => {
  const gx = x * groupScale + groupPos[0];
  const gy = y * groupScale + groupPos[1];
  return [
    (gx - layerAnchor[0]) * layerScale + layerPos[0],
    (gy - layerAnchor[1]) * layerScale + layerPos[1],
  ];
};
const scaleOnly = ([x, y]) => [x * groupScale * layerScale, y * groupScale * layerScale];

/** One Lottie shape → one closed cubic path, in the file's own 72×72 box. */
function toPath(shape) {
  const { v, i, o } = shape;
  const n = v.length;
  let d = '';
  for (let k = 0; k < n; k++) {
    const from = toDoc(v[k]);
    const to = toDoc(v[(k + 1) % n]);
    const out = scaleOnly(o[k]);
    const into = scaleOnly(i[(k + 1) % n]);
    if (k === 0) d += `M ${from[0].toFixed(2)} ${from[1].toFixed(2)}`;
    d += ` C ${(from[0] + out[0]).toFixed(2)} ${(from[1] + out[1]).toFixed(2)}`
      + ` ${(to[0] + into[0]).toFixed(2)} ${(to[1] + into[1]).toFixed(2)}`
      + ` ${to[0].toFixed(2)} ${to[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

/**
 * The easing between two keyframes, solved for x.
 *
 * Lottie stores the segment's curve on the keyframe it starts from: `o` is the
 * outgoing control point, `i` the incoming one of the segment's end. Both are
 * normalised, so this is the same cubic-bezier a CSS transition uses, and the
 * same trick applies — bisect for t, then read y.
 */
function ease(o, i, x) {
  if (!o || !i) return x;
  const bez = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let step = 0; step < 24; step++) {
    const mid = (lo + hi) / 2;
    if (bez(mid, o.x, i.x) < x) lo = mid; else hi = mid;
  }
  return bez((lo + hi) / 2, o.y, i.y);
}

const lerp = (a, b, t) => a.map((pair, k) => [
  pair[0] + (b[k][0] - pair[0]) * t,
  pair[1] + (b[k][1] - pair[1]) * t,
]);

/** The outline at an arbitrary time, as a player would compute it. */
function poseAt(keys, time) {
  let index = 0;
  while (index < keys.length - 2 && keys[index + 1].t <= time) index++;
  const a = keys[index];
  const b = keys[index + 1];
  const span = b.t - a.t;
  const t = ease(a.o, a.i, span > 0 ? (time - a.t) / span : 0);
  return {
    v: lerp(a.s[0].v, b.s[0].v, t),
    i: lerp(a.s[0].i, b.s[0].i, t),
    o: lerp(a.s[0].o, b.s[0].o, t),
  };
}

const shape = group.it.find(it => it.ty === 'sh');
const keys = shape.ks.k;
// The loop's last keyframe repeats the first, so sampling up to but not
// including it is what makes the sequence join back onto itself.
const loop = keys[keys.length - 1].t - keys[0].t;
const poses = Array.from({ length: samples }, (_, step) =>
  poseAt(keys, keys[0].t + (loop * step) / samples));
const frames = poses.map(toPath);

/** Where the outlines sit, and how much room they take, in the source box. */
function measure() {
  const box = frames.map(d => {
    const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
    const xs = n.filter((_, k) => k % 2 === 0);
    const ys = n.filter((_, k) => k % 2 === 1);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      half: (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) / 4,
    };
  });
  const mean = key => box.reduce((sum, b) => sum + b[key], 0) / box.length;
  return { x: mean('x'), y: mean('y'), half: mean('half') };
}
const centre = measure();

/**
 * A circle the outlines can hand over to.
 *
 * Not in the source: the Lottie loops, while this animation has to land on the
 * mark's own lobe. It is built by projecting the first pose's vertices out onto
 * a circle, each one keeping its own angle, which is what makes the handover a
 * short interpolation rather than a scramble — vertex k stays vertex k, and the
 * winding stays the source's. Evenly spacing the points instead would reverse
 * the direction and every point would cross the shape to reach its place.
 */
function circleFrom(pose) {
  const angles = pose.v.map(([x, y]) => {
    const [dx, dy] = [toDoc([x, y])[0] - centre.x, toDoc([x, y])[1] - centre.y];
    return Math.atan2(dy, dx);
  });
  const at = a => [centre.x + Math.cos(a) * centre.half, centre.y + Math.sin(a) * centre.half];
  const tangent = a => [-Math.sin(a) * centre.half, Math.cos(a) * centre.half];

  let d = '';
  for (let k = 0; k < angles.length; k++) {
    const a = angles[k];
    const b = angles[(k + 1) % angles.length];
    // Shortest way round, so the last segment closes the circle rather than
    // running back over the whole of it.
    let step = b - a;
    while (step > Math.PI) step -= 2 * Math.PI;
    while (step < -Math.PI) step += 2 * Math.PI;
    // The handle length that makes a cubic pass through both vertices as a
    // circle would, for this segment's angle.
    const handle = (4 / 3) * Math.tan(step / 4);
    const from = at(a);
    const to = at(b);
    const out = tangent(a).map(t => t * handle);
    const into = tangent(b).map(t => -t * handle);
    if (k === 0) d += `M ${from[0].toFixed(2)} ${from[1].toFixed(2)}`;
    d += ` C ${(from[0] + out[0]).toFixed(2)} ${(from[1] + out[1]).toFixed(2)}`
      + ` ${(to[0] + into[0]).toFixed(2)} ${(to[1] + into[1]).toFixed(2)}`
      + ` ${to[0].toFixed(2)} ${to[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

const points = keys[0].s[0].v.length;
const round = n => Number(n.toFixed(2));
writeFileSync(process.argv[3], `/**
 * The reference Lottie's outline, extracted to plain SVG paths.
 *
 * Generated by scripts/lottie-to-paths.mjs from scripts/blob-loader.lottie — do
 * not edit by hand. These are the shapes themselves, wide with deep concave
 * notches, which is what a perturbed circle could never be: no amount of nudging
 * a radius produces a shape that folds back into itself.
 *
 * They are samples of the played timeline rather than the ${keys.length} keyframes the
 * file stores. The keyframes are far apart and each carries its own easing, so
 * blending them linearly would give a lumpier motion than the reference's.
 *
 * Every frame carries ${points} vertices in the same order, which is the condition for
 * one to be interpolated into the next.
 */

/** Where the shapes sit in the source box, and how much room they take. */
export const BLOB_CENTRE = { x: ${round(centre.x)}, y: ${round(centre.y)}, half: ${round(centre.half)} };

/** The loop, sampled ${samples} times. */
export const BLOB_FRAMES: string[] = [
${frames.map(d => `  '${d}',`).join('\n')}
];

/**
 * A circle on the same centre, with the same vertices in the same order and the
 * same winding, so the handover to the real mark is an interpolation and not a
 * cut.
 */
export const BLOB_CIRCLE = '${circleFrom(poses[0])}';
`);
console.log(`${frames.length} frames sampled from ${keys.length} keyframes, ${points} vertices`);
