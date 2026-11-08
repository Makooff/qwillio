// Les voix de l'appel, générées par ElevenLabs avec l'alignement caractère par
// caractère (endpoint « with-timestamps »), pour que la transcription à l'écran
// suive exactement la voix. La clé est injectée par le proxy de l'environnement :
// aucune clé n'est lue ni écrite ici.
// Usage : node scripts/voices.mjs [agentVoiceId] [callerVoiceId] [suffixe]
// Variables : ONLY=agent|caller (ne régénère qu'une voix), MODEL=eleven_v3 …
// eleven_v3 est le plus naturel ; sa stabilité n'accepte que 0, 0,5 ou 1.
import fs from 'fs';

const AGENT = process.argv[2] ?? 'EXAVITQu4vr4xnSDxMaL';
const CALLER = process.argv[3] ?? 'cgSgspJ2msm6clMCkdW9';
const SUFFIX = process.argv[4] ?? '';

// L'accueil reprend mot pour mot celui du produit (onboarding.service.ts,
// generateFirstMessage) : la réceptionniste s'annonce comme une IA.
export const LINES = [
  { id: 'a1', who: 'agent', text: 'Bonsoir, merci d’appeler Le Comptoir. Je suis Marie, votre assistante IA. Comment puis-je vous aider ?' },
  { id: 'c1', who: 'caller', text: 'Bonsoir ! Vous auriez une table pour quatre, ce soir, vers vingt heures ?' },
  { id: 'a2', who: 'agent', text: 'Ce soir, j’ai vingt heures trente. Je vous la réserve ?' },
  { id: 'c2', who: 'caller', text: 'Parfait, au nom de Julie.' },
  { id: 'a3', who: 'agent', text: 'C’est noté, Julie. Vous recevez la confirmation par SMS.' },
];

const ONLY = process.env.ONLY;
const MODEL = process.env.MODEL ?? 'eleven_multilingual_v2';
const SETTINGS = MODEL === 'eleven_v3'
  ? { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true }
  : { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };
for (const l of LINES) {
  if (ONLY && l.who !== ONLY) continue;
  const voice = l.who === 'agent' ? AGENT : CALLER;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': 'proxy-injected' },
    body: JSON.stringify({
      text: l.text,
      model_id: MODEL,
      language_code: 'fr',
      voice_settings: SETTINGS,
    }),
  });
  if (!res.ok) { console.error(l.id, res.status, await res.text()); process.exit(1); }
  const j = await res.json();
  fs.writeFileSync(`public/voices/${l.id}${SUFFIX}.mp3`, Buffer.from(j.audio_base64, 'base64'));
  fs.writeFileSync(`public/voices/${l.id}${SUFFIX}.json`, JSON.stringify({ text: l.text, who: l.who, voice, alignment: j.alignment }));
  const a = j.alignment;
  console.log(l.id, voice, (a.character_end_times_seconds.at(-1)).toFixed(2) + 's');
}
