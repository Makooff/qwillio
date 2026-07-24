import { useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import api from '../../services/api';

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
  const [notice, setNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAll = () => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  };

  // Try the real ElevenLabs voice first; fall back to browser TTS if the
  // backend has no ElevenLabs key (503) or the request fails. The fallback is
  // announced — silently playing a robotic voice makes a misconfigured server
  // look like a bad voice.
  const preview = async (c: Character) => {
    if (playing === c.id) { stopAll(); setPlaying(null); return; }
    stopAll();
    setPlaying(c.id);
    try {
      const { data } = await api.get(`/my-dashboard/characters/${c.id}/preview`, { responseType: 'blob' });
      const url = URL.createObjectURL(data as Blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPlaying(null); URL.revokeObjectURL(url); };
      setNotice(null);
      await audio.play();
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setNotice(
        status === 503
          ? (isFr
            ? 'Voix réelles indisponibles : la clé ElevenLabs n\'est pas configurée sur le serveur. Aperçu joué avec la voix du navigateur.'
            : 'Real voices unavailable: the ElevenLabs key is not configured on the server. Playing the browser voice instead.')
          : (isFr
            ? 'Aperçu ElevenLabs indisponible pour le moment. Aperçu joué avec la voix du navigateur.'
            : 'ElevenLabs preview unavailable right now. Playing the browser voice instead.'),
      );
      speak(isFr ? c.previewFr : c.previewEn, c.language, () => setPlaying(null));
    }
  };

  return (
    <>
    {notice && (
      <p
        role="status"
        className="mb-2 rounded-lg px-3 py-2 text-[11px] leading-snug"
        style={{ background: 'rgba(221,147,252,0.10)', border: '1px solid rgba(221,147,252,0.30)', color: '#e7bafd' }}
      >
        {notice}
      </p>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {characters.map(c => {
        const sel = value === c.id;
        const tagline = isFr ? c.taglineFr : c.taglineEn;
        return (
          <div
            key={c.id}
            className="text-left p-3 rounded-xl border transition-colors flex items-start gap-3"
            style={{
              background: sel ? 'rgba(122,95,255,0.10)' : '#0A0A0C',
              borderColor: sel ? 'rgba(122,95,255,0.55)' : 'rgba(255,255,255,0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => onChange(c.id)}
              className="flex-1 text-left"
              aria-pressed={sel}
            >
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold" style={{ color: sel ? '#7349fe' : '#F2F2F2' }}>{c.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9A9AA5' }}>
                  {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? (isFr ? 'F' : 'F') : (isFr ? 'H' : 'M')}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(122,95,255,0.85)' : '#8B8BA7' }}>{tagline}</p>
            </button>
            <button
              type="button"
              onClick={() => preview(c)}
              aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
              className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors"
              style={{ background: 'rgba(122,95,255,0.14)', color: '#b9a8ff' }}
            >
              {playing === c.id ? <Square size={13} /> : <Play size={13} />}
            </button>
          </div>
        );
      })}
    </div>
    </>
  );
}
