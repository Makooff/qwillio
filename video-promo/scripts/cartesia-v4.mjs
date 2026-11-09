// Les voix de la pub n° 2, « Elle ne fait pas que décrocher » (src/pub4).
// Tout est dit par Sarah (Cartesia, « Delivery Liaison »), la voix retenue par
// le propriétaire : la narration et les extraits d'appel, dans les trois
// langues que le produit sert. Écrit src/pub4/voices.ts.
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/cartesia-v4.mjs
import fs from 'fs';
import { speak } from './cartesia-lib.mjs';

const SARAH = '90358bc7-3328-4b93-a942-d0447d7d4b5c';

// `say` est lu, `show` affiché. Chaque phrase annonce une fonction réelle du
// produit (voir le README) : rien qui ne soit dans le code.
export const LINES = [
  { id: 'v1', emotion: 'confident', say: 'Votre réceptionniste ne fait pas que décrocher. Regardez plutôt.', serif: [8] },
  { id: 'v2', emotion: 'happy', say: 'Quand un client fidèle appelle, elle le reconnaît tout de suite.', serif: [10] },
  { id: 'v3', emotion: 'excited', say: 'Elle prend vos rendez-vous, les déplace, les annule, sans que vous ayez à lever le petit doigt.', serif: [16] },
  { id: 'v4', emotion: 'enthusiastic', say: 'Elle parle français, anglais et néerlandais, chacun avec son accent.', serif: [9] },
  { id: 'v5', emotion: 'serious', say: 'Et quand c’est vraiment urgent, elle vous passe l’appel immédiatement.', serif: [9] },
  { id: 'v6', emotion: 'calm', say: 'Chaque message est noté, avec le nom, le numéro, et le bon moment pour rappeler.', serif: [14] },
  { id: 'v7', emotion: 'curious', say: 'Ce qu’elle ne sait pas, elle vous le demande. Et ensuite, elle s’en souvient.', serif: [13] },
  { id: 'v9', emotion: 'excited', say: 'Elle peut même parler avec votre propre voix.', serif: [7] },
  { id: 'v10', emotion: 'confident', say: 'Et derrière, les meilleurs modèles de voix et de compréhension, en temps réel.', serif: [11, 12] },
  { id: 'v8', emotion: 'affectionate', say: 'Qwillio. Elle décroche quand vous ne pouvez pas.', show: 'Elle décroche quand vous ne pouvez pas.', serif: [4, 5, 6] },
];

// Ce que la réceptionniste dit dans les scènes.
export const CLIPS = [
  { id: 'k1', lang: 'fr', emotion: 'happy', say: 'Bonjour Monsieur Leroy ! C’est pour votre rendez-vous de jeudi ?' },
  { id: 'k2', lang: 'fr', emotion: 'content', say: 'Bonjour, Le Comptoir, je vous écoute.' },
  // Chaque langue a sa voix native, donc son accent (retour du propriétaire) :
  // Gemma, britannique, et Isa, néerlandaise (catalogue Cartesia).
  { id: 'k3', lang: 'en', voice: '62ae83ad-4f6a-430b-af41-a9bede9286ca', emotion: 'content', say: 'Hello, Le Comptoir, how can I help?' },
  { id: 'k4', lang: 'nl', voice: '60e94cf5-8069-459f-a91e-3ff852a51107', emotion: 'content', say: 'Goedenavond, Le Comptoir, waarmee kan ik helpen?' },
];

fs.mkdirSync('public/voices', { recursive: true });
// ONLY=v9,k3 ne refait que ces prises ; les autres, déjà validées, sont gardées.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const prev = fs.existsSync('src/pub4/voices.ts')
  ? JSON.parse(fs.readFileSync('src/pub4/voices.ts', 'utf8').replace(/^[\s\S]*?const voices = /, '').replace(/;\nexport default[\s\S]*$/, ''))
  : { lines: {}, clips: {} };
const out = { lines: {}, clips: {} };
for (const l of LINES) {
  if (ONLY && !ONLY.includes(l.id) && prev.lines[l.id]) { out.lines[l.id] = prev.lines[l.id]; continue; }
  const s = await speak(SARAH, l.say, l.emotion, `public/voices/v4-${l.id}`);
  const shown = (l.show ?? l.say).split(' ');
  const lead = s.words.slice(Math.max(0, s.words.length - shown.length));
  const words = shown.map((w, i) => ({ w, start: +(lead.length === shown.length ? lead[i] : lead[Math.floor((i / shown.length) * lead.length)]).start.toFixed(3) }));
  out.lines[l.id] = { file: `voices/v4-${l.id}.mp3`, duration: +s.duration.toFixed(3), serif: l.serif, words };
  console.log(l.id, s.duration.toFixed(2) + 's', l.say);
}
for (const c of CLIPS) {
  if (ONLY && !ONLY.includes(c.id) && prev.clips[c.id]) { out.clips[c.id] = prev.clips[c.id]; continue; }
  const s = await speak(c.voice ?? SARAH, c.say, c.emotion, `public/voices/v4-${c.id}`, c.lang);
  out.clips[c.id] = { file: `voices/v4-${c.id}.mp3`, duration: +s.duration.toFixed(3), lang: c.lang, words: s.words.map((w) => ({ w: w.w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })) };
  console.log(c.id, s.duration.toFixed(2) + 's', c.say);
}
fs.writeFileSync('src/pub4/voices.ts', `// Généré par scripts/cartesia-v4.mjs, ne pas éditer.\nconst voices = ${JSON.stringify(out, null, 1)};\nexport default voices as { lines: Record<string, { file: string; duration: number; serif: number[]; words: { w: string; start: number }[] }>; clips: Record<string, { file: string; duration: number; lang: string; words: { w: string; start: number; end: number }[] }> };\n`);
