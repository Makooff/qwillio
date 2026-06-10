import { useState, useRef } from 'react';
import { Play } from 'lucide-react';
import Card3D from '../ui/Card3D';

/* ── Voice card (showcase) ────────────────────────────────────────────────── */
export interface VoiceData {
  name: string;
  accent: string;
  vibe: string;
  swatch: string;
  ring: string;
  initials: string;
  lang: string;
  sample: string;
}

export default function VoiceCard({ v, large = false }: { v: VoiceData; large?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function speak() {
    if (playing) {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      setPlaying(false);
      return;
    }

    const audio = new Audio(`/voices/${v.name.toLowerCase()}.mp3`);
    audioRef.current = audio;

    audio.onplay = () => setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(v.sample);
      utt.lang = v.lang;
      utt.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((vx) => vx.lang.startsWith(v.lang.split('-')[0]));
      if (match) utt.voice = match;
      utt.onstart = () => setPlaying(true);
      utt.onend = () => setPlaying(false);
      utt.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(utt);
    };

    audio.play().catch(() => audio.dispatchEvent(new Event('error')));
  }

  return (
    <Card3D intensity={4}>
    <figure
      className={`relative rounded-3xl border border-[#1d1d1f]/10 bg-white p-6 h-full ${
        large ? 'md:p-8' : ''
      } hover:border-[#6366f1]/40 transition-colors duration-300 group`}
    >
      <div className="flex items-start gap-4">
        <span
          className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white font-semibold text-base tracking-tight flex-shrink-0"
          style={{ background: v.swatch, boxShadow: `0 6px 20px -8px ${v.ring}` }}
          aria-hidden="true"
        >
          {v.initials}
        </span>
        <div className="flex-1 min-w-0">
          <figcaption className="flex items-baseline gap-2 mb-1">
            <h3 className={`font-semibold tracking-[-0.02em] ${large ? 'text-xl' : 'text-lg'}`}>
              {v.name}
            </h3>
            <span className="text-[11px] text-[#86868b]">{v.accent}</span>
          </figcaption>
          <p className="text-[13px] text-[#525257] leading-relaxed">{v.vibe}</p>
        </div>
      </div>

      {/* Mini waveform preview */}
      <div className="mt-5 flex items-end gap-[3px] h-8" aria-hidden="true">
        {Array.from({ length: 32 }).map((_, i) => {
          const h = 8 + Math.abs(Math.sin(i * 0.7 + v.initials.charCodeAt(0))) * 22;
          return (
            <span
              key={i}
              className="flex-1 rounded-full transition-[width] duration-500 ease-out"
              style={{
                height: `${h}px`,
                background: v.swatch,
                opacity: 0.18 + (i % 5) * 0.08,
              }}
            />
          );
        })}
      </div>

      <button
        type="button"
        aria-label={`${v.name} preview`}
        onClick={speak}
        className="absolute top-5 right-5 w-9 h-9 rounded-full text-white flex items-center justify-center transition-colors"
        style={{ background: playing ? v.swatch : '#1d1d1f' }}
      >
        {playing ? (
          <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-[3px] rounded-full"
                style={{
                  background: 'white',
                  animation: `waveBar 0.6s ${i * 0.12}s ease-in-out infinite`,
                  height: '100%',
                }}
              />
            ))}
          </span>
        ) : (
          <Play size={11} fill="currentColor" aria-hidden="true" />
        )}
      </button>
    </figure>
    </Card3D>
  );
}
