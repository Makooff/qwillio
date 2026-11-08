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
  { id: 'v1', emotion: 'confident', say: 'Votre réceptionniste ne fait pas que décrocher.', serif: [5] },
  { id: 'v2', emotion: 'happy', say: 'Elle reconnaît vos clients.', serif: [3] },
  { id: 'v3', emotion: 'excited', say: 'Elle prend, déplace et annule vos rendez-vous.', serif: [6] },
  { id: 'v4', emotion: 'enthusiastic', say: 'Elle parle français, anglais et néerlandais.', serif: [5] },
  { id: 'v5', emotion: 'serious', say: 'Une urgence ? Elle vous la passe.', serif: [5] },
  { id: 'v6', emotion: 'calm', say: 'Elle note chaque message.', serif: [3] },
  { id: 'v7', emotion: 'curious', say: 'Ce qu’elle ne sait pas, elle l’apprend.', serif: [5] },
  { id: 'v8', emotion: 'affectionate', say: 'Qwillio. Elle décroche quand vous ne pouvez pas.', show: 'Elle décroche quand vous ne pouvez pas.', serif: [4, 5, 6] },
];

// Ce que la réceptionniste dit dans les scènes.
export const CLIPS = [
  { id: 'k1', lang: 'fr', emotion: 'happy', say: 'Bonjour Monsieur Leroy ! C’est pour votre rendez-vous de jeudi ?' },
  { id: 'k2', lang: 'fr', emotion: 'content', say: 'Bonjour, Le Comptoir, je vous écoute.' },
  { id: 'k3', lang: 'en', emotion: 'content', say: 'Hello, Le Comptoir, how can I help?' },
  { id: 'k4', lang: 'nl', emotion: 'content', say: 'Goedenavond, Le Comptoir, waarmee kan ik helpen?' },
];

fs.mkdirSync('public/voices', { recursive: true });
const out = { lines: {}, clips: {} };
for (const l of LINES) {
  const s = await speak(SARAH, l.say, l.emotion, `public/voices/v4-${l.id}`);
  const shown = (l.show ?? l.say).split(' ');
  const lead = s.words.slice(Math.max(0, s.words.length - shown.length));
  const words = shown.map((w, i) => ({ w, start: +(lead.length === shown.length ? lead[i] : lead[Math.floor((i / shown.length) * lead.length)]).start.toFixed(3) }));
  out.lines[l.id] = { file: `voices/v4-${l.id}.mp3`, duration: +s.duration.toFixed(3), serif: l.serif, words };
  console.log(l.id, s.duration.toFixed(2) + 's', l.say);
}
for (const c of CLIPS) {
  const s = await speak(SARAH, c.say, c.emotion, `public/voices/v4-${c.id}`, c.lang);
  out.clips[c.id] = { file: `voices/v4-${c.id}.mp3`, duration: +s.duration.toFixed(3), lang: c.lang, words: s.words.map((w) => ({ w: w.w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })) };
  console.log(c.id, s.duration.toFixed(2) + 's', c.say);
}
fs.writeFileSync('src/pub4/voices.ts', `// Généré par scripts/cartesia-v4.mjs, ne pas éditer.\nconst voices = ${JSON.stringify(out, null, 1)};\nexport default voices as { lines: Record<string, { file: string; duration: number; serif: number[]; words: { w: string; start: number }[] }>; clips: Record<string, { file: string; duration: number; lang: string; words: { w: string; start: number; end: number }[] }> };\n`);
