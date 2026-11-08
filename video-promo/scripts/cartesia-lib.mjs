// La synthèse Cartesia partagée par les pubs : une phrase, son MP3 et le
// minutage de chaque mot (endpoint SSE, `add_timestamps`). La clé est injectée
// par le proxy de l'environnement (X-API-Key) ; elle n'est jamais ici.
import fs from 'fs';
import { execFileSync } from 'child_process';

const MODEL = process.env.CARTESIA_MODEL ?? 'sonic-3.5';
const VERSION = '2024-11-13';
const SR = 44100;

export /** Une phrase : l'audio (MP3 écrit sur disque) et le minutage de ses mots. */
async function speak(voice, text, emotion, out, language = 'fr') {
  const body = (withEmotion) => JSON.stringify({
    model_id: MODEL,
    transcript: text,
    voice: { mode: 'id', id: voice },
    language,
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

