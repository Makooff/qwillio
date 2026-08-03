import { useCallback, useRef, useState } from 'react';
import api from '../../services/api';

/**
 * Play a real ElevenLabs sample from the API, falling back to the browser's own
 * voice with a visible notice when the server has no key or the request fails.
 * Announcing the fallback matters: silently playing a robotic voice makes a
 * misconfigured server look like a bad voice.
 *
 * Web Audio rather than an <audio> element, because of iOS. Safari only lets
 * audio start from a user gesture, and any `await` closes that window — so an
 * element has to be created and unlocked synchronously on the click, then have
 * its source swapped afterwards. That swap is where iOS silently fails:
 * `play()` resolves, no error fires, and nothing is ever heard. An AudioContext
 * unlocked in the same gesture keeps working after an await, and
 * decodeAudioData either returns samples or throws — no silent middle ground.
 *
 * Shared by the character grid and the voice list: both hit the same endpoint
 * and both broke on iOS in exactly the same way.
 */

type AudioCtor = typeof AudioContext;
function audioContextCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext || w.webkitAudioContext || null;
}

// Browser TTS fallback. A rough preview only — the real call uses ElevenLabs.
function speak(text: string, lang: 'fr' | 'en', onEnd: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const match = window.speechSynthesis.getVoices()
    .find(v => v.lang?.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
  if (match) u.voice = match;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

export interface VoicePreview {
  /** Key of the clip currently playing, or null. */
  playing: string | null;
  /** Why the real voice could not be played, in the client's language. */
  notice: string | null;
  /** Click handler: starts the clip, or stops it when it is the one playing. */
  toggle: (key: string, url: string, fallbackText: string) => void;
  stop: () => void;
}

export function useVoicePreview(isFr: boolean): VoicePreview {
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const tokenRef = useRef(0);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    tokenRef.current += 1;
    if (sourceRef.current) {
      // The handler would otherwise clear the button state of the clip that is
      // starting, not the one being stopped.
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch { /* already finished */ }
      sourceRef.current = null;
    }
  }, []);

  const toggle = useCallback((key: string, url: string, fallbackText: string) => {
    if (playing === key) { stop(); setPlaying(null); return; }
    stop();
    setPlaying(key);

    const lang = isFr ? 'fr' : 'en';
    const Ctor = audioContextCtor();
    if (!Ctor) {
      setNotice(isFr
        ? "Ce navigateur ne peut pas lire l'audio. Aperçu joué avec la voix du navigateur."
        : 'This browser cannot play audio. Playing the browser voice instead.');
      speak(fallbackText, lang, () => setPlaying(null));
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
        const { data } = await api.get(url, { responseType: 'arraybuffer' });
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
          speak(fallbackText, lang, () => setPlaying(null));
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
              ? "Voix réelles indisponibles : la clé ElevenLabs n'est pas configurée sur le serveur. Aperçu joué avec la voix du navigateur."
              : 'Real voices unavailable: the ElevenLabs key is not configured on the server. Playing the browser voice instead.')
            : (isFr
              ? `Aperçu ElevenLabs indisponible (ElevenLabs a répondu ${upstream ?? '?'}). Aperçu joué avec la voix du navigateur.`
              : `ElevenLabs preview unavailable (ElevenLabs replied ${upstream ?? '?'}). Playing the browser voice instead.`),
        );
        speak(fallbackText, lang, () => setPlaying(null));
      }
    })();
  }, [isFr, playing, stop]);

  return { playing, notice, toggle, stop };
}
