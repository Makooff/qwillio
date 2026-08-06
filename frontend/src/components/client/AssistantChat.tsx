import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp, Mic, Square, AudioLines, Plus,
  Loader2, Bot, Copy, Check, PhoneCall, X, Lightbulb,
} from '../icons';
import api from '../../services/api';
import VapiLiveCall from './VapiLiveCall';

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Modes the backend understands. Onboarding keeps its own tool to finish setup. */
type Mode = 'config' | 'onboarding' | 'receptionist';
interface Msg { role: 'user' | 'assistant'; content: string }

/**
 * The composer used to carry a mode switch — "Assistant" vs "Call test".
 * It was a second door to a room that already has one: the live-call card sits
 * directly above this chat and starts a REAL call with the receptionist. A
 * typed roleplay of a phone agent was never as good as phoning it, so the
 * switch only ever offered a worse version of something one tap away.
 *
 * The chat is now one thing: the setup assistant.
 */

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
 * The setup assistant: configure the receptionist by talking to it.
 *
 * Guided when nothing is configured yet, free-form once it is — the app decides
 * which from `setupComplete`, so that is one choice the user never makes.
 *
 * Three ways in, all landing on the same assistant: type, dictate into the
 * field, or open a spoken session with the voice button. Testing the
 * receptionist is NOT one of them: that is a real call, and it has its own card
 * above this panel.
 */
export default function AssistantChat({
  isFr = true, onConfigChanged, initialMode = 'config', lockMode = false, onCompleted,
  businessName, planLabel, isTrial = false, phone, quota, showHeader = true,
  setupComplete = true, onItemsExtracted, numberBadge,
}: {
  isFr?: boolean;
  onConfigChanged?: () => void;
  /** Mode to open in. Defaults to config, the dashboard's use. */
  initialMode?: Mode;
  /** Hides the intro card, for first-time setup where it would repeat the page. */
  lockMode?: boolean;
  /** Onboarding mode: the assistant considers first-time setup finished. */
  onCompleted?: () => void;
  /** Identity shown in the chat header, so the panel says who you are talking to. */
  businessName?: string;
  planLabel?: string;
  isTrial?: boolean;
  phone?: string | null;
  /* Pastille posée à GAUCHE de l'icône « copier », sur la ligne du numéro.
     L'état du transfert appartient à la page, pas au chat: le chat se
     contente de lui prêter la place où on le cherche des yeux. */
  numberBadge?: ReactNode;
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
  /**
   * Receives the price lines read out of a photo, once the user has confirmed
   * them. Nothing is written to the configuration without that confirmation.
   */
  onItemsExtracted?: (items: { category: string; name: string; price: string }[]) => void;
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
  const [extracting, setExtracting] = useState(false);
  // Held until confirmed. Writing a customer's price list straight from an OCR
  // pass nobody has read is exactly the kind of silent change to avoid.
  const [pendingItems, setPendingItems] = useState<{ category: string; name: string; price: string }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
  /** Spoken configuration session, opened from the composer's voice button. */
  const [voiceOpen, setVoiceOpen] = useState(false);
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

  /** Read a price list out of a photo, then show it for confirmation. */
  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify('Envoyez une photo (JPEG, PNG ou HEIC).', 'Please send a photo (JPEG, PNG or HEIC).');
      return;
    }
    setExtracting(true);
    try {
      const image = await blobToBase64(file);
      const { data } = await api.post('/my-dashboard/assistant/extract-items', {
        image,
        mimeType: file.type,
      });
      const items: { category: string; name: string; price: string }[] = data?.items || [];
      if (!items.length) {
        notify("Je n'ai trouvé aucun tarif sur cette image. Essayez une photo plus nette, ou cadrée sur la grille de prix.",
               'I found no prices in that image. Try a sharper photo, or one framed on the price list.');
        return;
      }
      // Shown, not written. A customer's configuration is not something to
      // modify on the strength of an OCR pass nobody has looked at.
      const preview = items.slice(0, 30).map(i => `· ${i.name}${i.price ? ` — ${i.price}` : ''}`).join('\n');
      setPendingItems(items);
      setMessages(m => [...m, { role: 'assistant', content: isFr
        ? `J'ai lu ${items.length} ligne${items.length > 1 ? 's' : ''} :\n\n${preview}${items.length > 30 ? `\n\n…et ${items.length - 30} de plus.` : ''}\n\nJe les ajoute à votre base de connaissances ?`
        : `I read ${items.length} line${items.length > 1 ? 's' : ''}:\n\n${preview}${items.length > 30 ? `\n\n…and ${items.length - 30} more.` : ''}\n\nShall I add them to your knowledge base?` }]);
    } catch (err: any) {
      const code = err?.response?.data?.error;
      notify(
        code === 'extraction_unavailable'
          ? "La lecture d'image n'est pas configurée sur ce compte."
          : code === 'image_too_large'
            ? 'Image trop lourde. Réduisez-la avant de renvoyer.'
            : code === 'extraction_rate_limited'
              ? 'Trop d’envois d’un coup. Réessayez dans une minute.'
              : "La lecture de l'image a échoué. Réessayez.",
        code === 'extraction_unavailable'
          ? 'Image reading is not configured on this account.'
          : code === 'image_too_large'
            ? 'Image too large. Shrink it and try again.'
            : code === 'extraction_rate_limited'
              ? 'Too many uploads at once. Try again in a minute.'
              : 'Reading the image failed. Please try again.',
      );
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
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

  /**
   * Open a spoken conversation with the SETUP assistant.
   *
   * Not the receptionist: that one is one tap above, in its own card, and it
   * answers callers. This one changes settings, and it runs on the same voice
   * stack so configuring the agent never feels worse than the agent itself.
   */
  const startVoiceSession = () => {
    setVoiceOpen(true);
  };
  /** Brand violet — the setup assistant is the only identity this chat has now. */
  const activeColor = '#7A5FFF';

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
              onClick={async () => {
                if (liveCall) { setLiveCall(false); return; }
                // The browser only grants the microphone from inside a user
                // gesture. The panel dials on its own once open, and by then we
                // are past the gesture — so the permission is asked for here,
                // synchronously on the click, while it can still be granted.
                // Tracks are released immediately; the grant outlives them.
                try {
                  const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
                  probe.getTracks().forEach(t => t.stop());
                } catch {
                  // Opening anyway: the panel asks again and reports the refusal
                  // in words, which beats a button that silently does nothing.
                }
                setLiveCall(true);
              }}
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
            <span className="ml-auto flex items-center gap-2.5">
              {numberBadge}
              {copied
                ? <Check size={13} className="text-emerald-400" aria-hidden="true" />
                : <Copy size={13} className="text-[#9A9AA5]" aria-hidden="true" />}
            </span>
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

      {/* Live voice call with the real receptionist, driven from the header.
          The header button IS the intent to call, so it dials straight away —
          landing on a card that says "call" after pressing a phone icon asks
          the same question twice. Hanging up closes the panel for the same
          reason: the call is over, there is nothing left to show. */}
      {liveCall && (
        <div className="px-3 pt-3">
          <VapiLiveCall isFr={isFr} autoStart onEnded={() => setLiveCall(false)} />
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

      {/* Confirmation before anything is written to the configuration. */}
      {pendingItems && (
        <div className="px-3 pb-1">
          <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
               style={{ borderColor: 'rgba(122,95,255,0.35)', background: 'rgba(122,95,255,0.08)' }}>
            <span className="text-[12.5px] text-[#E5E5EA]">
              {isFr ? `${pendingItems.length} ligne${pendingItems.length > 1 ? 's' : ''} à ajouter` : `${pendingItems.length} line${pendingItems.length > 1 ? 's' : ''} to add`}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPendingItems(null);
                  setMessages(m => [...m, { role: 'assistant', content: isFr ? "D'accord, je n'ajoute rien." : 'Fine, nothing added.' }]);
                }}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-[#9A9AA5] transition-colors hover:bg-white/[0.06] hover:text-[#E5E5EA] active:scale-[0.97]"
              >
                {isFr ? 'Annuler' : 'Discard'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onItemsExtracted?.(pendingItems);
                  const n = pendingItems.length;
                  setPendingItems(null);
                  setMessages(m => [...m, { role: 'assistant', content: isFr
                    ? `${n} ligne${n > 1 ? 's ajoutées' : ' ajoutée'}. Vérifiez-les dans Base de connaissances, elles sont modifiables.`
                    : `${n} line${n > 1 ? 's added' : ' added'}. Check them under Knowledge base, they stay editable.` }]);
                }}
                className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors active:scale-[0.97]"
                style={{ background: '#7A5FFF', color: '#fff' }}
              >
                {isFr ? 'Ajouter' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {voiceOpen && (
        <div className="p-3">
          <div className="rounded-3xl border border-white/10 bg-[#111114] p-3">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[12px] font-medium text-[#9CA3AF]">
                {isFr ? 'Configuration \u00e0 la voix' : 'Voice setup'}
              </span>
              <button
                type="button"
                onClick={() => setVoiceOpen(false)}
                aria-label={isFr ? 'Fermer' : 'Close'}
                className="h-8 w-8 rounded-full grid place-items-center text-[#9CA3AF] transition-colors hover:bg-white/[0.06] hover:text-[#E5E5EA] active:scale-[0.97]"
              >
                <X size={16} />
              </button>
            </div>
            <VapiLiveCall
              isFr={isFr}
              endpoint="/my-dashboard/assistant/voice-config"
              autoStart
              onEnded={() => {
                setVoiceOpen(false);
                // Settings may have changed during the spoken session; let the
                // page reload them rather than showing a stale summary.
                onConfigChanged?.();
              }}
            />
          </div>
        </div>
      )}

      {/* Input box (redesigned) */}
      <div className={cn('p-3', voiceOpen && 'hidden')}>
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

          {/* Actions row.
              Layout follows the pattern every phone user already knows from
              their assistant app: attachments on the left, one primary button
              on the right whose meaning follows what you have typed. Empty
              field means voice, text means send. Nothing else moves. */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1">
              {/* Hand over a price list you already have, instead of retyping
                  thirty rows. */}
              {!listening && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={extracting}
                    aria-label={isFr ? 'Envoyer une photo de vos tarifs' : 'Send a photo of your prices'}
                    className="h-9 w-9 rounded-full grid place-items-center text-[#9CA3AF] transition-colors hover:bg-white/[0.06] hover:text-[#E5E5EA] disabled:opacity-40 active:scale-[0.97]"
                  >
                    {extracting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
                  </button>
                </>
              )}

              {/* Discard the take rather than transcribing it. */}
              {listening && (
                <button
                  type="button"
                  onClick={cancelRecording}
                  aria-label={isFr ? 'Annuler l\u2019enregistrement' : 'Discard recording'}
                  className="h-9 w-9 rounded-full grid place-items-center transition-colors text-[#9CA3AF] hover:text-[#E5E5EA] hover:bg-white/[0.06] active:scale-[0.97]"
                >
                  <X size={16} />
                </button>
              )}
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
                    ? `Langue de dict\u00e9e : ${dictationLang === 'fr' ? 'fran\u00e7ais' : 'anglais'}. Changer.`
                    : `Dictation language: ${dictationLang === 'fr' ? 'French' : 'English'}. Change.`}
                  className="h-9 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] hover:text-[#E5E5EA] hover:bg-white/[0.06] transition-colors active:scale-[0.97]"
                >
                  {dictationLang}
                </button>
              )}

              {/* Dictate into the field. Distinct from the voice button beside
                  it: this one produces text you can still edit, that one opens
                  a spoken conversation. */}
              {!listening && micSupported && (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  aria-label={isFr ? 'Dicter' : 'Dictate'}
                  className="h-9 w-9 rounded-full grid place-items-center text-[#9CA3AF] transition-colors hover:bg-white/[0.06] hover:text-[#E5E5EA] active:scale-[0.97]"
                >
                  <Mic size={17} />
                </button>
              )}

              {/* Stop the take and transcribe it. */}
              {listening && (
                <button
                  type="button"
                  onClick={() => stopRecording()}
                  aria-label={isFr ? 'Arr\u00eater et transcrire' : 'Stop and transcribe'}
                  className="h-9 w-9 rounded-full grid place-items-center text-[#E5E5EA] transition-colors hover:bg-white/[0.06] active:scale-[0.97]"
                >
                  <Square size={15} />
                </button>
              )}

              {/*
                The primary button. One control, three meanings, decided by what
                is in the field:
                  empty      -> open a spoken conversation with the assistant
                  typed      -> send it
                  recording  -> send the take
                It stays in the same place and keeps the same shape through all
                three, so the eye never has to re-find it. Only the icon crosses
                over, and only the fill colour changes.
              */}
              <button
                type="button"
                onClick={() => {
                  if (listening) { stopRecording(); return; }
                  if (hasContent) { void send(input); return; }
                  void startVoiceSession();
                }}
                disabled={sending || transcribing}
                aria-label={
                  listening
                    ? (isFr ? 'Envoyer' : 'Send')
                    : hasContent
                      ? (isFr ? 'Envoyer' : 'Send')
                      : (isFr ? 'Parler \u00e0 l\u2019assistant' : 'Talk to the assistant')
                }
                className="relative h-9 w-9 rounded-full grid place-items-center flex-shrink-0 transition-colors active:scale-[0.97] disabled:opacity-40"
                style={{
                  background: hasContent || listening ? activeColor : 'rgba(255,255,255,0.06)',
                  color: hasContent || listening ? '#fff' : activeColor,
                }}
              >
                {/* Crossfade the icon rather than swapping it: a hard swap on
                    every keystroke of the first character reads as a glitch.
                    Transitions, not keyframes, so typing fast retargets the
                    animation mid-flight instead of restarting it. */}
                <span
                  className="absolute inset-0 grid place-items-center transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    opacity: hasContent || listening ? 1 : 0,
                    transform: hasContent || listening ? 'scale(1)' : 'scale(0.7)',
                  }}
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={17} />}
                </span>
                <span
                  className="absolute inset-0 grid place-items-center transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    opacity: hasContent || listening ? 0 : 1,
                    transform: hasContent || listening ? 'scale(0.7)' : 'scale(1)',
                  }}
                >
                  <AudioLines size={17} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
