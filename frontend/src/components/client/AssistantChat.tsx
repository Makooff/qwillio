import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Sparkles, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface Msg { role: 'user' | 'assistant'; content: string }

// Minimal typing for the browser Speech Recognition API (non-standard).
type SpeechRec = any;
function getRecognition(): SpeechRec | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Chat + microphone panel to talk to the receptionist's setup assistant.
 * Text input + browser speech-to-text (mic) + optional spoken replies.
 * When the assistant changes a setting, `onConfigChanged` fires so the parent
 * can reload its form state.
 */
export default function AssistantChat({
  isFr = true, onConfigChanged,
}: {
  isFr?: boolean;
  onConfigChanged?: () => void;
}) {
  const greeting = isFr
    ? 'Bonjour ! Je vous aide à configurer votre réceptionniste. Vous pouvez me parler ou écrire : horaires, services, voix, questions… Dites-moi tout.'
    : "Hi! I help you set up your receptionist. Talk or type — hours, services, voice, questions… tell me anything.";

  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greeting }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  const recRef = useRef<SpeechRec | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rec = getRecognition();
    setMicSupported(!!rec);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

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
    setSending(true);
    try {
      const res = await api.post('/my-dashboard/assistant/chat', {
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

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0A0A0C] overflow-hidden" style={{ height: 460 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles size={15} style={{ color: '#a5b4fc' }} />
          <span className="text-[13px] font-semibold text-[#F2F2F2]">
            {isFr ? 'Parler à ma réceptionniste' : 'Talk to my receptionist'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSpeak(s => !s)}
          aria-pressed={speak}
          aria-label={isFr ? 'Lecture vocale des réponses' : 'Speak replies aloud'}
          className="w-8 h-8 rounded-full grid place-items-center transition-colors"
          style={{ background: speak ? 'rgba(123,92,240,0.16)' : 'rgba(255,255,255,0.04)', color: speak ? '#a5b4fc' : '#8B8BA7' }}
        >
          {speak ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user'
                ? { background: '#493cbe', color: '#fff', borderBottomRightRadius: 6 }
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

      <form
        onSubmit={e => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 px-3 py-3 border-t border-white/[0.06]"
      >
        {micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? (isFr ? 'Arrêter le micro' : 'Stop mic') : (isFr ? 'Parler' : 'Speak')}
            className="flex-shrink-0 w-10 h-10 rounded-full grid place-items-center transition-colors"
            style={listening
              ? { background: '#dc2626', color: '#fff' }
              : { background: 'rgba(123,92,240,0.16)', color: '#a5b4fc' }}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isFr ? 'Écrivez ou parlez…' : 'Type or speak…'}
          className="flex-1 px-4 py-2.5 text-[13px] rounded-full border border-white/[0.08] bg-[#0D0D10] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#493cbe]/50"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          aria-label={isFr ? 'Envoyer' : 'Send'}
          className="flex-shrink-0 w-10 h-10 rounded-full grid place-items-center bg-[#F2F2F2] text-[#0B0B0D] disabled:opacity-40 transition-opacity"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
