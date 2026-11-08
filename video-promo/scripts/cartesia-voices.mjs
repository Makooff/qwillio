// Toutes les voix de la pub v3 avec Cartesia, le moteur de synthèse du
// produit, et les voix françaises que le portail propose
// (backend/src/config/cartesia-curated.ts) : la réceptionniste de la pub parle
// donc comme une vraie réceptionniste Qwillio.
//
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/cartesia-voices.mjs
//
// L'endpoint SSE rend l'audio par morceaux ET le minutage de chaque mot
// (`add_timestamps`) : c'est ce qui synchronise la transcription et le texte à
// l'écran. Écrit src/pub/call.{json,ts} (l'appel) et src/pub3/narration.ts.
// La clé n'est jamais ici : le proxy de l'environnement l'injecte (X-API-Key).
import fs from 'fs';
import { execFileSync } from 'child_process';

const MODEL = process.env.CARTESIA_MODEL ?? 'sonic-3.5';
const VERSION = '2024-11-13';
const SR = 44100;

export const VOICES = {
  agent: process.env.AGENT ?? '90358bc7-3328-4b93-a942-d0447d7d4b5c', // Sarah - Delivery Liaison (choix du propriétaire)
  caller: process.env.CALLER ?? '2f8e82c4-cb94-4e6d-8b6a-29bf58ceb60a', // Manon - Bright Belle
  // La narration prend la voix de Sarah : la plus naturelle des essais
  // (retour du propriétaire), avec des émotions plus marquées.
  narrator: process.env.NARRATOR ?? '90358bc7-3328-4b93-a942-d0447d7d4b5c',
};

// L'accueil reprend celui du produit (generateFirstMessage) : elle s'annonce
// comme une IA. `emotion` est passé à Cartesia ; refusé, on régénère sans.
const CALL = [
  { id: 'a1', who: 'agent', emotion: 'content', text: 'Je suis Marie, votre assistante IA. Comment puis-je vous aider ?' },
  { id: 'c1', who: 'caller', emotion: 'excited', text: 'Bonsoir ! Vous auriez une table pour quatre, ce soir, vers vingt heures ?' },
  { id: 'a2', who: 'agent', emotion: 'happy', text: 'Ce soir, j’ai vingt heures trente. Je vous la réserve ?' },
  { id: 'c2', who: 'caller', emotion: 'grateful', text: 'Parfait, au nom de Julie.' },
  { id: 'a3', who: 'agent', emotion: 'content', text: 'C’est noté, Julie. Vous recevez la confirmation par SMS.' },
];

// `say` est lu, `show` est affiché (les chiffres s'écrivent).
const NARRATION = [
  { id: 'n1', emotion: 'mysterious', say: 'Samedi, vingt heures douze.', show: 'Samedi, 20 h 12.', serif: [1, 2, 3] },
  { id: 'n2', emotion: 'anxious', say: 'Le téléphone vibre.', show: 'Le téléphone vibre.', serif: [2] },
  { id: 'n3', emotion: 'frustrated', say: 'Les mains dans la pâte.', show: 'Les mains dans la pâte.', serif: [4] },
  { id: 'n4', emotion: 'sad', say: 'Julie réserve en face.', show: 'Julie réserve en face.', serif: [2, 3] },
  { id: 'n5', emotion: 'calm', say: 'Même soirée.', show: 'Même soirée.', serif: [1] },
  { id: 'n6', emotion: 'excited', say: 'Cette fois…', show: 'Cette fois…', serif: [1] },
  { id: 'n7', emotion: 'happy', say: 'Réservé. Les mains toujours dans la pâte.', show: 'Réservé. Les mains toujours dans la pâte.', serif: [6] },
  { id: 'n8', emotion: 'excited', say: 'Déjà dans votre agenda.', show: 'Déjà dans votre agenda.', serif: [3] },
  { id: 'n9', emotion: 'happy', say: 'Julie a sa table.', show: 'Julie a sa table.', serif: [] },
  { id: 'n10', emotion: 'joking/comedic', say: 'Vous, vos pizzas.', show: 'Vous, vos pizzas.', serif: [2] },
  { id: 'n11', emotion: 'affectionate', say: 'Qwillio. Elle décroche quand vous ne pouvez pas.', show: 'Elle décroche quand vous ne pouvez pas.', serif: [4, 5, 6] },
];

/** Une phrase : l'audio (MP3 écrit sur disque) et le minutage de ses mots. */
async function speak(voice, text, emotion, out) {
  const body = (withEmotion) => JSON.stringify({
    model_id: MODEL,
    transcript: text,
    voice: { mode: 'id', id: voice },
    language: 'fr',
    add_timestamps: true,
    ...(withEmotion && emotion ? { generation_config: { emotion } } : {}),
    output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: SR },
  });
  let r = await fetch('https://api.cartesia.ai/tts/sse', { method: 'POST', headers: { 'X-API-Key': 'proxy-injected', 'Cartesia-Version': VERSION, 'Content-Type': 'application/json' }, body: body(true) });
  if (r.status === 400) {
    const why = await r.text();
    console.warn(`  émotion refusée (${why.slice(0, 120)}), sans émotion`);
    r = await fetch('https://api.cartesia.ai/tts/sse', { method: 'POST', headers: { 'X-API-Key': 'proxy-injected', 'Cartesia-Version': VERSION, 'Content-Type': 'application/json' }, body: body(false) });
  }
  if (!r.ok) throw new Error(`Cartesia ${r.status} : ${await r.text()}`);
  const raw = await r.text();
  const chunks = [];
  const words = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const ev = JSON.parse(line.slice(5).trim());
    if (ev.type === 'chunk' && ev.data) chunks.push(Buffer.from(ev.data, 'base64'));
    const wt = ev.word_timestamps;
    if (wt) wt.words.forEach((w, i) => words.push({ w, start: wt.start[i], end: wt.end[i] }));
    if (ev.type === 'error') throw new Error(`Cartesia : ${JSON.stringify(ev)}`);
  }
  const pcm = Buffer.concat(chunks);
  fs.writeFileSync(`${out}.pcm`, pcm);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', `${out}.pcm`, '-b:a', '160k', `${out}.mp3`]);
  fs.unlinkSync(`${out}.pcm`);
  return { duration: pcm.length / 2 / SR, words };
}

fs.mkdirSync('public/voices', { recursive: true });

// Julie garde la voix de la version précédente (ElevenLabs, fichiers `c?-A`),
// choisie par le propriétaire : on relit son minutage au lieu de la régénérer.
function elevenLine(l) {
  const j = JSON.parse(fs.readFileSync(`public/voices/${l.id}-A.json`, 'utf8'));
  const a = j.alignment, st = a.character_start_times_seconds, en = a.character_end_times_seconds;
  const words = [];
  let cur = null;
  a.characters.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) words.push(cur); cur = null; return; }
    if (!cur) cur = { w: '', start: st[i], end: en[i] };
    cur.w += c; cur.end = en[i];
  });
  if (cur) words.push(cur);
  return { id: l.id, who: l.who, text: j.text, file: `voices/${l.id}-A.mp3`, duration: +en[en.length - 1].toFixed(3), words };
}

// Les prises de la réceptionniste déjà validées par le propriétaire sont
// gardées : une régénération donnerait une autre interprétation. REGEN_AGENT=1
// pour les refaire.
const previous = fs.existsSync('src/pub/call.json') ? JSON.parse(fs.readFileSync('src/pub/call.json', 'utf8')) : [];
const call = [];
for (const l of CALL) {
  const kept = previous.find((p) => p.id === l.id && p.file === `voices/cx-${l.id}.mp3`);
  if (l.who === 'agent' && kept && !process.env.REGEN_AGENT && fs.existsSync(`public/${kept.file}`)) { call.push(kept); console.log(l.id, '(prise gardée)'); continue; }
  if (l.who === 'caller' && process.env.CALLER_FROM !== 'cartesia') { call.push(elevenLine(l)); console.log(l.id, '(voix ElevenLabs précédente)'); continue; }
  const s = await speak(VOICES[l.who], l.text, l.emotion, `public/voices/cx-${l.id}`);
  call.push({ id: l.id, who: l.who, text: l.text, file: `voices/cx-${l.id}.mp3`, duration: +s.duration.toFixed(3), words: s.words.map((w) => ({ w: w.w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })) });
  console.log(l.id, s.duration.toFixed(2) + 's', s.words.length, 'mots');
}
fs.writeFileSync('src/pub/call.json', JSON.stringify(call, null, 1));
fs.writeFileSync('src/pub/call.ts', `// Généré par scripts/cartesia-voices.mjs, ne pas éditer.\nexport default ${JSON.stringify(call)} as Array<{ id: string; who: 'agent' | 'caller'; text: string; file: string; duration: number; words: Array<{ w: string; start: number; end: number }> }>;\n`);

const narration = [];
for (const l of NARRATION) {
  const s = await speak(VOICES.narrator, l.say, l.emotion, `public/voices/${l.id}`);
  // Les mots affichés reçoivent le minutage des mots lus ; quand ils diffèrent
  // (chiffres, « Qwillio. » en tête), à proportion de la durée.
  const shown = l.show.split(' ');
  const lead = s.words.slice(Math.max(0, s.words.length - shown.length));
  const words = shown.map((w, i) => ({ w, start: +(lead.length === shown.length ? lead[i] : lead[Math.floor((i / shown.length) * lead.length)]).start.toFixed(3) }));
  narration.push({ id: l.id, file: `voices/${l.id}.mp3`, duration: +s.duration.toFixed(3), serif: l.serif, words });
  console.log(l.id, s.duration.toFixed(2) + 's', l.say);
}
fs.writeFileSync('src/pub3/narration.ts', `// Généré par scripts/cartesia-voices.mjs, ne pas éditer.\nexport default ${JSON.stringify(narration, null, 1)} as Array<{ id: string; file: string; duration: number; serif: number[]; words: { w: string; start: number }[] }>;\n`);
