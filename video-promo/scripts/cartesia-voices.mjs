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
import { speak } from './cartesia-lib.mjs';


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
  // La cause est dite : personne ne décroche, ALORS elle réserve ailleurs
  // (retour du propriétaire : « on ne comprend pas qu'elle réserve en face
  // parce que personne ne décroche »).
  { id: 'n3', emotion: 'frustrated', say: 'Les mains dans la pâte, personne ne décroche.', show: 'Les mains dans la pâte, personne ne décroche.', serif: [6] },
  { id: 'n4', emotion: 'sad', say: 'Alors Julie réserve en face.', show: 'Alors Julie réserve en face.', serif: [3, 4] },
  { id: 'n5', emotion: 'calm', say: 'Même soirée.', show: 'Même soirée.', serif: [1] },
  { id: 'n6', emotion: 'excited', say: 'Cette fois…', show: 'Cette fois…', serif: [1] },
  { id: 'n7', emotion: 'happy', say: 'Réservé. Les mains toujours dans la pâte.', show: 'Réservé. Les mains toujours dans la pâte.', serif: [6] },
  { id: 'n8', emotion: 'excited', say: 'Déjà dans votre agenda.', show: 'Déjà dans votre agenda.', serif: [3] },
  { id: 'n9', emotion: 'happy', say: 'Julie a sa table.', show: 'Julie a sa table.', serif: [] },
  { id: 'n10', emotion: 'joking/comedic', say: 'Vous, vos pizzas.', show: 'Vous, vos pizzas.', serif: [2] },
  { id: 'n11', emotion: 'affectionate', say: 'Qwillio. Elle décroche quand vous ne pouvez pas.', show: 'Elle décroche quand vous ne pouvez pas.', serif: [4, 5, 6] },
];

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
  // Julie appelle : sa voix passe par une ligne téléphonique (bande 300-3 300 Hz,
  // compression, échantillonnage à 8 kHz), pour qu'on entende qu'elle est au
  // bout du fil et que Sarah, elle, est dans la pièce.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `public/voices/${l.id}-A.mp3`, '-af', 'highpass=f=320,lowpass=f=3300,acompressor=threshold=-20dB:ratio=4:attack=5:release=60,aresample=8000,aresample=44100,volume=1.5', `public/voices/${l.id}-A-tel.mp3`]);
  return { id: l.id, who: l.who, text: j.text, file: `voices/${l.id}-A-tel.mp3`, duration: +en[en.length - 1].toFixed(3), words };
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

// ONLY=n3,n4 ne refait que ces phrases : les autres prises sont gardées telles
// que le propriétaire les a validées.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const prevNarr = fs.existsSync('src/pub3/narration.ts')
  ? JSON.parse(fs.readFileSync('src/pub3/narration.ts', 'utf8').replace(/^[\s\S]*?export default /, '').replace(/ as Array[\s\S]*$/, ''))
  : [];
const narration = [];
for (const l of NARRATION) {
  const keep = ONLY && !ONLY.includes(l.id) && prevNarr.find((p) => p.id === l.id);
  if (keep) { narration.push(keep); continue; }
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
