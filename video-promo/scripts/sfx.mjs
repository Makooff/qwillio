// Écrit la liste des sons à partir de src/timeline.ts : l'image et le son lisent
// les mêmes instants. Lancer avec Node 22.6+ (lecture directe du TypeScript).
import fs from 'fs';
import { CUES, DURATION } from '../src/timeline.ts';
fs.writeFileSync('scripts/sfx.json', JSON.stringify({ duration: DURATION, cues: CUES }));
console.log(CUES.length, 'sons');
