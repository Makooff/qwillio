// Les sons des animations de texte, découpés dans la vidéo de référence fournie
// par le propriétaire (« Premium SFX, text animation sound effects »). Chaque
// son est pris à l'instant où la référence le joue sur son animation ; voir
// src/fx.tsx pour l'usage. Le fichier source n'est pas versionné : le passer en
// argument.
//   node scripts/cut-sfx.mjs <video-de-reference.mp4>
import fs from 'fs';
import { execFileSync } from 'child_process';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage : node scripts/cut-sfx.mjs <video-de-reference.mp4>'); process.exit(1); }
const CUTS = {
  type: [0.125, 0.215], // une lettre tapée
  click: [1.34, 1.44], // un mot qui se pose
  glitch: [3.95, 4.56], // le dédoublement rouge et cyan
  counter: [6.46, 7.36], // le compteur qui défile
  pop: [8.05, 8.34], // le mot qui arrive en rebondissant
  lowtick: [9.86, 9.96],
  tracking: [9.72, 10.42], // les lettres espacées qui se resserrent
  thump: [12.53, 13.08], // le mot qui tombe
};
fs.mkdirSync('public/media/sfx', { recursive: true });
for (const [name, [a, b]] of Object.entries(CUTS)) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(a), '-to', String(b), '-i', src, '-ac', '1', '-af', 'afade=t=in:d=0.003,areverse,afade=t=in:d=0.02,areverse,loudnorm=I=-16:TP=-1.5', '-ar', '44100', `public/media/sfx/${name}.wav`]);
  console.log('ok', name);
}
