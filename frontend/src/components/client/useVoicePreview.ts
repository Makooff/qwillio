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

/**
 * Un analyseur par contexte, gardé d'une lecture à l'autre.
 *
 * `fftSize` bas (64): on veut un NIVEAU, pas un spectre. Trente-deux bandes
 * suffisent largement à faire vivre une dizaine de barres, et la lecture est
 * assez courte pour tenir dans une frame sans peser.
 */
let sharedAnalyser: AnalyserNode | null = null;
let analyserOwner: AudioContext | null = null;

function liveAnalyser(ctx: AudioContext): AnalyserNode {
  if (sharedAnalyser && analyserOwner === ctx) return sharedAnalyser;
  const node = ctx.createAnalyser();
  node.fftSize = 64;
  node.smoothingTimeConstant = 0.72;
  sharedAnalyser = node;
  analyserOwner = ctx;
  return node;
}

/**
 * L'élément branché sur l'analyseur, et lequel.
 *
 * `createMediaElementSource` est DÉFINITIF: une fois l'élément routé dans le
 * contexte, son son ne sort plus que par là. C'est pourquoi on ne le fait
 * jamais à l'aveugle. Voir `observeElement`.
 */
let elementSource: MediaElementAudioSourceNode | null = null;
let elementSourceOwner: HTMLAudioElement | null = null;

/**
 * Faire passer l'élément par l'analyseur, pour que les barres suivent la voix.
 *
 * Le diagramme était mort parce que le chemin normal est l'élément `<audio>`,
 * et qu'un élément nu n'expose aucun niveau: seul `playDecoded`, le REPLI,
 * avait un analyseur. D'où des barres immobiles alors que le son sortait.
 *
 * Le piège: router l'élément dans le contexte, c'est confier un son qui marche
 * au sous-système qui, sur iOS, est précisément celui qui tombe. On ne le fait
 * donc qu'à deux conditions, et jamais autrement:
 *   1. le contexte existe et tourne DÉJÀ (`running`), pas « en cours de
 *      reprise » — un contexte suspendu avalerait la lecture en silence;
 *   2. la lecture est déjà confirmée à l'oreille du code (l'horloge de
 *      l'élément a avancé), donc on sait ce qu'on branche.
 * Si l'une des deux manque, on renonce à l'analyseur et on garde le son: des
 * barres plates valent mieux qu'un aperçu muet.
 */
function observeElement(el: HTMLAudioElement): void {
  if (elementSourceOwner === el && elementSource) return;
  const ctx = sharedCtx;
  if (!ctx || ctx.state !== 'running') return;
  try {
    const source = ctx.createMediaElementSource(el);
    const analyser = liveAnalyser(ctx);
    source.connect(analyser);
    // Sans cette ligne l'élément est routé mais ne rejoint jamais les
    // haut-parleurs: l'analyseur seul est un cul-de-sac, et le son disparaît.
    analyser.connect(ctx.destination);
    elementSource = source;
    elementSourceOwner = el;
  } catch {
    // Déjà routé (deuxième appel sur le même élément), ou contexte qui refuse.
    // Dans les deux cas le son continue de sortir, ce qui est l'essentiel.
  }
}

/**
 * Le niveau courant, entre 0 et 1, ou 0 si rien ne joue.
 *
 * Exporté plutôt que passé en prop: le lecteur est un singleton de module, et
 * les barres peuvent vivre n'importe où dans l'arbre sans qu'on ait à faire
 * descendre un noeud audio jusqu'à elles.
 */
export function currentLevel(): number {
  if (!sharedAnalyser) return 0;
  const bins = new Uint8Array(sharedAnalyser.frequencyBinCount);
  sharedAnalyser.getByteFrequencyData(bins);
  let sum = 0;
  for (let i = 0; i < bins.length; i++) sum += bins[i];
  return Math.min(1, sum / bins.length / 160);
}

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
  sharedAnalyser = null;
  analyserOwner = null;
  // La source appartenait au contexte qu'on jette: la garder ferait croire que
  // l'élément est déjà routé, et il ne serait jamais rebranché sur le nouveau.
  elementSource = null;
  elementSourceOwner = null;
  if (dead) void dead.close().catch(() => undefined);
  return liveContext();
}

/**
 * Set when the app comes back from the background, cleared by the next press.
 *
 * An installed app is not reloaded when it is closed and reopened: iOS freezes
 * the page and thaws the same document. Everything survives — including the
 * audio element and the AudioContext, both of which have lost the audio session
 * they were bound to. They report nothing wrong and produce no sound, which is
 * exactly why refreshing in Chrome fixed it and reopening the installed app did
 * not: a refresh builds new ones, a thaw does not.
 *
 * So the next press after a thaw rebuilds both, inside the gesture, where iOS
 * allows it.
 */
let thawed = false;

if (typeof document !== 'undefined') {
  const markThawed = () => {
    thawed = true;
    preferPlaybackSession();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') markThawed();
  });
  // Fired when the document is restored from the back/forward cache, which is
  // how an installed app returns from the background.
  window.addEventListener('pageshow', event => {
    if ((event as PageTransitionEvent).persisted) markThawed();
  });
  window.addEventListener('focus', markThawed);
}

export const __audio = {
  liveContext: () => liveContext(),
  replaceContext: () => replaceContext(),
  resumeWithin: (ctx: AudioContext, ms: number) => resumeWithin(ctx, ms),
  reset: () => { sharedCtx = null; thawed = false; },
  current: () => sharedCtx,
  markThawed: () => { thawed = true; },
  isThawed: () => thawed,
};

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
  /**
   * Le troisième paramètre n'est plus une phrase à PRONONCER (le repli
   * navigateur a disparu) mais la phrase enregistrée à AFFICHER.
   */
  toggle: (key: string, url: string, spokenLine?: string) => void;
  /** Download a clip before it is asked for, so ▶ plays with no wait. */
  prefetch: (url: string) => void;
  /**
   * What the last press actually did. Shown in small print because "no error
   * and no sound" is otherwise unreportable: the person holding the phone
   * cannot see the difference between a muted device and a broken player.
   */
  debug: string | null;
  /** Phrase enregistrée en cours de lecture, ou null. */
  line: string | null;
  stop: () => void;
}

export function useVoicePreview(isFr: boolean): VoicePreview {
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  /* La phrase exacte que l'on entend, pour l'écrire sous le personnage. */
  const [line, setLine] = useState<string | null>(null);
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

      /* L'analyseur s'insère entre la source et la sortie: c'est lui qui rend
         les barres RÉELLEMENT réactives à la voix, au lieu d'une animation
         décorative jouée pendant la lecture. Il ne modifie pas le signal, il
         l'observe. */
      const analyser = liveAnalyser(ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);
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

  const toggle = useCallback((key: string, url: string, spokenLine?: string) => {
    if (playing === key) { stop(); setPlaying(null); setLine(null); return; }
    stop();
    setPlaying(key);
    setLine(spokenLine ?? null);

    const token = ++tokenRef.current;
    preferPlaybackSession();

    // Everything the audio session touches is rebuilt here, inside the gesture,
    // when the app has just been thawed. Doing it later — after the element has
    // been given its chance and awaited — would be outside the gesture, where
    // iOS refuses to hand the session back.
    if (thawed) {
      thawed = false;
      if (elementRef.current) {
        try { elementRef.current.pause(); } catch { /* nothing playing */ }
        elementRef.current.onended = null;
        elementRef.current = null;
      }
      const revived = replaceContext();
      if (revived) void resumeWithin(revived, 2_500);
    } else {
      // Resumed on every press regardless: the fallback needs a running context
      // and can only get one from a gesture.
      const ctx = liveContext();
      if (ctx) void resumeWithin(ctx, 2_500);
    }

    /* Abandonner, c'est le DIRE, pas jouer autre chose. Les messages
       annonçaient encore « Aperçu joué avec la voix du navigateur » alors que
       ce repli a été retiré: ils promettaient un son que plus rien ne produit. L'ancienne version se
       rabattait ici sur speechSynthesis: sur Safari, une voix de lecture
       système qui ne ressemble à aucune voix du produit. L'aperçu mentait donc
       sur ce que l'appelant entendra, ce qui est pire que pas d'aperçu. */
    const giveUp = (message: string) => {
      if (tokenRef.current !== token) return;
      if (guardRef.current) { clearTimeout(guardRef.current); guardRef.current = null; }
      setNotice(message);
      setPlaying(null);
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
            // Le son est confirmé: c'est le seul moment où l'on accepte de le
            // faire passer par l'analyseur. Voir `observeElement`.
            observeElement(el);
            setNotice(null);
            setDebug(`${Math.round(bytes.byteLength / 1024)} ko · lecteur audio${elementSourceOwner === el ? ' · analysé' : ''} · ${el.currentTime.toFixed(1)} s`);
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
          ? "Le navigateur a bloqué l'audio. Touchez ▶ à nouveau, et vérifiez l'interrupteur silence de votre téléphone."
          : 'The browser blocked audio. Tap ▶ again, and check your phone\u2019s silent switch.');
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
          ? "Le navigateur a bloqué l'audio. Touchez ▶ à nouveau, et vérifiez l'interrupteur silence de votre téléphone."
          : 'The browser blocked audio. Tap ▶ again, and check your phone\u2019s silent switch.');
      } catch (err) {
        if (tokenRef.current !== token) return;

        const message = (err as Error)?.message;
        if (message === 'empty_audio' || err instanceof DOMException) {
          // The size is in the message on purpose: 0 ko means the server sent
          // nothing, a real size means the file is there and the device
          // refused it.
          const ko = Math.round((payload?.byteLength ?? 0) / 1024);
          giveUp(isFr
            ? `Le fichier audio reçu n'a pas pu être décodé (${ko} ko).`
            : `The audio file could not be decoded (${ko} kB).`);
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
              ? "Voix réelles indisponibles : la clé ElevenLabs n'est pas configurée sur le serveur."
              : 'Real voices unavailable: the ElevenLabs key is not configured on the server.')
            : (isFr
              ? `Aperçu ElevenLabs indisponible (${detail}).`
              : `ElevenLabs preview unavailable (${detail}).`),
        );
      }
    })();
  }, [isFr, playing, stop, playDecoded]);

  // Failures are ignored on purpose: this is a hint, and the press that follows
  // reports the reason properly.
  const prefetch = useCallback((url: string) => { void fetchClip(url).catch(() => undefined); }, []);

  return { playing, notice, toggle, prefetch, debug, line, stop };
}
