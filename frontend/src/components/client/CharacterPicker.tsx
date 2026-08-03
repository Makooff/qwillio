import { useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import api from '../../services/api';

export interface Character {
  id: string;
  name: string;
  /** Served from /characters/<id>.webp. Empty for a cloned voice. */
  avatar?: string;
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

type AudioCtor = typeof AudioContext;
function audioContextCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext || w.webkitAudioContext || null;
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
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const tokenRef = useRef(0);

  const stopAll = () => {
    window.speechSynthesis?.cancel();
    tokenRef.current += 1;
    if (sourceRef.current) {
      // The handler would otherwise clear the button state of the clip that is
      // starting, not the one being stopped.
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch { /* already finished */ }
      sourceRef.current = null;
    }
  };

  /**
   * Play the real ElevenLabs clip, falling back to browser TTS with a visible
   * notice when the server has no key or the request fails. Announcing the
   * fallback matters: silently playing a robotic voice makes a misconfigured
   * server look like a bad voice.
   *
   * Web Audio rather than an <audio> element, because of iOS. Safari only lets
   * audio start from a user gesture, and any `await` closes that window — so an
   * element has to be created and unlocked synchronously on the click, then have
   * its source swapped afterwards. That swap is where iOS silently fails:
   * `play()` resolves, no error fires, and nothing is ever heard. An
   * AudioContext unlocked in the same gesture keeps working after an await, and
   * decodeAudioData either returns samples or throws — no silent middle ground.
   */
  const preview = (c: Character) => {
    if (playing === c.id) { stopAll(); setPlaying(null); return; }
    stopAll();
    setPlaying(c.id);

    const Ctor = audioContextCtor();
    if (!Ctor) {
      setNotice(isFr
        ? "Ce navigateur ne peut pas lire l'audio. Aperçu joué avec la voix du navigateur."
        : 'This browser cannot play audio. Playing the browser voice instead.');
      speak(isFr ? c.previewFr : c.previewEn, isFr ? 'fr' : 'en', () => setPlaying(null));
      return;
    }

    // Created and resumed inside the click. iOS starts every context suspended
    // and only allows the resume from a gesture; doing it after the fetch would
    // be too late.
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    const resumed = ctx.state === 'suspended' ? ctx.resume().catch(() => undefined) : Promise.resolve();

    const token = ++tokenRef.current;

    void (async () => {
      // Hoisted so the failure message can report the size that arrived.
      let payload: ArrayBuffer | undefined;
      try {
        const { data } = await api.get(`/my-dashboard/characters/${c.id}/preview`, {
          responseType: 'arraybuffer',
        });
        payload = data as ArrayBuffer;
        await resumed;
        if (tokenRef.current !== token) return; // superseded by another click

        if (!payload.byteLength) throw new Error('empty_audio');

        // Throws on anything that is not decodable audio, which is exactly the
        // signal the <audio> element refused to give.
        const buffer = await ctx.decodeAudioData(payload);
        if (tokenRef.current !== token) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          if (tokenRef.current === token) setPlaying(null);
        };
        sourceRef.current = source;
        setNotice(null);
        source.start();
      } catch (err) {
        if (tokenRef.current !== token) return;

        const message = (err as Error)?.message;
        if (message === 'empty_audio' || err instanceof DOMException) {
          // Decodable audio was expected and did not arrive. The size is in the
          // message on purpose: 0 ko means the server sent nothing, a real size
          // means the file is there and the device refused it. Without it this
          // failure is indistinguishable from the previous one.
          const ko = Math.round((payload?.byteLength ?? 0) / 1024);
          setNotice(isFr
            ? `Le fichier audio reçu n'a pas pu être décodé (${ko} ko). Aperçu joué avec la voix du navigateur.`
            : `The audio file could not be decoded (${ko} kB). Playing the browser voice instead.`);
          speak(isFr ? c.previewFr : c.previewEn, isFr ? 'fr' : 'en', () => setPlaying(null));
          return;
        }

        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        // The request asks for raw bytes, so an error body arrives as bytes too
        // and has to be decoded before the upstream status is readable.
        let upstream: number | undefined;
        if (res?.data instanceof ArrayBuffer) {
          try { upstream = JSON.parse(new TextDecoder().decode(res.data))?.status; } catch { /* not JSON */ }
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
        speak(isFr ? c.previewFr : c.previewEn, isFr ? 'fr' : 'en', () => setPlaying(null));
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
              className="flex-1 text-left flex items-start gap-2.5"
              aria-pressed={sel}
            >
              {c.avatar && (
                <img
                  src={c.avatar}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                  // The avatar keeps its lavender square; the circle is what
                  // hides it. Cutting the background out frayed hair edges for
                  // a shape the mask removes anyway.
                  className="flex-shrink-0 w-11 h-11 rounded-full object-cover"
                  style={{ outline: sel ? '2px solid rgba(122,95,255,0.55)' : '1px solid rgba(255,255,255,0.10)', outlineOffset: 1 }}
                />
              )}
              <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold" style={{ color: sel ? '#7349fe' : '#F2F2F2' }}>{c.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9A9AA5' }}>
                  {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? (isFr ? 'F' : 'F') : (isFr ? 'H' : 'M')}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(122,95,255,0.85)' : '#8B8BA7' }}>{tagline}</p>
              </div>
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
