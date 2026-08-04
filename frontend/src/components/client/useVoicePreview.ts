import { useCallback, useRef, useState } from 'react';
import api from '../../services/api';

/**
 * Play a preview clip the instant it is asked for.
 *
 * The clips are downloaded once, at app start, and kept as bytes. A press then
 * plays a file that is already in memory: no request, no synthesis, no wait —
 * which is what "it loads the first time, then it is instant" was telling us.
 *
 * Playback goes through an <audio> element first, and Web Audio only as a
 * fallback. That order is the opposite of what this file used to do, and the
 * reason is the same preloading: an element can only start from a user gesture,
 * and every `await` closes that window, so the old code could not use one and
 * had to build an AudioContext instead. With the bytes already here there is
 * nothing to await — the element starts inside the click. It also sidesteps the
 * two failures that kept coming back: iOS caps how many AudioContexts a page may
 * hold, and it silently interrupts them when the app goes to the background,
 * which is exactly why closing and reopening the app broke the previews.
 */

type AudioCtor = typeof AudioContext;
function audioContextCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext || w.webkitAudioContext || null;
}

/**
 * Ask iOS to treat this page as media playback.
 *
 * Without it Safari puts the audio in the ambient session, which the physical
 * Ring/Silent switch mutes — the clip plays, ends, and reports nothing wrong,
 * because from the browser's point of view nothing is.
 */
function preferPlaybackSession(): void {
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try { session.type = 'playback'; } catch { /* not settable here */ }
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Resume, but never hang on it. On iOS `resume()` can take the best part of a
 * second, and it can also never settle at all when the audio session belongs to
 * another app — awaiting it without a bound is how ▶ turns into a permanent ■.
 */
function resumeWithin(ctx: AudioContext, ms: number): Promise<void> {
  if (ctx.state === 'running') return Promise.resolve();
  return Promise.race([ctx.resume().catch(() => undefined), wait(ms)]).then(() => undefined);
}

/**
 * One context for the whole page, and only for the fallback path. iOS caps how
 * many a page may hold; past the cap the constructor throws and nothing plays
 * again until the tab is closed.
 */
let sharedCtx: AudioContext | null = null;

function liveContext(): AudioContext | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    try { sharedCtx = new Ctor(); } catch { return null; }
  }
  return sharedCtx;
}

/** Drops the current context and returns a fresh one. */
function replaceContext(): AudioContext | null {
  const dead = sharedCtx;
  sharedCtx = null;
  if (dead) void dead.close().catch(() => undefined);
  return liveContext();
}

export const __audio = {
  liveContext: () => liveContext(),
  replaceContext: () => replaceContext(),
  resumeWithin: (ctx: AudioContext, ms: number) => resumeWithin(ctx, ms),
  reset: () => { sharedCtx = null; },
  current: () => sharedCtx,
};

// Browser TTS, the last resort. A rough preview only.
//
// The timeout is not belt and braces: on iOS `speak()` regularly fires neither
// `onend` nor `onerror`, and the button then sits on ■ for ever, which reads as
// "the app is broken" rather than "this device will not speak".
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
  setTimeout(finish, Math.min(20_000, 3_000 + text.length * 70));
  window.speechSynthesis.speak(u);
}

/**
 * Downloaded clips, by URL. Module-level so they survive a re-render, a remount
 * and a route change, and shared between the character grid and the voice list.
 *
 * Bytes rather than AudioBuffer: decodeAudioData detaches the buffer it is
 * given, so a decoded clip cannot be replayed from the same memory.
 */
const clips = new Map<string, Uint8Array>();
const objectUrls = new Map<string, string>();
const pending = new Map<string, Promise<Uint8Array>>();

function clipUrl(url: string): string | null {
  const bytes = clips.get(url);
  if (!bytes) return null;
  let href = objectUrls.get(url);
  if (!href) {
    href = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'audio/mpeg' }));
    objectUrls.set(url, href);
  }
  return href;
}

async function fetchClip(url: string): Promise<Uint8Array> {
  const held = clips.get(url);
  if (held) return held;
  // Deduplicated: the grid, the voice list and the app-start preload all ask
  // for the same clips, and three requests for one file is three chances to be
  // rate-limited for no gain.
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const task = api.get(url, { responseType: 'arraybuffer' })
    .then(({ data }) => {
      const bytes = new Uint8Array(data as ArrayBuffer);
      if (!bytes.byteLength) throw new Error('empty_audio');
      clips.set(url, bytes);
      return bytes;
    })
    .finally(() => { pending.delete(url); });

  pending.set(url, task);
  return task;
}

/**
 * Download clips before anyone presses ▶.
 *
 * Called at app start with the whole catalog. Sequential, because a phone on
 * mobile data does not benefit from twenty parallel downloads and the server
 * synthesises them one at a time anyway.
 */
export async function preloadClips(urls: string[]): Promise<void> {
  for (const url of urls) {
    if (clips.has(url)) continue;
    try { await fetchClip(url); } catch { /* the press will report it properly */ }
  }
}

/** True when the clip can start with no network at all. */
export function isClipReady(url: string): boolean {
  return clips.has(url);
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
   * What the last press actually did. Shown in small print because "no error
   * and no sound" is otherwise unreportable: the person holding the phone
   * cannot see the difference between a muted device and a broken player.
   */
  debug: string | null;
  stop: () => void;
}

export function useVoicePreview(isFr: boolean): VoicePreview {
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    tokenRef.current += 1;
    if (guardRef.current) { clearTimeout(guardRef.current); guardRef.current = null; }
    if (elementRef.current) {
      elementRef.current.onended = null;
      try { elementRef.current.pause(); } catch { /* nothing playing */ }
    }
    if (sourceRef.current) {
      // The handler would otherwise clear the button state of the clip that is
      // starting, not the one being stopped.
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch { /* already finished */ }
      sourceRef.current = null;
    }
  }, []);

  /**
   * The fallback: decode the bytes into the shared AudioContext.
   *
   * Only reached when the element refuses, which on iOS it does after the audio
   * session has been handed to another app. Returns false when nothing came out
   * of it, so the caller can drop to the browser voice with an honest message.
   */
  const playDecoded = useCallback(async (bytes: Uint8Array, token: number, fresh = false): Promise<boolean> => {
    try {
      preferPlaybackSession();
      const ctx = fresh ? replaceContext() : liveContext();
      if (!ctx) return false;
      await resumeWithin(ctx, 2_500);
      if (tokenRef.current !== token) return true; // superseded, not a failure

      // A copy: decodeAudioData detaches what it decodes, and the original has
      // to stay playable for the next press.
      const buffer = await ctx.decodeAudioData(bytes.slice().buffer);
      if (tokenRef.current !== token) return true;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (tokenRef.current !== token) return;
        if (guardRef.current) { clearTimeout(guardRef.current); guardRef.current = null; }
        setPlaying(null);
      };
      sourceRef.current = source;

      const clockAtStart = ctx.currentTime;
      source.start();
      guardRef.current = setTimeout(() => {
        if (tokenRef.current === token) setPlaying(null);
      }, (buffer.duration + 2) * 1000);
      setDebug(`${Math.round(bytes.byteLength / 1024)} ko · ${buffer.duration.toFixed(1)} s · contexte${fresh ? ' recréé' : ''} · ${ctx.state}`);

      // Whether it is REALLY playing. The clock is the only honest witness: a
      // running context advances it, a blocked one does not. Judging by a
      // timeout alone once turned a working preview into a scary banner.
      await wait(1_000);
      if (tokenRef.current !== token) return true;
      if (ctx.state === 'running' && ctx.currentTime > clockAtStart + 0.05) return true;

      source.onended = null;
      try { source.stop(); } catch { /* never started */ }
      // One recovery attempt on a brand new context: a context Safari has
      // interrupted sometimes never comes back, and nothing revives it.
      return fresh ? false : await playDecoded(bytes, token, true);
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback((key: string, url: string, fallbackText: string) => {
    if (playing === key) { stop(); setPlaying(null); return; }
    stop();
    setPlaying(key);

    const lang = isFr ? 'fr' : 'en';
    const token = ++tokenRef.current;
    preferPlaybackSession();

    const giveUp = (message: string) => {
      if (tokenRef.current !== token) return;
      if (guardRef.current) { clearTimeout(guardRef.current); guardRef.current = null; }
      setNotice(message);
      speak(fallbackText, lang, () => setPlaying(null));
    };

    /** Element playback. Must stay synchronous to keep the gesture alive. */
    const playElement = (href: string, bytes: Uint8Array): Promise<boolean> => {
      const el = elementRef.current ?? new Audio();
      elementRef.current = el;
      // iOS refuses to play inline without it, and the typings predate the
      // attribute on audio elements.
      (el as HTMLMediaElement & { playsInline?: boolean }).playsInline = true;
      el.preload = 'auto';
      el.src = href;
      el.currentTime = 0;
      el.onended = () => {
        if (tokenRef.current !== token) return;
        if (guardRef.current) { clearTimeout(guardRef.current); guardRef.current = null; }
        setPlaying(null);
        setDebug(`${Math.round(bytes.byteLength / 1024)} ko · ${el.duration.toFixed(1)} s · lecteur audio`);
      };
      // The button must come back on its own even if `ended` never fires, which
      // is what left ■ frozen on a card.
      guardRef.current = setTimeout(() => {
        if (tokenRef.current === token) setPlaying(null);
      }, 30_000);

      return el.play()
        .then(async () => {
          // Element playback can resolve and still produce nothing, so the
          // clock is checked here too.
          await wait(700);
          if (tokenRef.current !== token) return true;
          if (el.currentTime > 0.05 && !el.paused) {
            setNotice(null);
            setDebug(`${Math.round(bytes.byteLength / 1024)} ko · lecteur audio · ${el.currentTime.toFixed(1)} s`);
            return true;
          }
          try { el.pause(); } catch { /* not playing */ }
          return false;
        })
        .catch(() => false);
    };

    const ready = clipUrl(url);
    const bytes = clips.get(url);

    if (ready && bytes) {
      // The normal path: everything is already here, so the sound starts inside
      // the click with nothing between the press and the audio.
      void playElement(ready, bytes).then(async played => {
        if (played || tokenRef.current !== token) return;
        if (await playDecoded(bytes, token)) return;
        giveUp(isFr
          ? "Le navigateur a bloqué l'audio. Aperçu joué avec la voix du navigateur — touchez ▶ à nouveau pour la vraie voix."
          : 'The browser blocked audio. Playing the browser voice — tap ▶ again for the real one.');
      });
      return;
    }

    // Not preloaded yet — first press on a cold app, or a voice that has just
    // been cloned. Fetch, then play through the context, because the gesture is
    // gone by the time the bytes land.
    void (async () => {
      let payload: Uint8Array | undefined;
      try {
        payload = await fetchClip(url);
        if (tokenRef.current !== token) return;
        if (await playDecoded(payload, token)) return;
        giveUp(isFr
          ? "Le navigateur a bloqué l'audio. Aperçu joué avec la voix du navigateur — touchez ▶ à nouveau pour la vraie voix."
          : 'The browser blocked audio. Playing the browser voice — tap ▶ again for the real one.');
      } catch (err) {
        if (tokenRef.current !== token) return;

        const message = (err as Error)?.message;
        if (message === 'empty_audio' || err instanceof DOMException) {
          // The size is in the message on purpose: 0 ko means the server sent
          // nothing, a real size means the file is there and the device
          // refused it.
          const ko = Math.round((payload?.byteLength ?? 0) / 1024);
          giveUp(isFr
            ? `Le fichier audio reçu n'a pas pu être décodé (${ko} ko). Aperçu joué avec la voix du navigateur.`
            : `The audio file could not be decoded (${ko} kB). Playing the browser voice instead.`);
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
        // The upstream reason is shown verbatim: "ElevenLabs replied 401" sends
        // nobody anywhere, "quota exceeded" is the answer.
        const detail = [upstream, reason].filter(Boolean).join(' — ') || '?';
        giveUp(
          res?.status === 503
            ? (isFr
              ? "Voix réelles indisponibles : la clé ElevenLabs n'est pas configurée sur le serveur. Aperçu joué avec la voix du navigateur."
              : 'Real voices unavailable: the ElevenLabs key is not configured on the server. Playing the browser voice instead.')
            : (isFr
              ? `Aperçu ElevenLabs indisponible (${detail}). Aperçu joué avec la voix du navigateur.`
              : `ElevenLabs preview unavailable (${detail}). Playing the browser voice instead.`),
        );
      }
    })();
  }, [isFr, playing, stop, playDecoded]);

  // Failures are ignored on purpose: this is a hint, and the press that follows
  // reports the reason properly.
  const prefetch = useCallback((url: string) => { void fetchClip(url).catch(() => undefined); }, []);

  return { playing, notice, toggle, prefetch, debug, stop };
}
