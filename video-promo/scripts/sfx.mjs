// Écrit la liste des sons à partir de la frise d'une composition : l'image et le
// son lisent les mêmes instants. `node --experimental-strip-types scripts/sfx.mjs`
// pour le film 16:9, `... scripts/sfx.mjs pub` pour la pub verticale.
import fs from 'fs';
const which = process.argv[2] === 'pub' ? 'pub' : 'film';
const { CUES, DURATION } = await import(which === 'pub' ? '../src/pub/timeline.ts' : '../src/timeline.ts');
const out = which === 'pub' ? 'scripts/sfx-pub.json' : 'scripts/sfx.json';
fs.writeFileSync(out, JSON.stringify({ duration: DURATION, cues: CUES }));
console.log(CUES.length, 'sons ->', out);
