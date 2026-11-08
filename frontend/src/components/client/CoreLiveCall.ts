import type * as LiveKit from 'livekit-client';

type Session = { url: string; token: string; maxDurationSeconds: number };
type Listener = (...args: any[]) => void;
let sdkPromise: Promise<typeof LiveKit> | null = null;
export function loadCoreSdk() {
  if (!sdkPromise) sdkPromise = import('livekit-client').catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
}

/** Adapter to the existing call UI. Captured mic is reused, never opened twice on iOS. */
export class CoreLiveCallTransport {
  private room: LiveKit.Room;
  private stopped = false;
  private listeners = new Map<string, Set<Listener>>();
  private audio = new Set<LiveKit.RemoteTrack>();
  private cap?: ReturnType<typeof setTimeout>;
  // Diagnostic « audio à sens unique » (à retirer une fois tranché).
  private sawLocalAudio = false;
  constructor(private config: Session, private stream: MediaStream, private sdk: typeof LiveKit) {
    this.room = new sdk.Room({ adaptiveStream: false, dynacast: false });
  }
  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }
  private emit(event: string, ...args: any[]) { this.listeners.get(event)?.forEach(fn => fn(...args)); }
  async start() {
    if (this.stopped) return;
    const { RoomEvent, Track } = this.sdk;
    this.room.on(RoomEvent.TrackSubscribed, track => {
      if (this.stopped || track.kind !== Track.Kind.Audio) return;
      this.audio.add(track);
      const element = track.attach();
      element.autoplay = true;
      document.body.appendChild(element);
      void this.room.startAudio?.().catch(() => this.emit('error', new Error('Lecture audio bloquée. Touchez à nouveau pour réessayer.')));
    });
    this.room.on(RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(el => el.remove()); this.audio.delete(track); });
    this.room.on(RoomEvent.ActiveSpeakersChanged, participants => {
      // ── Diagnostic « audio à sens unique » (à retirer une fois tranché).
      // Le niveau local n'était jamais observé : il est filtré juste en
      // dessous. On le journalise UNE fois dès qu'il dépasse zéro, pour savoir
      // si le micro du navigateur produit du son VU PAR LiveKit.
      const local = participants.find(p => p.identity === this.room.localParticipant.identity);
      if (local && local.audioLevel > 0 && !this.sawLocalAudio) {
        this.sawLocalAudio = true;
        console.info('[qwillio:web] audio local détecté', local.audioLevel);
      }
      const agents = participants.filter(p => p.identity !== this.room.localParticipant.identity);
      const level = Math.max(0, ...agents.map(p => p.audioLevel));
      this.emit('volume-level', level); this.emit(level > 0 ? 'speech-start' : 'speech-end');
    });
    this.room.on(RoomEvent.Disconnected, () => { if (!this.stopped) this.stop(); });
    this.room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (this.stopped || topic !== 'qwillio.config' || participant?.kind !== this.sdk.ParticipantKind.AGENT || payload.byteLength > 4096) return;
      try {
        const update = JSON.parse(new TextDecoder().decode(payload));
        if (update && typeof update.configChanged === 'boolean' && typeof update.completed === 'boolean') {
          this.emit('config-update', { configChanged: update.configChanged, completed: update.completed });
        }
      } catch { /* A malformed notification never breaks audio or invents success. */ }
    });
    try {
      await this.room.connect(this.config.url, this.config.token, { autoSubscribe: true });
      if (this.stopped) { void this.room.disconnect(); return; }
      const mic = this.stream.getAudioTracks()[0];
      if (!mic) throw new Error('Microphone indisponible');
      // Diagnostic « audio à sens unique » (à retirer une fois tranché) :
      // l'état de la piste au moment de la publier dit tout de suite si le
      // micro est vivant (readyState 'live', enabled, non muet).
      console.info('[qwillio:web] publication du micro', {
        readyState: mic.readyState, enabled: mic.enabled, muted: mic.muted,
        label: mic.label, settings: (() => { try { return mic.getSettings(); } catch { return null; } })(),
      });
      await this.room.localParticipant.publishTrack(mic, { source: Track.Source.Microphone });
      console.info('[qwillio:web] micro publié');
      if (this.stopped) { void this.room.disconnect(); return; }
      this.cap = setTimeout(() => this.stop(), Math.min(120, this.config.maxDurationSeconds) * 1000);
      this.emit('call-start');
    } catch (error) { this.dispose(); throw error; }
  }
  private dispose() {
    this.stopped = true;
    if (this.cap) clearTimeout(this.cap);
    this.stream.getTracks().forEach(track => track.stop());
    this.audio.forEach(track => track.detach().forEach(element => element.remove()));
    this.audio.clear();
    this.room.removeAllListeners();
    void this.room.disconnect().catch(() => undefined);
  }
  stop() {
    if (this.stopped) return;
    this.dispose();
    this.emit('call-end');
    this.listeners.clear();
  }
}
