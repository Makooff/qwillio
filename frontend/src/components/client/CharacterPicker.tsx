import { useEffect } from 'react';
import { Play, Square } from 'lucide-react';
import api from '../../services/api';
import { useVoicePreview } from './useVoicePreview';

export interface Character {
  id: string;
  name: string;
  /** Served from /characters/<id>.webp. */
  avatar?: string;
  accent: 'FR' | 'BE' | 'US';
  gender: 'f' | 'm';
  personaKey: string;
  taglineFr: string;
  taglineEn: string;
  previewFr: string;
  previewEn: string;
}

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

/**
 * The clip plays what this card will actually sound like, override included —
 * otherwise picking a face would audition a voice the client has replaced.
 * Exported because the URL is also the cache key, so prefetching and playing
 * have to agree on it exactly.
 */
export function previewUrl(characterId: string, overrideVoice?: { voiceId: string } | null): string {
  return overrideVoice
    ? `/my-dashboard/characters/${characterId}/preview?voiceId=${encodeURIComponent(overrideVoice.voiceId)}`
    : `/my-dashboard/characters/${characterId}/preview`;
}

export default function CharacterPicker({
  characters, value, onChange, isFr = true, overrideVoice = null,
}: {
  characters: Character[];
  value: string;
  onChange: (c: Character) => void;
  isFr?: boolean;
  /** Voice replacing the catalog one for every character, when the client set one. */
  overrideVoice?: { voiceId: string; name: string } | null;
}) {
  const { playing, notice, toggle, prefetch, debug } = useVoicePreview(isFr);

  // Ask the server to synthesise the catalog while the client reads the page.
  // The clips are identical every time, so the only reason ▶ ever waited was
  // that nobody had asked for them yet.
  useEffect(() => {
    void api.post('/my-dashboard/characters/warm').catch(() => undefined);
  }, []);

  // The selected card is the one most likely to be pressed, so its clip is
  // downloaded and kept in memory: pressing ▶ then costs nothing at all.
  const selectedUrl = value && characters.some(c => c.id === value)
    ? previewUrl(value, overrideVoice)
    : null;
  useEffect(() => {
    if (selectedUrl) prefetch(selectedUrl);
  }, [selectedUrl, prefetch]);

  return (
    <>
    {notice && (
      <p
        role="status"
        // See VoicePicker: the banner is useless where it cannot be seen.
        ref={el => el?.scrollIntoView({ block: 'nearest' })}
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
        const url = previewUrl(c.id, overrideVoice);
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
              onClick={() => onChange(c)}
              className="flex-1 text-left flex items-start gap-2.5"
              aria-pressed={sel}
            >
              {c.avatar && (
                <img
                  src={c.avatar}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                  // The avatar keeps its lavender square; the circle is what
                  // hides it. Cutting the background out frayed hair edges for
                  // a shape the mask removes anyway.
                  className="flex-shrink-0 w-11 h-11 rounded-full object-cover"
                  style={{ outline: sel ? '2px solid rgba(122,95,255,0.55)' : '1px solid rgba(255,255,255,0.10)', outlineOffset: 1 }}
                />
              )}
              <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold" style={{ color: sel ? '#7349fe' : '#F2F2F2' }}>{c.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9A9AA5' }}>
                  {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? 'F' : (isFr ? 'H' : 'M')}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(122,95,255,0.85)' : '#8B8BA7' }}>{tagline}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => toggle(c.id, url, isFr ? c.previewFr : c.previewEn)}
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
    {debug && (
      // Only after a press, and only here: the grid is where people press ▶
      // first, and "no error, no sound" needs something to report.
      <p className="mt-2 text-[10px] font-mono text-[#6D6D7A]">{debug}</p>
    )}
    </>
  );
}
