import { useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import api from '../../services/api';

export interface Character {
  id: string;
  name: string;
  language: 'fr' | 'en';
  accent: 'FR' | 'BE' | 'US';
  gender: 'f' | 'm';
  personaKey: string;
  taglineFr: string;
  taglineEn: string;
  previewFr: string;
  previewEn: string;
}

// Browser TTS preview. This is a rough in-app preview only — the real call uses
// the ElevenLabs voice; this just lets the client hear the tone/line quickly.
function speak(text: string, lang: 'fr' | 'en', onEnd: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const match = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
  if (match) u.voice = match;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

/** iOS Safari plays a data: URL reliably where a blob: URL decodes to silence. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('read_failed'));
    reader.readAsDataURL(blob);
  });
}

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

export default function CharacterPicker({
  characters, value, onChange, isFr = true,
}: {
  characters: Character[];
  value: string;
  onChange: (id: string) => void;
  isFr?: boolean;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAll = () => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  };

  // Try the real ElevenLabs voice first; fall back to browser TTS if the
  // backend has no ElevenLabs key (503) or the request fails. The fallback is
  // announced — silently playing a robotic voice makes a misconfigured server
  // look like a bad voice.
  //
  // iOS Safari only lets audio start from inside a user gesture, and an `await`
  // ends that window. So the element is created and unlocked synchronously on
  // the click, and the fetched clip is swapped into that already-unlocked
  // element afterwards. Without this nothing plays at all on iPhone/iPad —
  // not even the fallback voice.
  const preview = (c: Character) => {
    if (playing === c.id) { stopAll(); setPlaying(null); return; }
    stopAll();
    setPlaying(c.id);

    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    // Silent 1-sample WAV: playing it inside the gesture unlocks the element.
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQAAAAA=';
    const unlocked = audio.play().catch(() => undefined);

    void (async () => {
      try {
        const { data } = await api.get(`/my-dashboard/characters/${c.id}/preview`, { responseType: 'blob' });
        await unlocked;
        if (audioRef.current !== audio) return; // superseded by another click

        // A `blob:` URL on an <audio> element silently decodes to nothing on
        // iOS Safari: play() resolves, no error fires, and the button stays
        // stuck on stop forever. A data: URL is the one form it always plays.
        // The explicit mime type matters too — the blob axios builds does not
        // always carry one, and iOS refuses a source it cannot type.
        const url = await blobToDataUrl(new Blob([data as Blob], { type: 'audio/mpeg' }));
        if (audioRef.current !== audio) return;

        audio.onended = () => setPlaying(null);
        audio.onerror = () => setPlaying(null);
        audio.src = url;
        // Swapping src on an element that already played needs an explicit
        // reload on iOS; without it the element keeps the finished silent clip.
        audio.load();
        setNotice(null);
        await audio.play();

        // play() resolving is not proof of sound: it resolves on iOS even when
        // nothing decodes. Only a `playing` event is. Without this watchdog the
        // failure mode is a button that never comes back, which reads as a dead
        // app rather than a problem worth reporting.
        await new Promise<void>((resolve, reject) => {
          const ok = () => { cleanup(); resolve(); };
          const ko = () => { cleanup(); reject(new Error('audio_silent')); };
          const timer = window.setTimeout(ko, 2500);
          function cleanup() {
            window.clearTimeout(timer);
            audio.removeEventListener('playing', ok);
            audio.removeEventListener('error', ko);
          }
          audio.addEventListener('playing', ok);
          audio.addEventListener('error', ko);
        });
      } catch (err) {
        if (audioRef.current !== audio) return;

        // The clip arrived but the device produced no sound. Almost always the
        // iPhone's ring/silent switch, which mutes <audio> without telling the
        // page anything. Naming it is the difference between a five-second fix
        // and concluding the product is broken.
        if ((err as Error)?.message === 'audio_silent') {
          setNotice(isFr
            ? "Aucun son n'est sorti. Sur iPhone, l'interrupteur latéral coupe le son des pages web même quand le volume est au maximum."
            : 'No sound came out. On iPhone, the side switch mutes web audio even at full volume.');
          setPlaying(null);
          return;
        }

        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        // The request asks for a Blob, so an error body arrives as one too and
        // has to be decoded before the upstream status is readable.
        let upstream: number | undefined;
        if (res?.data instanceof Blob) {
          try { upstream = JSON.parse(await res.data.text())?.status; } catch { /* not JSON */ }
        }
        setNotice(
          res?.status === 503
            ? (isFr
              ? 'Voix réelles indisponibles : la clé ElevenLabs n\'est pas configurée sur le serveur. Aperçu joué avec la voix du navigateur.'
              : 'Real voices unavailable: the ElevenLabs key is not configured on the server. Playing the browser voice instead.')
            : (isFr
              ? `Aperçu ElevenLabs indisponible (ElevenLabs a répondu ${upstream ?? '?'}). Aperçu joué avec la voix du navigateur.`
              : `ElevenLabs preview unavailable (ElevenLabs replied ${upstream ?? '?'}). Playing the browser voice instead.`),
        );
        speak(isFr ? c.previewFr : c.previewEn, c.language, () => setPlaying(null));
      }
    })();
  };

  return (
    <>
    {notice && (
      <p
        role="status"
        className="mb-2 rounded-lg px-3 py-2 text-[11px] leading-snug"
        style={{ background: 'rgba(221,147,252,0.10)', border: '1px solid rgba(221,147,252,0.30)', color: '#e7bafd' }}
      >
        {notice}
      </p>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {characters.map(c => {
        const sel = value === c.id;
        const tagline = isFr ? c.taglineFr : c.taglineEn;
        return (
          <div
            key={c.id}
            className="text-left p-3 rounded-xl border transition-colors flex items-start gap-3"
            style={{
              background: sel ? 'rgba(122,95,255,0.10)' : '#0A0A0C',
              borderColor: sel ? 'rgba(122,95,255,0.55)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => onChange(c.id)}
              className="flex-1 text-left"
              aria-pressed={sel}
            >
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold" style={{ color: sel ? '#7349fe' : '#F2F2F2' }}>{c.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9A9AA5' }}>
                  {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? (isFr ? 'F' : 'F') : (isFr ? 'H' : 'M')}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(122,95,255,0.85)' : '#8B8BA7' }}>{tagline}</p>
            </button>
            <button
              type="button"
              onClick={() => { preview(c); }}
              aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
              className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors"
              style={{ background: 'rgba(122,95,255,0.14)', color: '#b9a8ff' }}
            >
              {playing === c.id ? <Square size={13} /> : <Play size={13} />}
            </button>
          </div>
        );
      })}
    </div>
    </>
  );
}
