import { useEffect, useRef, useState } from 'react';
import Vapi from '@vapi-ai/web';
import { PhoneCall, PhoneOff, Loader2 } from 'lucide-react';
import api from '../../services/api';

type CallState = 'idle' | 'connecting' | 'active' | 'ending';

/**
 * Pull a displayable string out of whatever Vapi threw.
 *
 * Its error events are not a stable shape: sometimes `{ message: string }`,
 * sometimes `{ message: { message, error, ... } }`, sometimes an Error. Passing
 * that straight to state and then into JSX renders an object as a React child,
 * which throws React #31 and takes the whole dashboard down with it — an
 * unreadable crash screen in place of a call that merely failed.
 *
 * Anything that is not a usable string becomes null, and the caller supplies
 * wording the user can act on.
 */
export function errorDetail(e: unknown): string | null {
  // Last resort when the SDK gives no readable message: show the raw payload,
  // trimmed. Without devtools on a phone there is no other way to learn why a
  // call refuses to start, and a generic sentence has already proved useless
  // twice. Ugly on purpose, and only ever shown when nothing better exists.
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(e, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    });
    if (!json || json === '{}' || json === 'null') return null;
    return json.length > 220 ? `${json.slice(0, 220)}…` : json;
  } catch {
    return null;
  }
}

export function errorText(e: unknown): string | null {
  if (typeof e === 'string') return e.trim() || null;
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  for (const candidate of [o.message, o.errorMsg, (o.error as Record<string, unknown> | undefined)?.message, o.error]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return null;
}

/**
 * Live in-browser voice call with THIS client's receptionist (real ElevenLabs
 * voice + their config), via the Vapi Web SDK — the same tech as the public
 * home-page demo, but personalized. Config (public key + assistant) comes from
 * GET /my-dashboard/voice/live-config.
 */
export default function VapiLiveCall({
  isFr = true,
  /**
   * Which assistant to dial. Defaults to the receptionist; the setup assistant
   * passes its own endpoint. Same transport, same component — the difference
   * between the two agents belongs on the server, not in two copies of this.
   */
  endpoint = '/my-dashboard/voice/live-config',
  autoStart = false,
  onEnded,
}: {
  isFr?: boolean;
  endpoint?: string;
  autoStart?: boolean;
  onEnded?: () => void;
}) {
  const [state, setState] = useState<CallState>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const vapiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    // Cleanup on unmount: stop any active call.
    try { vapiRef.current?.stop?.(); } catch { /* noop */ }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Opened deliberately (the composer's voice button), so dial immediately
  // rather than asking the user to press a second button for the same intent.
  useEffect(() => {
    if (autoStart) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const stop = () => {
    try { vapiRef.current?.stop?.(); } catch { /* noop */ }
  };

  const start = async () => {
    setError(null);
    setState('connecting');
    try {
      // Ask for the microphone FIRST, before any await. Browsers only grant it
      // from inside a user gesture, and a network round-trip closes that window
      // — the SDK would then fail with an error object carrying no message,
      // which surfaces as a bare "Erreur appel" nobody can act on.
      // The tracks are stopped straight away: the grant persists for the page,
      // and holding an open stream would leave the recording indicator on.
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach(t => t.stop());
      } catch {
        throw new Error('mic_denied');
      }

      const { data } = await api.get(endpoint);
      if (!data?.publicKey) throw new Error('missing key');

      const vapi = new Vapi(data.publicKey);
      vapiRef.current = vapi;

      vapi.on('call-start', () => {
        setState('active');
        setSecs(0);
        timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
      });
      vapi.on('call-end', () => {
        setState('idle');
        setSpeaking(false);
        if (timerRef.current) clearInterval(timerRef.current);
        onEnded?.();
      });
      vapi.on('speech-start', () => setSpeaking(true));
      vapi.on('speech-end', () => setSpeaking(false));
      vapi.on('volume-level', (l: number) => setLevel(l));
      vapi.on('error', (e: any) => {
        // Vapi routinely emits errors with no message. Saying "Erreur appel"
        // and nothing else sends the user looking in the wrong place.
        const detail = errorDetail(e);
        setError(errorText(e) || [
          isFr
            ? "L'appel s'est interrompu. Vérifiez le micro et la connexion, puis réessayez."
            : 'The call dropped. Check the microphone and connection, then try again.',
          detail,
        ].filter(Boolean).join(' — '));
        setState('idle');
        if (timerRef.current) clearInterval(timerRef.current);
      });

      await vapi.start(data.assistant);
    } catch (e: any) {
      setError(
        errorText(e) === 'mic_denied'
          ? (isFr
            ? 'Micro refusé. Autorisez le microphone pour ce site, puis relancez.'
            : 'Microphone denied. Allow the microphone for this site, then start again.')
          : e?.response?.status === 503
            ? (isFr ? 'Appel live non configuré (clé Vapi).' : 'Live call not configured (Vapi key).')
            : (errorText(e) || (isFr ? 'Impossible de démarrer l’appel.' : 'Could not start the call.')),
      );
      setState('idle');
    }
  };

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const active = state === 'active';

  return (
    <div
      className="rounded-2xl border p-3 flex items-center gap-3"
      style={{ borderColor: active ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.10)', background: '#0D0D10' }}
    >
      <button
        type="button"
        onClick={active || state === 'connecting' ? stop : start}
        disabled={state === 'ending'}
        aria-label={active ? (isFr ? 'Raccrocher' : 'Hang up') : (isFr ? 'Appeler ma réceptionniste' : 'Call my receptionist')}
        className="flex-shrink-0 w-11 h-11 rounded-full grid place-items-center transition-colors"
        style={active || state === 'connecting'
          ? { background: '#dc2626', color: '#fff' }
          : { background: '#14b8a6', color: '#04231f' }}
      >
        {state === 'connecting'
          ? <Loader2 size={18} className="animate-spin" />
          : active ? <PhoneOff size={18} /> : <PhoneCall size={18} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#F2F2F2]">
          {active
            ? (isFr ? 'En appel avec votre réceptionniste' : 'On a call with your receptionist')
            : state === 'connecting'
              ? (isFr ? 'Connexion…' : 'Connecting…')
              : (isFr ? 'Tester en live (vraie voix)' : 'Test live (real voice)')}
        </p>
        <p className="text-[11px]" style={{ color: error ? '#f87171' : '#8B8BA7' }}>
          {error
            ? error
            : active
              ? `${mm}:${ss} · ${speaking ? (isFr ? 'elle parle…' : 'she’s speaking…') : (isFr ? 'à vous' : 'your turn')}`
              : (isFr ? 'Parlez à votre agent comme un client au téléphone.' : 'Talk to your agent like a caller.')}
        </p>
      </div>

      {active && (
        <div className="flex items-end gap-0.5 h-6 flex-shrink-0" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: `${Math.max(15, Math.min(100, level * 140 + (speaking ? Math.random() * 40 : 0)))}%`,
                background: '#14b8a6',
                transition: 'height 0.1s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
