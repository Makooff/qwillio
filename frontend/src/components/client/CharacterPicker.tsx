import { useState } from 'react';
import { Play, Square } from 'lucide-react';

export interface Character {
  id: string;
  name: string;
  language: 'fr' | 'en';
  accent: 'FR' | 'BE' | 'US';
  gender: 'f' | 'm';
  personaKey: string;
  taglineFr: string;
  taglineEn: string;
  previewFr: string;
  previewEn: string;
}

// Browser TTS preview. This is a rough in-app preview only — the real call uses
// the ElevenLabs voice; this just lets the client hear the tone/line quickly.
function speak(text: string, lang: 'fr' | 'en', onEnd: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const match = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
  if (match) u.voice = match;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

export default function CharacterPicker({
  characters, value, onChange, isFr = true,
}: {
  characters: Character[];
  value: string;
  onChange: (id: string) => void;
  isFr?: boolean;
}) {
  const [playing, setPlaying] = useState<string | null>(null);

  const preview = (c: Character) => {
    if (playing === c.id) {
      window.speechSynthesis?.cancel();
      setPlaying(null);
      return;
    }
    setPlaying(c.id);
    speak(isFr ? c.previewFr : c.previewEn, c.language, () => setPlaying(null));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {characters.map(c => {
        const sel = value === c.id;
        const tagline = isFr ? c.taglineFr : c.taglineEn;
        return (
          <div
            key={c.id}
            className="text-left p-3 rounded-xl border transition-colors flex items-start gap-3"
            style={{
              background: sel ? 'rgba(123,92,240,0.10)' : '#0A0A0C',
              borderColor: sel ? 'rgba(123,92,240,0.55)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => onChange(c.id)}
              className="flex-1 text-left"
              aria-pressed={sel}
            >
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold" style={{ color: sel ? '#493cbe' : '#F2F2F2' }}>{c.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9A9AA5' }}>
                  {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? (isFr ? 'F' : 'F') : (isFr ? 'H' : 'M')}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(123,92,240,0.85)' : '#8B8BA7' }}>{tagline}</p>
            </button>
            <button
              type="button"
              onClick={() => preview(c)}
              aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
              className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors"
              style={{ background: 'rgba(123,92,240,0.14)', color: '#a5b4fc' }}
            >
              {playing === c.id ? <Square size={13} /> : <Play size={13} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
