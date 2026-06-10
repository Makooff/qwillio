import { useState, useEffect } from 'react';
import { Calendar, MessageSquare, PhoneCall, Volume2 } from 'lucide-react';

/* ── Live call simulation visual (hero right column) ──────────────────────── */
interface TranscriptLine {
  who: 'ai' | 'caller';
  text: string;
}

export default function PhoneCallVisual({ isFr }: { isFr: boolean }) {
  const aiName = isFr ? 'Marie' : 'Ashley';
  const lines: TranscriptLine[] = isFr
    ? [
        { who: 'ai', text: 'Bonjour, cabinet Bright Dental, c\'est Marie. Comment puis-je vous aider ?' },
        { who: 'caller', text: "J'aimerais prendre rendez-vous pour un détartrage." },
        { who: 'ai', text: 'Bien sûr. Mardi 14h ou jeudi 10h conviennent ?' },
        { who: 'caller', text: 'Mardi 14h, parfait.' },
        { who: 'ai', text: 'Réservé. Un SMS de confirmation arrive dans la minute.' },
      ]
    : [
        { who: 'ai', text: "Hi, Bright Dental, this is Ashley. How can I help you today?" },
        { who: 'caller', text: "I'd like to book a cleaning appointment." },
        { who: 'ai', text: 'Of course. Tuesday 2pm or Thursday 10am?' },
        { who: 'caller', text: 'Tuesday 2pm, perfect.' },
        { who: 'ai', text: "Booked. A confirmation SMS is on the way." },
      ];

  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= lines.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), 1100);
    return () => clearTimeout(t);
  }, [revealed, lines.length]);

  return (
    <div
      className="relative rounded-3xl border border-[#1d1d1f]/8 bg-[#1d1d1f] p-6 overflow-hidden"
      style={{ boxShadow: '0 40px 80px -20px rgba(29,29,31,0.35)' }}
    >
      {/* Top chrome */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <PhoneCall size={14} className="text-emerald-400" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-white leading-tight">Bright Dental</p>
            <p className="text-[10px] text-white/40 tabular-nums">
              {isFr ? '+33 1 42 86 12 34 · 00:42' : '+1 (415) 555 0102 · 00:42'}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {isFr ? 'En direct' : 'Live'}
        </span>
      </div>

      {/* Transcript */}
      <ul
        className="space-y-2.5 h-[260px] overflow-hidden"
        role="log"
        aria-live="polite"
        aria-label={isFr ? 'Transcription en direct' : 'Live transcript'}
      >
        {lines.slice(0, revealed).map((line, i) => (
          <li
            key={i}
            className={`flex ${line.who === 'ai' ? 'justify-start' : 'justify-end'}`}
            style={{ animation: 'msgIn 480ms cubic-bezier(0.16,1,0.3,1) both' }}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                line.who === 'ai'
                  ? 'bg-[#6366f1]/15 border border-[#6366f1]/25 text-white rounded-bl-md'
                  : 'bg-white/[0.06] border border-white/[0.08] text-white/90 rounded-br-md'
              }`}
            >
              <span
                className={`block text-[9px] font-bold tracking-[0.16em] uppercase mb-1 ${
                  line.who === 'ai' ? 'text-[#a5b4fc]' : 'text-white/40'
                }`}
              >
                {line.who === 'ai' ? aiName : isFr ? 'Appelant' : 'Caller'}
              </span>
              {line.text}
            </div>
          </li>
        ))}
        {revealed < lines.length && (
          <li className="flex justify-start" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-[#6366f1]/15 border border-[#6366f1]/25 px-3.5 py-3 rounded-bl-md">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#a5b4fc]"
                  style={{ animation: `dot 1.1s ${i * 140}ms ease-in-out infinite` }}
                />
              ))}
            </span>
          </li>
        )}
      </ul>

      {/* Bottom action bar */}
      <div className="mt-5 flex items-center gap-3 pt-4 border-t border-white/[0.06]">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-[#6366f1]">
          <Calendar size={11} aria-hidden="true" />
          {isFr ? 'RDV pris' : 'Booked'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-emerald-400">
          <MessageSquare size={11} aria-hidden="true" />
          {isFr ? 'SMS envoyé' : 'SMS sent'}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/35 tabular-nums">
          <Volume2 size={10} aria-hidden="true" />
          0.6s
        </span>
      </div>

      {/* Waveform footer */}
      <div className="mt-4 flex items-center gap-[3px] h-6 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 56 }).map((_, i) => {
          const h = 4 + Math.abs(Math.sin(i * 0.55) * 14) + (i % 4) * 3;
          return (
            <span
              key={i}
              className="flex-1 rounded-full bg-[#6366f1]/40"
              style={{
                height: `${h}px`,
                animation: `wave 1.4s ${i * 28}ms ease-in-out infinite`,
              }}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes wave { 0%, 100% { transform: scaleY(0.6); opacity: 0.35; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes dot { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-3px); opacity: 1; } }
      `}</style>
    </div>
  );
}
