import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp, Mic, StopCircle, Square, Settings, Headphones,
  Loader2, Bot, Copy, Check, PhoneCall, X, Lightbulb,
} from 'lucide-react';
import api from '../../services/api';
import VapiLiveCall from './VapiLiveCall';

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Modes the backend understands. Onboarding keeps its own tool to finish setup. */
type Mode = 'config' | 'onboarding' | 'receptionist';
interface Msg { role: 'user' | 'assistant'; content: string }

/**
 * What the user picks from. Config and onboarding were two buttons for the same
 * intent, "help me set this up", and the difference between them is something
 * the app already knows: whether the setup is done. So it decides, and the
 * user has one choice fewer to make.
 */
type Pill = 'assistant' | 'receptionist';

const PILLS: { id: Pill; label: string; labelEn: string; icon: typeof Settings; color: string }[] = [
  { id: 'assistant',    label: 'Assistant',      labelEn: 'Assistant', icon: Settings,   color: '#7A5FFF' },
  { id: 'receptionist', label: 'Test d’appel',   labelEn: 'Call test', icon: Headphones, color: '#14b8a6' },
];

const pillOf = (m: Mode): Pill => (m === 'receptionist' ? 'receptionist' : 'assistant');

function greetingFor(mode: Mode, isFr: boolean): string {
  if (mode === 'onboarding') {
    return isFr
      ? 'On configure ta réceptionniste ensemble, étape par étape. On commence ?'
      : "Let's set up your receptionist together, step by step. Ready?";
  }
  if (mode === 'receptionist') {
    return isFr
      ? 'Mode test : parle comme si tu appelais ton entreprise. Vas-y, dis « Allô ? »'
      : 'Test mode: talk as if you were calling your business. Go ahead, say "Hello?"';
  }
  return isFr
    ? 'Que veux-tu configurer ? Horaires, services, voix, FAQ… Parle ou écris.'
    : 'What would you like to set up? Hours, services, voice, FAQ… talk or type.';
}

/** Auto-stop for a take, so a forgotten recording never becomes a refused upload. */
const MAX_RECORDING_MS = 120_000;

/** MediaRecorder MIME, first one the browser actually supports. */
function pickAudioMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    // result is a data URL; strip the "data:...;base64," prefix.
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Recording visualizer + timer, driven by the real microphone level so you can
 * tell at a glance whether anything is being captured. The bars used to be
 * Math.random(), which looked alive even when the mic was dead.
 */
function VoiceViz({ isFr, analyser }: { isFr: boolean; analyser: AnalyserNode | null }) {
  const BARS = 32;
  const [t, setT] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));

  useEffect(() => {
    const id = setInterval(() => setT(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / BARS) || 1;
      const next: number[] = [];
      for (let i = 0; i < BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        next.push(sum / step / 255);
      }
      setLevels(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center w-full py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-xs text-white/70">{mm}:{ss}</span>
        <span className="text-[11px] text-white/50">{isFr ? '· parlez…' : '· speak…'}</span>
      </div>
      <div className="w-full h-8 flex items-center justify-center gap-0.5 px-4" aria-hidden="true">
        {levels.map((v, i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-white/40"
            style={{ height: `${Math.max(8, v * 100)}%`, transition: 'height 80ms linear' }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Conversational assistant, two things the user can pick from:
 *  - Assistant: set the receptionist up by talking. Guided when nothing is
 *    configured yet, free-form once it is; the app decides which, not the user.
 *  - Call test: roleplay, the AI answers as your receptionist would.
 * Typing or dictation, with server-side transcription.
 */
export default function AssistantChat({
  isFr = true, onConfigChanged, initialMode = 'config', lockMode = false, onCompleted,
  businessName, planLabel, isTrial = false, phone, quota, showHeader = true,
  setupComplete = true,
}: {
  isFr?: boolean;
  onConfigChanged?: () => void;
  /** Mode to open in. Defaults to config, the dashboard's use. */
  initialMode?: Mode;
  /** Hides the mode pills, for first-time setup where switching makes no sense. */
  lockMode?: boolean;
  /** Onboarding mode: the assistant considers first-time setup finished. */
  onCompleted?: () => void;
  /** Identity shown in the chat header, so the panel says who you are talking to. */
  businessName?: string;
  planLabel?: string;
  isTrial?: boolean;
  phone?: string | null;
  /** Included-minutes gauge. Receptionist-specific, so it lives here and nowhere else. */
  quota?: { used: number; total: number };
  /**
   * The dashboard wants the identity header; onboarding does not, because the
   * page around it already introduces the step and there is no number yet.
   */
  showHeader?: boolean;
  /**
   * Whether the receptionist is already configured. Decides, on the user's
   * behalf, whether the assistant walks them through setup or takes free-form
   * instructions. Defaults to true so an unconfigured caller never gets the
   * guided path by accident.
   */
  setupComplete?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greetingFor(initialMode, isFr) }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);
  // Shown once per browser. localStorage can throw in a restricted webview,
  // and a crash here would take the panel down, so it is guarded.
  const [showIntro, setShowIntro] = useState(() => {
    try { return localStorage.getItem('qw.chatIntroSeen') !== '1'; } catch { return false; }
  });
  const dismissIntro = () => {
    setShowIntro(false);
    try { localStorage.setItem('qw.chatIntroSeen', '1'); } catch { /* it reappears next time, harmless */ }
  };
  // Live test call is driven from the header, independently of the chat mode.
  const [liveCall, setLiveCall] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  /**
   * Language YOU dictate in. Deliberately separate from `isFr`, which is the
   * language the receptionist uses with callers: a Belgian owner routinely
   * speaks French to configure an English-speaking agent. Defaults to French
   * and is remembered per browser.
   */
  const [dictationLang, setDictationLang] = useState<'fr' | 'en'>(() => {
    if (typeof localStorage === 'undefined') return 'fr';
    return localStorage.getItem('qw.dictationLang') === 'en' ? 'en' : 'fr';
  });
  useEffect(() => { localStorage.setItem('qw.dictationLang', dictationLang); }, [dictationLang]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Set when the user cancels, so onstop discards instead of transcribing.
  const abortRef = useRef(false);
  const maxDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMaxDuration = () => {
    if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
    maxDurationRef.current = null;
  };

  useEffect(() => {
    setMicSupported(
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined',
    );
  }, []);

  // Release the mic and the audio graph if the panel unmounts mid-recording.
  // The abort flag has to be set first: stop() fires onstop, which would
  // otherwise build the blob, call the API and setState on a dead component.
  useEffect(() => () => {
    abortRef.current = true;
    if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    void audioCtxRef.current?.close().catch(() => { /* noop */ });
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, listening]);

  /**
   * The pill picks an intent; the backend mode follows from whether setup is
   * done. Choosing between "config" and "onboarding" was a decision the app
   * could already make, so it makes it.
   */
  const switchPill = (p: Pill) => {
    const next: Mode = p === 'receptionist' ? 'receptionist' : setupComplete ? 'config' : 'onboarding';
    if (next === mode) return;
    setMode(next);
    setMessages([{ role: 'assistant', content: greetingFor(next, isFr) }]);
    setInput('');
  };

  const copyPhone = () => {
    if (!phone) return;
    // clipboard is undefined outside a secure origin, and writeText rejects
    // when permission is denied. Only claim success once it actually copied,
    // otherwise the tick appeared while nothing had been put on the clipboard.
    const write = navigator.clipboard?.writeText(phone);
    if (!write) {
      notify('Copie impossible ici. Sélectionnez le numéro à la main.',
             'Cannot copy here. Select the number manually.');
      return;
    }
    write.then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => notify(
      'Copie refusée par le navigateur. Sélectionnez le numéro à la main.',
      'The browser refused the copy. Select the number manually.',
    ));
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next: Msg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setSending(true);
    try {
      const res = await api.post('/my-dashboard/assistant/chat', {
        mode,
        messages: next.filter(m => m.role === 'user' || m.role === 'assistant'),
      });
      const reply = res.data?.reply || (isFr ? 'Désolée, je n’ai pas compris.' : 'Sorry, I didn’t catch that.');
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
      if (res.data?.configChanged) onConfigChanged?.();
      if (res.data?.completed) onCompleted?.();
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: isFr ? 'Une erreur est survenue. Réessayez.' : 'Something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  /** Surface a problem in the thread. Silence was the old behaviour and it read as "broken". */
  const notify = (fr: string, en: string) =>
    setMessages(m => [...m, { role: 'assistant', content: isFr ? fr : en }]);

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => { /* noop */ });
    audioCtxRef.current = null;
    setAnalyser(null);
  };

  const transcribe = async (blob: Blob, mimeType: string) => {
    // Its own flag, not `sending`: transcribe hands the text to send(), which
    // bails out when `sending` is already set. Sharing one flag meant the
    // transcript could be silently dropped instead of sent.
    setTranscribing(true);
    try {
      const audio = await blobToBase64(blob);
      const { data } = await api.post('/my-dashboard/assistant/transcribe', {
        audio,
        mimeType,
        // The dictation language is the language YOU speak to the assistant.
        // It is deliberately not `agentLanguage`, which is the language the
        // receptionist speaks to callers. Conflating the two is what made
        // French dictation transcribe as English.
        language: dictationLang,
      });
      const text = (data?.text || '').trim();
      if (!text) {
        notify("Je n'ai rien entendu. Réessayez en parlant plus près du micro.",
               'I did not hear anything. Try again, closer to the mic.');
        return;
      }
      await send(text);
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'transcription_unavailable') {
        notify('La transcription vocale n’est pas configurée sur ce compte. Écrivez votre message.',
               'Voice transcription is not configured on this account. Please type instead.');
      } else if (code === 'audio_too_large') {
        notify('Enregistrement trop long. Faites des phrases plus courtes.',
               'Recording too long. Try shorter takes.');
      } else {
        notify('La transcription a échoué. Réessayez, ou écrivez votre message.',
               'Transcription failed. Try again, or type your message.');
      }
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (!micSupported) {
      notify('Votre navigateur ne permet pas l’enregistrement audio. Écrivez votre message.',
             'Your browser cannot record audio. Please type instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Real level meter, so the visualizer reflects the actual mic.
      const Ctx: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const node = ctx.createAnalyser();
        node.fftSize = 128;
        ctx.createMediaStreamSource(stream).connect(node);
        setAnalyser(node);
      }

      const mimeType = pickAudioMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      abortRef.current = false;

      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onerror = () => {
        clearMaxDuration();
        setListening(false);
        releaseMic();
        notify('L’enregistrement a échoué. Réessayez.', 'Recording failed. Please try again.');
      };
      rec.onstop = () => {
        clearMaxDuration();
        setListening(false);
        const type = rec.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        releaseMic();
        if (abortRef.current) return;
        if (blob.size > 0) void transcribe(blob, type.split(';')[0]);
      };

      recorderRef.current = rec;
      rec.start();
      setListening(true);

      // Close the take on its own rather than letting it grow until the upload
      // is refused for size. Two minutes is far past any dictation.
      maxDurationRef.current = setTimeout(() => {
        if (recorderRef.current?.state !== 'recording') return;
        notify('Enregistrement arrêté après 2 minutes. Je transcris ce que j’ai.',
               'Recording stopped after 2 minutes. Transcribing what I have.');
        stopRecording();
      }, MAX_RECORDING_MS);
    } catch (err: any) {
      releaseMic();
      setListening(false);
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      notify(
        denied
          ? 'Accès au micro refusé. Autorisez le micro dans votre navigateur, puis réessayez.'
          : 'Micro indisponible. Vérifiez qu’aucune autre application ne l’utilise.',
        denied
          ? 'Microphone access denied. Allow the mic in your browser, then try again.'
          : 'Microphone unavailable. Check that no other app is using it.',
      );
    }
  };

  /** Stop and transcribe. */
  const stopRecording = () => {
    abortRef.current = false;
    try { recorderRef.current?.stop(); } catch { /* noop */ }
  };

  /** Stop and throw the take away. */
  const cancelRecording = () => {
    abortRef.current = true;
    try { recorderRef.current?.stop(); } catch { /* noop */ }
  };

  const hasContent = input.trim() !== '';
  const activePill = pillOf(mode);
  const activeColor = PILLS.find(p => p.id === activePill)!.color;

  return (
    // Height follows the viewport: the header now carries identity, number and
    // quota, so a fixed 480px would starve the message list on short screens.
    <div
      className="rounded-2xl border border-white/[0.08] bg-[#0A0A0C] overflow-hidden flex flex-col"
      style={{ height: showHeader ? 'min(76vh, 640px)' : 480 }}
    >
      {/* Header: who you are talking to, the AI number, and the live test call.
          This is the page's identity block, kept here so the panel is
          self-describing and the page above it carries no duplicate. */}
      {showHeader && (
      <div className="px-4 py-3 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <Bot size={17} className="text-[#E5E5EA]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[#F2F2F2] tracking-tight truncate">
                {isFr ? 'Réceptionniste IA' : 'AI Receptionist'}
              </h2>
              <p className="text-[11.5px] text-[#9A9AA5] truncate">
                {businessName || (isFr ? 'Votre entreprise' : 'Your business')}
                {planLabel && <> · Plan {planLabel}</>}
                {isTrial && <span className="ml-1 text-amber-400">({isFr ? 'essai' : 'trial'})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {phone && (
              <button
                type="button"
                onClick={copyPhone}
                aria-label={isFr ? `Copier le numéro ${phone}` : `Copy number ${phone}`}
                className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors active:scale-[0.97]"
              >
                <span className="text-[12.5px] font-mono font-medium text-[#E5E5EA] tabular-nums">{phone}</span>
                {copied
                  ? <Check size={13} className="text-emerald-400" aria-hidden="true" />
                  : <Copy size={13} className="text-[#9A9AA5]" aria-hidden="true" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setLiveCall(v => !v)}
              aria-pressed={liveCall}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12.5px] font-medium transition-colors active:scale-[0.97]"
              style={liveCall
                ? { background: 'rgba(255,255,255,0.08)', color: '#E5E5EA' }
                : { background: 'rgba(122,95,255,0.16)', color: '#b9a8ff' }}
            >
              {liveCall ? <X size={14} aria-hidden="true" /> : <PhoneCall size={14} aria-hidden="true" />}
              <span className="hidden sm:inline">
                {liveCall ? (isFr ? 'Fermer' : 'Close') : (isFr ? 'Appel test live' : 'Live test call')}
              </span>
            </button>
          </div>
        </div>

        {/* Copyable number on phones, where it cannot sit on the header row. */}
        {phone && (
          <button
            type="button"
            onClick={copyPhone}
            aria-label={isFr ? `Copier le numéro ${phone}` : `Copy number ${phone}`}
            className="sm:hidden flex w-full items-center justify-between gap-2 h-9 px-3 rounded-xl border border-white/[0.08] bg-white/[0.03] active:scale-[0.99] transition-transform"
          >
            <span className="text-[12.5px] font-mono font-medium text-[#E5E5EA] tabular-nums">{phone}</span>
            {copied
              ? <Check size={13} className="text-emerald-400" aria-hidden="true" />
              : <Copy size={13} className="text-[#9A9AA5]" aria-hidden="true" />}
          </button>
        )}

        {/* Included-minutes gauge: the one figure that is specific to the
            receptionist and warns before an overage invoice. */}
        {quota && quota.total > 0 && (() => {
          const pct = Math.round((quota.used / quota.total) * 100);
          return (
            <div>
              <div className="flex justify-between text-[10.5px] text-[#9A9AA5] mb-1">
                <span>{isFr ? 'Minutes ce mois' : 'Minutes this month'}</span>
                <span className="tabular-nums">{quota.used} / {quota.total} min ({pct}%)</span>
              </div>
              <div
                className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.min(pct, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={isFr ? 'Minutes consommées ce mois' : 'Minutes used this month'}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#E5E5EA',
                  }}
                />
              </div>
            </div>
          );
        })()}
      </div>
      )}

      {/* Live voice call with the real receptionist, driven from the header. */}
      {liveCall && (
        <div className="px-3 pt-3">
          <VapiLiveCall isFr={isFr} />
        </div>
      )}

      {/* First-run explainer. Deliberately an inline card and not a modal: a
          dialog on open traps focus, has to be dismissed before anything can be
          done, and comes back every visit. This reads in document order, is
          dismissed once, and never returns. */}
      {showIntro && !lockMode && (
        <div className="px-3 pt-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
            <Lightbulb size={15} className="mt-0.5 flex-shrink-0" style={{ color: '#b9a8ff' }} aria-hidden="true" />
            <p className="flex-1 text-[12.5px] leading-relaxed text-[#9A9AA5]">
              {isFr
                ? 'Dites ce que vous voulez changer et je le fais : horaires, services, tarifs, façon de répondre. Pour entendre le résultat, passez sur Test d’appel ou lancez un appel test live.'
                : 'Tell me what you want to change and I do it: hours, services, prices, how it answers. To hear the result, switch to Call test or start a live test call.'}
            </p>
            <button
              type="button"
              onClick={dismissIntro}
              aria-label={isFr ? 'Masquer cette explication' : 'Dismiss this note'}
              className="flex-shrink-0 rounded-lg p-1 text-[#6B6B75] transition-colors hover:bg-white/[0.06] hover:text-[#E5E5EA] active:scale-[0.97]"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* iMessage bubbles: full 18px radius with a tail on the last of a run,
            no timestamps and no sender labels — exactly the iOS treatment. */}
        {messages.map((m, i) => {
          const mine = m.role === 'user';
          const endsRun = messages[i + 1]?.role !== m.role;
          return (
            <div key={i} className={cn('flex', mine ? 'justify-end' : 'justify-start', !endsRun && '-mb-1.5')}>
              <div
                className="relative max-w-[78%] px-3.5 py-2 text-[15px] leading-[1.32] whitespace-pre-wrap"
                style={{
                  borderRadius: 18,
                  background: mine ? activeColor : '#26262A',
                  color: mine ? '#fff' : '#F2F2F2',
                }}
              >
                {m.content}
                {endsRun && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 h-[15px] w-[18px]"
                    style={{
                      [mine ? 'right' : 'left']: -6,
                      background: mine ? activeColor : '#26262A',
                      WebkitMaskImage: `radial-gradient(circle at ${mine ? '100%' : '0%'} 0, transparent 15px, black 15.5px)`,
                      maskImage: `radial-gradient(circle at ${mine ? '100%' : '0%'} 0, transparent 15px, black 15.5px)`,
                      borderBottomLeftRadius: mine ? 0 : 4,
                      borderBottomRightRadius: mine ? 4 : 0,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
        {(sending || transcribing) && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5" style={{ background: '#26262A', borderRadius: 18 }}>
              <Loader2 size={14} className="animate-spin" style={{ color: '#8B8BA7' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input box (redesigned) */}
      <div className="p-3">
        <div
          className={cn('rounded-3xl border bg-[#111114] p-2 transition-colors')}
          style={{ borderColor: listening ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.10)' }}
        >
          {listening ? (
            <VoiceViz isFr={isFr} analyser={analyser} />
          ) : (
            <textarea
              ref={taRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder={
                mode === 'receptionist'
                  ? (isFr ? 'Parlez comme un appelant…' : 'Speak as a caller…')
                  : mode === 'onboarding'
                    ? (isFr ? 'Répondez pour avancer la config…' : 'Answer to move setup forward…')
                    : (isFr ? 'Écrivez ou parlez…' : 'Type or speak…')
              }
              className="flex w-full resize-none bg-transparent px-3 py-2 text-[14px] text-gray-100 placeholder:text-gray-500 focus:outline-none min-h-[40px]"
            />
          )}

          {/* Actions row: mode pills + mic/send */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className={cn('flex items-center gap-1', listening && 'opacity-0 invisible')}>
              {(lockMode ? [] : PILLS).map(m => {
                const active = activePill === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => switchPill(m.id)}
                    aria-pressed={active}
                    className="rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8"
                    style={active
                      ? { background: `${m.color}26`, borderColor: m.color, color: m.color }
                      : { background: 'transparent', borderColor: 'transparent', color: '#9CA3AF' }}
                  >
                    <motion.span
                      className="grid place-items-center"
                      animate={{ scale: active ? 1.1 : 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                      <Icon size={15} />
                    </motion.span>
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 'auto', opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[11px] overflow-hidden whitespace-nowrap font-medium"
                        >
                          {isFr ? m.label : m.labelEn}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Dictation language. Separate from the agent's caller-facing
                  language on purpose: you may configure an English agent while
                  speaking French. */}
              {!listening && !hasContent && micSupported && (
                <button
                  type="button"
                  onClick={() => setDictationLang(l => (l === 'fr' ? 'en' : 'fr'))}
                  aria-label={isFr
                    ? `Langue de dictée : ${dictationLang === 'fr' ? 'français' : 'anglais'}. Changer.`
                    : `Dictation language: ${dictationLang === 'fr' ? 'French' : 'English'}. Change.`}
                  className="h-9 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] hover:text-[#E5E5EA] hover:bg-white/[0.06] transition-colors active:scale-[0.97]"
                >
                  {dictationLang}
                </button>
              )}

              {/* Discard the take rather than transcribing it. */}
              {listening && (
                <button
                  type="button"
                  onClick={cancelRecording}
                  aria-label={isFr ? 'Annuler l’enregistrement' : 'Discard recording'}
                  className="h-9 w-9 rounded-full grid place-items-center transition-colors text-[#9CA3AF] hover:text-[#E5E5EA] hover:bg-white/[0.06] active:scale-[0.97]"
                >
                  <X size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (listening) stopRecording();
                  else if (hasContent) void send(input);
                  else void startRecording();
                }}
                disabled={(sending || transcribing) && !hasContent}
                aria-label={listening ? (isFr ? 'Arrêter et transcrire' : 'Stop and transcribe') : hasContent ? (isFr ? 'Envoyer' : 'Send') : (isFr ? 'Dicter' : 'Dictate')}
                className="h-9 w-9 rounded-full grid place-items-center transition-colors flex-shrink-0 active:scale-[0.97]"
                style={
                  listening
                    ? { background: '#dc2626', color: '#fff' }
                    : hasContent
                      ? { background: '#F2F2F2', color: '#0B0B0D' }
                      : { background: 'rgba(255,255,255,0.06)', color: '#9CA3AF' }
                }
              >
                {(sending || transcribing) ? <Square size={14} className="animate-pulse" />
                  : listening ? <StopCircle size={17} />
                  : hasContent ? <ArrowUp size={16} />
                  : <Mic size={17} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
