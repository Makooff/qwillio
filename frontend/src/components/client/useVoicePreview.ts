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

/**
 * Ask iOS to treat this page as media playback.
 *
 * Without it, Safari puts Web Audio in the ambient session, which the physical
 * Ring/Silent switch mutes — the clip decodes, plays, ends, and reports nothing
 * wrong, because from the browser's point of view nothing IS wrong. That is
 * exactly the symptom that survived every previous fix: no error, no banner, no
 * sound. Speech synthesis is on another path, which is why the robotic fallback
 * was audible on the same device and made the real voices look broken.
 *
 * Safari 16.4+ and Chrome expose it; older browsers ignore the assignment, and
 * the visible hint under the list covers them.
 */
function preferPlaybackSession(): void {
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try { session.type = 'playback'; } catch { /* not settable here */ }
}

// Browser TTS fallback. A rough preview only — the real call uses ElevenLabs.
//
// The timeout is not belt and braces: on iOS `speak()` regularly fires neither
// `onend` nor `onerror` (silent switch on, no voice loaded for the language),
// and the button then sits on ■ for ever, which reads as "the app is broken"
// rather than "this device will not speak".
function speak(text: string, lang: 'fr' | 'en', onEnd: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const match = window.speechSynthesis.getVoices()
    .find(v => v.lang?.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
  if (match) u.voice = match;
  let done = false;
  const finish = () => { if (!done) { done = true; onEnd(); } };
  u.onend = finish;
  u.onerror = finish;
  // ~14 characters a second is slower than any real speech rate.
  setTimeout(finish, Math.min(20_000, 3_000 + text.length * 70));
  window.speechSynthesis.speak(u);
}

/**
 * Downloaded clips, by URL. Module-level so they survive a re-render and a
 * remount, and shared between the character grid and the voice list — the same
 * clip is on both.
 *
 * Bytes rather than AudioBuffer: decodeAudioData detaches the buffer it is
 * given, so a decoded clip cannot be replayed from the same memory. Each play
 * decodes a copy.
 */
const clips = new Map<string, Uint8Array>();

async function fetchClip(url: string): Promise<Uint8Array> {
  const held = clips.get(url);
  if (held) return held;
  const { data } = await api.get(url, { responseType: 'arraybuffer' });
  const bytes = new Uint8Array(data as ArrayBuffer);
  if (!bytes.byteLength) throw new Error('empty_audio');
  clips.set(url, bytes);
  return bytes;
}

export interface VoicePreview {
  /** Key of the clip currently playing, or null. */
  playing: string | null;
  /** Why the real voice could not be played, in the client's language. */
  notice: string | null;
  /** Click handler: starts the clip, or stops it when it is the one playing. */
  toggle: (key: string, url: string, fallbackText: string) => void;
  /** Download a clip before it is asked for, so ▶ plays with no wait. */
  prefetch: (url: string) => void;
  /**
   * What the last press actually did — clip size, context state, whether the
   * clip ran to the end. Shown in small print because "no error and no sound"
   * is otherwise unreportable: the person holding the phone cannot see the
   * difference between a muted device and a broken player, and neither can I.
   */
  debug: string | null;
  stop: () => void;
}

export function useVoicePreview(isFr: boolean): VoicePreview {
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
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

    // Before the context exists: on iOS the session type is what decides
    // whether any of this will be audible at all.
    preferPlaybackSession();

    // Created and resumed inside the click. iOS starts every context suspended
    // and only allows the resume from a gesture; doing it after the fetch would
    // be too late.
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    const resumed = ctx.state === 'suspended' ? ctx.resume().catch(() => undefined) : Promise.resolve();

    const token = ++tokenRef.current;

    void (async () => {
      // Hoisted so the failure message can report the size that arrived.
      let payload: Uint8Array | undefined;
      try {
        payload = await fetchClip(url);
        await resumed;
        if (tokenRef.current !== token) return; // superseded by another click

        // A copy: decodeAudioData detaches what it decodes, and the original
        // has to stay playable for the next press.
        const buffer = await ctx.decodeAudioData(payload.slice().buffer);
        if (tokenRef.current !== token) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const startedAt = Date.now();
        source.onended = () => {
          if (tokenRef.current !== token) return;
          setPlaying(null);
          setDebug(`${Math.round(payload!.byteLength / 1024)} ko · ${buffer.duration.toFixed(1)} s · lu en ${((Date.now() - startedAt) / 1000).toFixed(1)} s · ${ctx.state} · vol ${ctx.destination.channelCount}ch`);
        };
        sourceRef.current = source;
        setNotice(null);
        setDebug(`${Math.round(payload.byteLength / 1024)} ko · ${buffer.duration.toFixed(1)} s · ${ctx.state}…`);
        source.start();

        // A context that is not running produces no sound and no error. Saying
        // so is the difference between "this app is broken" and "unlock the
        // phone / turn off silent and press again".
        setTimeout(() => {
          if (tokenRef.current !== token) return;
          if (ctx.state === 'running') return;
          setNotice(isFr
            ? "Le navigateur a mis l'audio en pause. Touchez de nouveau ▶, et vérifiez l'interrupteur silence de l'iPhone."
            : 'The browser paused audio. Tap ▶ again, and check the iPhone silent switch.');
        }, 400);
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
        let reason: string | undefined;
        if (res?.data instanceof ArrayBuffer) {
          try {
            const body = JSON.parse(new TextDecoder().decode(res.data));
            upstream = body?.status;
            reason = body?.reason;
          } catch { /* not JSON */ }
        }
        // The upstream reason is shown verbatim. "ElevenLabs replied 401" sends
        // nobody anywhere; "quota exceeded" or "voice not found" is the answer.
        const detail = [upstream, reason].filter(Boolean).join(' — ') || '?';
        setNotice(
          res?.status === 503
            ? (isFr
              ? "Voix réelles indisponibles : la clé ElevenLabs n'est pas configurée sur le serveur. Aperçu joué avec la voix du navigateur."
              : 'Real voices unavailable: the ElevenLabs key is not configured on the server. Playing the browser voice instead.')
            : (isFr
              ? `Aperçu ElevenLabs indisponible (${detail}). Aperçu joué avec la voix du navigateur.`
              : `ElevenLabs preview unavailable (${detail}). Playing the browser voice instead.`),
        );
        speak(fallbackText, lang, () => setPlaying(null));
      }
    })();
  }, [isFr, playing, stop]);

  // Failures are ignored on purpose: this is a hint, and the press that follows
  // reports the reason properly.
  const prefetch = useCallback((url: string) => { void fetchClip(url).catch(() => undefined); }, []);

  return { playing, notice, toggle, prefetch, debug, stop };
}
