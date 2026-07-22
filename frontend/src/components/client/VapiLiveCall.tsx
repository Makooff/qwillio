import { useEffect, useRef, useState } from 'react';
import Vapi from '@vapi-ai/web';
import { PhoneCall, PhoneOff, Loader2 } from 'lucide-react';
import api from '../../services/api';

type CallState = 'idle' | 'connecting' | 'active' | 'ending';

/**
 * Live in-browser voice call with THIS client's receptionist (real ElevenLabs
 * voice + their config), via the Vapi Web SDK — the same tech as the public
 * home-page demo, but personalized. Config (public key + assistant) comes from
 * GET /my-dashboard/voice/live-config.
 */
export default function VapiLiveCall({ isFr = true }: { isFr?: boolean }) {
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

  const stop = () => {
    try { vapiRef.current?.stop?.(); } catch { /* noop */ }
  };

  const start = async () => {
    setError(null);
    setState('connecting');
    try {
      const { data } = await api.get('/my-dashboard/voice/live-config');
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
      });
      vapi.on('speech-start', () => setSpeaking(true));
      vapi.on('speech-end', () => setSpeaking(false));
      vapi.on('volume-level', (l: number) => setLevel(l));
      vapi.on('error', (e: any) => {
        setError(e?.message || 'Erreur appel');
        setState('idle');
        if (timerRef.current) clearInterval(timerRef.current);
      });

      await vapi.start(data.assistant);
    } catch (e: any) {
      setError(
        e?.response?.status === 503
          ? (isFr ? 'Appel live non configuré (clé Vapi).' : 'Live call not configured (Vapi key).')
          : (e?.message || (isFr ? 'Impossible de démarrer l’appel.' : 'Could not start the call.')),
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
