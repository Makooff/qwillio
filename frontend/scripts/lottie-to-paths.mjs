/**
 * Turn the reference Lottie's shape keyframes into plain SVG path strings.
 *
 * The file is a single layer whose outline is animated vertex by vertex. That
 * data is all we want: extracting it at build time gives the exact artwork with
 * none of the runtime — no player library, no JSON parsed in the browser.
 */
import { readFileSync, writeFileSync } from 'fs';

const lottie = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const layer = lottie.layers[0];

// Lottie nests transforms: the layer places and scales the group, the group
// places and scales the shape. Both have to be applied or the outline lands
// somewhere else at the wrong size.
const layerScale = layer.ks.s.k[0] / 100;
const layerPos = layer.ks.p.k;
const layerAnchor = layer.ks.a.k;
const group = layer.shapes.find(s => s.nm === 'Group 1');
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

const path = group.it.find(it => it.ty === 'sh');
const frames = path.ks.k.map(kf => toPath(kf.s[0]));
const points = path.ks.k[0].s[0].v.length;
writeFileSync(process.argv[3], `${JSON.stringify({ points, frames }, null, 2)}\n`);
console.log(`${frames.length} frames, ${points} vertices`);
