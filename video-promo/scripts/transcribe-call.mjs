// Transforme l'enregistrement réel d'un appel en répliques synchronisées pour
// la pub (src/pub/call.ts), à la place des voix de synthèse.
//
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
//     node scripts/transcribe-call.mjs <enregistrement> [--from=12.5] [--to=41] [--agent=speaker_1] [--out=src/pub]
//
// 1. découpe l'extrait voulu et le normalise (ffmpeg, -16 LUFS, mono 44,1 kHz) ;
// 2. le transcrit avec ElevenLabs Scribe : mots horodatés + qui parle
//    (diarisation à deux voix). La réponse est gardée dans scripts/transcript-raw.json :
//    relancer le script avec d'autres coupes ne repaie pas la transcription
//    (--fresh pour forcer) ;
// 3. regroupe les mots en répliques, coupe une piste par réplique dans
//    public/voices/real-N.mp3 et écrit call.json + call.ts.
// Chaque réplique porte son `offset` dans l'extrait : la frise de la v3 garde
// alors les vrais silences de la conversation au lieu d'en inventer.
// Par défaut, la première voix entendue est la réceptionniste (elle décroche) ;
// --agent=speaker_N corrige si la diarisation dit l'inverse.
// La clé ElevenLabs n'est jamais dans ce fichier : le proxy du conteneur
// l'injecte dans l'en-tête xi-api-key.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const input = process.argv[2];
if (!input || !fs.existsSync(input)) {
  console.error('usage : node scripts/transcribe-call.mjs <enregistrement> [--from=s] [--to=s] [--agent=speaker_N] [--out=src/pub] [--fresh]');
  process.exit(1);
}
const OUT = args.out ?? 'src/pub';
const VOICES = 'public/voices';
const RAW = 'scripts/transcript-raw.json';
fs.mkdirSync(VOICES, { recursive: true });

// 1. L'extrait, normalisé.
const excerpt = path.join(VOICES, 'real-full.mp3');
const cut = [...(args.from ? ['-ss', String(args.from)] : []), ...(args.to ? ['-to', String(args.to)] : [])];
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, ...cut, '-ac', '1', '-ar', '44100', '-af', 'loudnorm=I=-16:TP=-1.5', '-b:a', '192k', excerpt]);

// 2. La transcription (gardée en cache tant que l'extrait ne change pas).
const key = `${path.resolve(input)}|${args.from ?? ''}|${args.to ?? ''}`;
let raw = !args.fresh && fs.existsSync(RAW) ? JSON.parse(fs.readFileSync(RAW, 'utf8')) : null;
if (!raw || raw.key !== key) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', args.lang ?? 'fra');
  form.append('diarize', 'true');
  form.append('num_speakers', '2');
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([fs.readFileSync(excerpt)], { type: 'audio/mpeg' }), 'call.mp3');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': 'proxy-injected' }, body: form });
  const body = await r.text();
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} : ${body}`);
  raw = { key, response: JSON.parse(body) };
  fs.writeFileSync(RAW, JSON.stringify(raw, null, 2));
}
const words = raw.response.words.filter((w) => w.type === 'word');
if (!words.length) throw new Error('Aucun mot reconnu dans l’extrait.');

// 3. Les répliques : une par prise de parole.
const agent = args.agent ?? words[0].speaker_id;
const turns = [];
for (const w of words) {
  const last = turns[turns.length - 1];
  if (last && last.speaker === w.speaker_id) last.words.push(w);
  else turns.push({ speaker: w.speaker_id, words: [w] });
}
const PAD_IN = 0.08, PAD_OUT = 0.15;
const lines = turns.map((turn, i) => {
  const start = Math.max(0, turn.words[0].start - PAD_IN);
  const end = turn.words[turn.words.length - 1].end + PAD_OUT;
  const file = `voices/real-${i + 1}.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', start.toFixed(3), '-to', end.toFixed(3), '-i', excerpt, '-af', 'afade=t=in:d=0.03,areverse,afade=t=in:d=0.06,areverse', path.join('public', file)]);
  return {
    id: `r${i + 1}`,
    who: turn.speaker === agent ? 'agent' : 'caller',
    text: turn.words.map((w) => w.text).join(' '),
    file,
    duration: +(end - start).toFixed(3),
    offset: +start.toFixed(3),
    words: turn.words.map((w) => ({ w: w.text, start: +(w.start - start).toFixed(3), end: +(w.end - start).toFixed(3) })),
  };
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'call.json'), JSON.stringify(lines, null, 2));
fs.writeFileSync(path.join(OUT, 'call.ts'), `// Écrit par scripts/transcribe-call.mjs depuis l'enregistrement réel. Ne pas éditer à la main.\nexport default ${JSON.stringify(lines, null, 2)} as Array<{ id: string; who: 'agent' | 'caller'; text: string; file: string; duration: number; offset?: number; words: { w: string; start: number; end: number }[] }>;\n`);
for (const l of lines) console.log(`${l.offset.toFixed(2).padStart(6)}s  ${l.who === 'agent' ? 'AGENT ' : 'CLIENT'}  ${l.text}`);
console.log(`\n${lines.length} répliques -> ${OUT}/call.ts (la v3 se recale seule ; relancer npm run build:pub3).`);
