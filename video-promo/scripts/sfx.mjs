// Écrit la liste des sons à partir de la frise d'une composition : l'image et le
// son lisent les mêmes instants. `node --experimental-strip-types scripts/sfx.mjs`
// pour le film 16:9, `... scripts/sfx.mjs pub` pour la pub verticale.
import fs from 'fs';
const which = ['pub', 'pub2', 'pub3', 'pub4'].includes(process.argv[2]) ? process.argv[2] : 'film';
const src = { film: '../src/timeline.ts', pub: '../src/pub/timeline.ts', pub2: '../src/pub2/timeline.ts', pub3: '../src/pub3/timeline.ts', pub4: '../src/pub4/timeline.ts' }[which];
const { CUES, DURATION } = await import(src);
const out = { film: 'scripts/sfx.json', pub: 'scripts/sfx-pub.json', pub2: 'scripts/sfx-pub2.json', pub3: 'scripts/sfx-pub3.json', pub4: 'scripts/sfx-pub4.json' }[which];
fs.writeFileSync(out, JSON.stringify({ duration: DURATION, cues: CUES }));
console.log(CUES.length, 'sons ->', out);
