// La voix narrative de la pub v3 : elle lit chaque phrase affichée à l'écran,
// comme les vidéos TikTok qui ont servi de référence. ElevenLabs « with-timestamps »
// donne le minutage caractère par caractère : la frise (src/pub3/timeline.ts)
// pose chaque phrase sur la durée réelle de sa lecture, et chaque mot sort du
// flou au moment où il est dit. La clé est injectée par le proxy.
// Usage : NODE_USE_ENV_PROXY=1 node scripts/narration.mjs [voiceId]
import fs from 'fs';

const VOICE = process.argv[2] ?? 'cjVigY5qzO86Huf0OWal'; // Eric, « Smooth, Trustworthy »
const MODEL = process.env.MODEL ?? 'eleven_v3';

// `say` est ce qui est lu, `show` ce qui est affiché (les chiffres s'écrivent).
export const NARRATION = [
  { id: 'n1', say: 'Samedi, vingt heures douze.', show: 'Samedi, 20 h 12.', serif: [1, 2, 3] },
  { id: 'n2', say: 'Le téléphone vibre.', show: 'Le téléphone vibre.', serif: [2] },
  { id: 'n3', say: 'Les mains dans la pâte.', show: 'Les mains dans la pâte.', serif: [4] },
  { id: 'n4', say: 'Julie réserve en face.', show: 'Julie réserve en face.', serif: [2, 3] },
  { id: 'n5', say: 'Même soirée.', show: 'Même soirée.', serif: [1] },
  { id: 'n6', say: 'Cette fois…', show: 'Cette fois…', serif: [1] },
  { id: 'n7', say: 'Réservé. Les mains toujours dans la pâte.', show: 'Réservé. Les mains toujours dans la pâte.', serif: [6] },
  { id: 'n8', say: 'Déjà dans votre agenda.', show: 'Déjà dans votre agenda.', serif: [3] },
  { id: 'n9', say: 'Julie a sa table.', show: 'Julie a sa table.', serif: [] },
  { id: 'n10', say: 'Vous, vos pizzas.', show: 'Vous, vos pizzas.', serif: [2] },
  { id: 'n11', say: 'Qwillio. Elle décroche quand vous ne pouvez pas.', show: 'Elle décroche quand vous ne pouvez pas.', serif: [4, 5, 6] },
];

const out = [];
for (const l of NARRATION) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': 'proxy-injected' },
    body: JSON.stringify({ text: l.say, model_id: MODEL, language_code: 'fr', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } }),
  });
  if (!res.ok) { console.error(l.id, res.status, await res.text()); process.exit(1); }
  const j = await res.json();
  fs.writeFileSync(`public/voices/${l.id}.mp3`, Buffer.from(j.audio_base64, 'base64'));
  const a = j.alignment;
  // Mots lus, avec leur début et leur fin.
  const spoken = [];
  let cur = null;
  a.characters.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) spoken.push(cur); cur = null; return; }
    if (!cur) cur = { start: a.character_start_times_seconds[i], end: 0 };
    cur.end = a.character_end_times_seconds[i];
  });
  if (cur) spoken.push(cur);
  // Mots affichés : quand ils diffèrent des mots lus (chiffres, « Qwillio. » en
  // tête), on les répartit sur la même durée, à proportion.
  const shown = l.show.split(' ');
  const first = l.say.split(' ').length - shown.length; // mots lus avant l'affichage
  const lead = spoken.slice(Math.max(0, first));
  const words = shown.map((w, i) => {
    const k = lead.length === shown.length ? lead[i] : lead[Math.floor((i / shown.length) * lead.length)];
    return { w, start: +k.start.toFixed(3) };
  });
  out.push({ id: l.id, file: `voices/${l.id}.mp3`, duration: +a.character_end_times_seconds.at(-1).toFixed(3), serif: l.serif, words });
  console.log(l.id, out.at(-1).duration.toFixed(2) + 's', l.say);
}
fs.writeFileSync('src/pub3/narration.ts', `// Généré par scripts/narration.mjs, ne pas éditer.\nexport default ${JSON.stringify(out, null, 1)} as Array<{ id: string; file: string; duration: number; serif: number[]; words: { w: string; start: number }[] }>;\n`);
