// Trajectoires des deux lobes, calculées par le MÊME code que l'animation
// d'ouverture de la webapp (frontend/src/components/blobPath.ts, utilisé par
// SplashScreen.tsx). Seules changent les dimensions : celles du film.
// Lancer avec : node --experimental-strip-types logo-frames.mjs
import fs from 'fs';
import { liquidJourney } from '../../frontend/src/components/blobPath.ts';

let W = 1920, H = 1080;
// Constantes de SplashScreen.tsx, à l'échelle du film.
const ORB = { r: 116, leftX: 190, rightX: 322 };
const START_R = 0.34;
const SHAPES = [{ key: 'right', seed: 21, side: 1 }, { key: 'left', seed: 7, side: -1 }];

function journey(logo, my) {
  const px = n => (n / 512) * logo;
  const lobeR = px(ORB.r), lobeDX = px(ORB.rightX) - logo / 2, mx = W / 2;
  const r0 = Math.min(W, H) * START_R;
  const out = { lobeR, markY: my };
  for (const s of SHAPES) {
    out[s.key] = liquidJourney({
      from: { x: s.side < 0 ? r0 / 2 : W - r0 / 2, y: my },
      to: { x: mx + s.side * lobeDX, y: my },
      r0, r1: lobeR, seed: s.seed,
    });
  }
  return out;
}

const data = { open: journey(360, 500), close: journey(300, 400) };
// Format vertical (pub 9:16) : mêmes trajectoires, recalculées pour 1080×1920.
W = 1080; H = 1920;
data.vopen = journey(340, 860);
data.vclose = journey(300, 760);
fs.writeFileSync('src/logo-frames.json', JSON.stringify(data));
console.log('frames', data.open.left.length);
