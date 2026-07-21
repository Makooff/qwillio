import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp, Mic, StopCircle, Square, Settings, Rocket, Headphones,
  Volume2, VolumeX, Loader2,
} from 'lucide-react';
import api from '../../services/api';

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Mode = 'config' | 'onboarding' | 'receptionist';
interface Msg { role: 'user' | 'assistant'; content: string }

const MODES: { id: Mode; label: string; labelEn: string; icon: typeof Settings; color: string }[] = [
  { id: 'config',       label: 'Config',        labelEn: 'Config',       icon: Settings,    color: '#7B5CF0' },
  { id: 'onboarding',   label: 'Onboarding',    labelEn: 'Onboarding',   icon: Rocket,      color: '#a855f7' },
  { id: 'receptionist', label: 'Réceptionniste', labelEn: 'Reception',   icon: Headphones,  color: '#14b8a6' },
];

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

type SpeechRec = any;
function getRecognition(): SpeechRec | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// Recording visualizer + timer.
function VoiceViz({ isFr }: { isFr: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return (
    <div className="flex flex-col items-center justify-center w-full py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-xs text-white/70">{mm}:{ss}</span>
        <span className="text-[11px] text-white/50">{isFr ? '· parlez…' : '· speak…'}</span>
      </div>
      <div className="w-full h-8 flex items-center justify-center gap-0.5 px-4">
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-white/40 animate-pulse"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Conversational assistant with three modes:
 *  - Config: change your receptionist's settings by talking.
 *  - Onboarding: guided first-time setup, one step at a time.
 *  - Receptionist: roleplay/test — the AI answers as your receptionist would.
 * Text + browser mic (Web Speech API) + optional spoken replies.
 */
export default function AssistantChat({
  isFr = true, onConfigChanged,
}: {
  isFr?: boolean;
  onConfigChanged?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('config');
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greetingFor('config', isFr) }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  const recRef = useRef<SpeechRec | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMicSupported(!!getRecognition()); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, listening]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    window.speechSynthesis?.cancel();
    setMode(m);
    setMessages([{ role: 'assistant', content: greetingFor(m, isFr) }]);
    setInput('');
  };

  const speakReply = (text: string) => {
    if (!speak || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = isFr ? 'fr-FR' : 'en-US';
    window.speechSynthesis.speak(u);
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
      speakReply(reply);
      if (res.data?.configChanged) onConfigChanged?.();
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: isFr ? 'Une erreur est survenue. Réessayez.' : 'Something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = isFr ? 'fr-FR' : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (transcript) send(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const hasContent = input.trim() !== '';
  const activeColor = MODES.find(m => m.id === mode)!.color;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0C] overflow-hidden flex flex-col" style={{ height: 480 }}>
      {/* Header: title + speaker toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[13px] font-semibold text-[#F2F2F2]">
          {isFr ? 'Parler à ma réceptionniste' : 'Talk to my receptionist'}
        </span>
        <button
          type="button"
          onClick={() => setSpeak(s => !s)}
          aria-pressed={speak}
          aria-label={isFr ? 'Lecture vocale' : 'Speak replies'}
          className="w-8 h-8 rounded-full grid place-items-center transition-colors"
          style={{ background: speak ? 'rgba(123,92,240,0.16)' : 'rgba(255,255,255,0.04)', color: speak ? '#a5b4fc' : '#8B8BA7' }}
        >
          {speak ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user'
                ? { background: activeColor, color: '#fff', borderBottomRightRadius: 6 }
                : { background: 'rgba(255,255,255,0.05)', color: '#E5E5EA', borderBottomLeftRadius: 6 }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
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
            <VoiceViz isFr={isFr} />
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
              {MODES.map(m => {
                const active = mode === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => switchMode(m.id)}
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

            <button
              type="button"
              onClick={() => {
                if (listening) { recRef.current?.stop(); setListening(false); }
                else if (hasContent) send(input);
                else if (micSupported) toggleMic();
              }}
              disabled={sending && !hasContent}
              aria-label={listening ? (isFr ? 'Arrêter' : 'Stop') : hasContent ? (isFr ? 'Envoyer' : 'Send') : (isFr ? 'Micro' : 'Voice')}
              className="h-9 w-9 rounded-full grid place-items-center transition-colors flex-shrink-0"
              style={
                listening
                  ? { background: '#dc2626', color: '#fff' }
                  : hasContent
                    ? { background: '#F2F2F2', color: '#0B0B0D' }
                    : { background: 'rgba(255,255,255,0.06)', color: '#9CA3AF' }
              }
            >
              {sending ? <Square size={14} className="animate-pulse" />
                : listening ? <StopCircle size={17} />
                : hasContent ? <ArrowUp size={16} />
                : <Mic size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
