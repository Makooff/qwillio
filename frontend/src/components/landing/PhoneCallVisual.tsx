import { useState, useEffect } from 'react';
import { Calendar, MessageSquare, PhoneCall, Volume2 } from 'lucide-react';

/*
 * Live call simulation, staged inside an iPhone.
 *
 * The device chrome follows Apple's system furniture — titanium frame, black
 * bezel, Dynamic Island, status bar, home indicator — and the screen uses the
 * real client dashboard register (Signal Dark: #0a0a0a ground, white/[0.06]
 * hairlines, #F2F2F2 / #9A9AA5 type), so what a visitor sees on the marketing
 * page is what they get once they sign in.
 */

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
    <div className="flex justify-center lg:justify-end" aria-hidden={false}>
      {/* Titanium frame */}
      <div
        className="relative w-[280px] rounded-[52px] p-[3px] sm:w-[310px]"
        style={{
          background: 'linear-gradient(155deg, #6b6b70 0%, #2c2c30 18%, #1a1a1d 45%, #3b3b40 78%, #757579 100%)',
          boxShadow: [
            'inset 0 1px 1px rgba(255,255,255,0.28)',
            'inset 0 -1px 1px rgba(0,0,0,0.55)',
            '0 30px 60px -18px rgba(20,16,50,0.45)',
            '0 70px 110px -30px rgba(122,95,255,0.28)',
          ].join(', '),
        }}
      >
        {/* Side buttons, on the metal edge */}
        <span className="absolute -left-[3px] top-[104px] h-[26px] w-[4px] rounded-l-[3px]" style={{ background: 'linear-gradient(90deg, #8a8a90, #3a3a40 45%, #232327)' }} />
        <span className="absolute -left-[3px] top-[148px] h-[44px] w-[4px] rounded-l-[3px]" style={{ background: 'linear-gradient(90deg, #8a8a90, #3a3a40 45%, #232327)' }} />
        <span className="absolute -left-[3px] top-[202px] h-[44px] w-[4px] rounded-l-[3px]" style={{ background: 'linear-gradient(90deg, #8a8a90, #3a3a40 45%, #232327)' }} />
        <span className="absolute -right-[3px] top-[164px] h-[70px] w-[4px] rounded-r-[3px]" style={{ background: 'linear-gradient(270deg, #8a8a90, #3a3a40 45%, #232327)' }} />

        {/* Black bezel */}
        <div className="rounded-[49px] bg-[#050506] p-[8px]">
          {/* Screen — the dashboard ground colour */}
          <div className="relative aspect-[390/812] overflow-hidden rounded-[42px] bg-[#0a0a0a]">
            {/* Status bar */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-[13px] text-[11px] font-semibold text-white">
              <span className="tabular-nums">9:41</span>
              <span className="flex items-center gap-[5px]">
                {/* Cellular */}
                <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <rect key={i} x={i * 4} y={7 - i * 2.2} width="2.6" height={3 + i * 2.2} rx="0.8" fill="white" />
                  ))}
                </svg>
                {/* Wi-Fi */}
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                  <path d="M7 8.6 5.2 6.7a2.6 2.6 0 0 1 3.6 0L7 8.6Z" fill="white" />
                  <path d="M3.4 4.9a5.2 5.2 0 0 1 7.2 0" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M1.4 2.6a8.2 8.2 0 0 1 11.2 0" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {/* Battery */}
                <svg width="24" height="11" viewBox="0 0 24 11" fill="none" aria-hidden="true">
                  <rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke="white" strokeOpacity="0.4" />
                  <rect x="2" y="2" width="14" height="7" rx="1.6" fill="white" />
                  <path d="M22 4v3a1.8 1.8 0 0 0 0-3Z" fill="white" fillOpacity="0.4" />
                </svg>
              </span>
            </div>

            {/* Dynamic Island */}
            <div className="absolute left-1/2 top-[11px] z-30 h-[26px] w-[84px] -translate-x-1/2 rounded-full bg-black">
              <span className="absolute right-[9px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-[#101014]" />
            </div>

            {/* App content */}
            <div className="absolute inset-0 flex flex-col pt-[52px]">
              {/* Call header — dashboard card register */}
              <div className="mx-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                    <PhoneCall size={13} className="text-emerald-400" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold leading-tight text-[#F2F2F2]">Bright Dental</p>
                    <p className="truncate text-[9.5px] tabular-nums text-[#9A9AA5]">
                      {isFr ? '+33 1 42 86 12 34' : '+1 (415) 555 0102'}
                    </p>
                  </div>
                  <span className="flex flex-shrink-0 flex-col items-end gap-0.5">
                    <span className="inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.16em] text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: 'qpulse 1.6s ease-in-out infinite' }} />
                      {isFr ? 'En direct' : 'Live'}
                    </span>
                    <span className="text-[9px] tabular-nums text-[#6b6b76]">00:42</span>
                  </span>
                </div>
              </div>

              {/* Transcript */}
              <ul
                className="mt-2.5 flex-1 space-y-2 overflow-hidden px-3"
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
                      className={`max-w-[84%] px-3 py-2 text-[11.5px] leading-snug ${
                        line.who === 'ai'
                          ? 'rounded-[16px] rounded-bl-[5px] bg-[#7a5fff] text-white'
                          : 'rounded-[16px] rounded-br-[5px] border border-white/[0.06] bg-white/[0.06] text-[#F2F2F2]'
                      }`}
                    >
                      <span
                        className={`mb-0.5 block text-[8px] font-bold uppercase tracking-[0.16em] ${
                          line.who === 'ai' ? 'text-white/60' : 'text-[#9A9AA5]'
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
                    <span className="inline-flex items-center gap-1.5 rounded-[16px] rounded-bl-[5px] bg-[#7a5fff] px-3 py-2.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-white/80"
                          style={{ animation: `dot 1.1s ${i * 140}ms ease-in-out infinite` }}
                        />
                      ))}
                    </span>
                  </li>
                )}
              </ul>

              {/* Outcome chips */}
              <div className="mx-3 flex items-center gap-2.5 border-t border-white/[0.06] pt-2.5">
                <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-[#b9a8ff]">
                  <Calendar size={10} aria-hidden="true" />
                  {isFr ? 'RDV pris' : 'Booked'}
                </span>
                <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
                  <MessageSquare size={10} aria-hidden="true" />
                  {isFr ? 'SMS envoyé' : 'SMS sent'}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[8.5px] tabular-nums text-[#6b6b76]">
                  <Volume2 size={9} aria-hidden="true" />
                  0.6s
                </span>
              </div>

              {/* Waveform */}
              <div className="mx-3 mt-2 flex h-5 items-center gap-[2px] overflow-hidden" aria-hidden="true">
                {Array.from({ length: 44 }).map((_, i) => {
                  const h = 3 + Math.abs(Math.sin(i * 0.55) * 11) + (i % 4) * 2;
                  return (
                    <span
                      key={i}
                      className="flex-1 rounded-full bg-[#7a5fff]/45"
                      style={{ height: `${h}px`, animation: `wave 1.4s ${i * 28}ms ease-in-out infinite` }}
                    />
                  );
                })}
              </div>

              {/* Home indicator */}
              <div className="flex justify-center py-2.5">
                <span className="h-[4px] w-[110px] rounded-full bg-white/30" />
              </div>
            </div>

            {/* Screen glass */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[42px]"
              style={{ background: 'linear-gradient(140deg, rgba(255,255,255,0.07) 0%, transparent 38%)' }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes wave { 0%, 100% { transform: scaleY(0.6); opacity: 0.35; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes dot { 0%, 100% { transform: translateY(0); opacity: 0.45; } 50% { transform: translateY(-3px); opacity: 1; } }
        @keyframes qpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
    </div>
  );
}
