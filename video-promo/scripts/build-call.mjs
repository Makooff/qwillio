// Prépare l'appel de la pub à partir des voix générées (scripts/voices.mjs) :
// coupe l'accueil à « Je suis Marie… » et transforme l'alignement caractère
// par caractère d'ElevenLabs en minutage mot par mot, pour que la transcription
// à l'écran suive exactement la voix. Écrit src/pub/call.json.
import fs from 'fs';
import { execFileSync } from 'child_process';

const SUFFIX = process.argv[2] ?? '-A';
const ids = ['a1', 'c1', 'a2', 'c2', 'a3'];
const out = [];
for (const id of ids) {
  const j = JSON.parse(fs.readFileSync(`public/voices/${id}${SUFFIX}.json`, 'utf8'));
  const a = j.alignment;
  let text = j.text, start = 0, file = `voices/${id}${SUFFIX}.mp3`;
  if (id === 'a1') {
    // L'accueil complet dure six secondes ; la pub garde la présentation.
    const from = text.indexOf('Je suis');
    start = a.character_start_times_seconds[from] - 0.05;
    text = text.slice(from);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-i', `public/${file}`, '-af', 'afade=t=in:d=0.04', `public/voices/a1cut${SUFFIX}.mp3`]);
    file = `voices/a1cut${SUFFIX}.mp3`;
  }
  // Mots : suites de caractères non blancs, avec le temps du premier et du dernier.
  const chars = a.characters, st = a.character_start_times_seconds, en = a.character_end_times_seconds;
  const offset = id === 'a1' ? j.text.indexOf('Je suis') : 0;
  const words = [];
  let cur = null;
  for (let i = offset; i < chars.length; i++) {
    if (/\s/.test(chars[i])) { if (cur) { words.push(cur); cur = null; } continue; }
    if (!cur) cur = { w: '', start: st[i] - start, end: en[i] - start };
    cur.w += chars[i]; cur.end = en[i] - start;
  }
  if (cur) words.push(cur);
  out.push({ id, who: j.who, text, file, duration: en[en.length - 1] - start, words });
}
fs.writeFileSync('src/pub/call.json', JSON.stringify(out, null, 1));
// Le même contenu en module, lisible par Remotion ET par Node (scripts/sfx.mjs).
fs.writeFileSync('src/pub/call.ts', `// Généré par scripts/build-call.mjs, ne pas éditer.\nexport default ${JSON.stringify(out)} as Array<{ id: string; who: 'agent' | 'caller'; text: string; file: string; duration: number; words: Array<{ w: string; start: number; end: number }> }>;\n`);
console.log(out.map((l) => `${l.id} ${l.duration.toFixed(2)}s ${l.words.length} mots`).join('\n'));
