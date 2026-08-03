import { useEffect, useState } from 'react';
import { Play, Square, Check, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useVoicePreview } from './useVoicePreview';

export interface CatalogVoice {
  voiceId: string;
  name: string;
  gender: string | null;
  accent: string | null;
  description: string | null;
  previewUrl: string | null;
  cloned: boolean;
}

export interface SelectedVoice {
  voiceId: string;
  name: string;
  cloned?: boolean;
}

/**
 * Swap the voice of the chosen character without changing the character.
 *
 * The character carries the face, the name and the personality; only how it
 * sounds is negotiable. The previous design made a custom voice a character of
 * its own, so a client who wanted a deeper voice lost the face and the tone they
 * had picked — three losses for one gain.
 *
 * Every entry is auditioned through the selected character, so the sample is
 * what the caller will hear, tuning included.
 */
export default function VoicePicker({
  characterId, characterVoiceName, value, onChange, sampleText, isFr = true,
}: {
  characterId: string;
  /** Name of the character whose default voice is on offer, for the first row. */
  characterVoiceName: string;
  value: SelectedVoice | null;
  onChange: (v: SelectedVoice | null) => void;
  sampleText: string;
  isFr?: boolean;
}) {
  const [voices, setVoices] = useState<CatalogVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playing, notice, toggle } = useVoicePreview(isFr);

  useEffect(() => {
    let alive = true;
    api.get('/my-dashboard/voices')
      .then(({ data }) => { if (alive) setVoices(Array.isArray(data?.voices) ? data.voices : []); })
      .catch(err => {
        if (!alive) return;
        setError(err?.response?.status === 503
          ? "Les voix ne sont pas disponibles : la clé ElevenLabs n'est pas configurée sur le serveur."
          : "Impossible de charger la liste des voix. Réessayez dans un instant.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <p className="mt-3 flex items-center gap-2 text-[12px] text-[#8B8BA7]">
        <Loader2 size={13} className="animate-spin" />
        Chargement des voix…
      </p>
    );
  }

  if (error) return <p role="status" className="mt-3 text-[11px] text-[#f0a0a0]">{error}</p>;

  const rows: Array<{ key: string; label: string; sub: string; voice: SelectedVoice | null; cloned: boolean }> = [
    {
      key: 'default',
      label: isFr ? `Voix d'origine (${characterVoiceName})` : `Original voice (${characterVoiceName})`,
      sub: isFr ? 'La voix livrée avec ce personnage.' : 'The voice this character ships with.',
      voice: null,
      cloned: false,
    },
    ...voices.map(v => ({
      key: v.voiceId,
      label: v.name,
      sub: [v.cloned ? (isFr ? 'Voix clonée' : 'Cloned voice') : null, v.gender, v.accent, v.description]
        .filter(Boolean).join(' · ') || (isFr ? 'Voix ElevenLabs' : 'ElevenLabs voice'),
      voice: { voiceId: v.voiceId, name: v.name, ...(v.cloned ? { cloned: true } : {}) },
      cloned: v.cloned,
    })),
  ];

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-2">
        Voix du personnage
      </p>
      {notice && (
        <p
          role="status"
          className="mb-2 rounded-lg px-3 py-2 text-[11px] leading-snug"
          style={{ background: 'rgba(221,147,252,0.10)', border: '1px solid rgba(221,147,252,0.30)', color: '#e7bafd' }}
        >
          {notice}
        </p>
      )}
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] divide-y divide-[rgba(255,255,255,0.06)]">
        {rows.map(r => {
          const sel = (value?.voiceId ?? null) === (r.voice?.voiceId ?? null);
          const url = r.voice
            ? `/my-dashboard/characters/${characterId}/preview?voiceId=${encodeURIComponent(r.voice.voiceId)}`
            : `/my-dashboard/characters/${characterId}/preview`;
          return (
            <div key={r.key} className="flex items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => onChange(r.voice)}
                aria-pressed={sel}
                className="flex-1 min-w-0 text-left flex items-center gap-2.5"
              >
                <span
                  aria-hidden
                  className="flex-shrink-0 w-4 h-4 rounded-full grid place-items-center transition-colors"
                  style={{
                    border: sel ? '1px solid rgba(122,95,255,0.85)' : '1px solid rgba(255,255,255,0.20)',
                    background: sel ? 'rgba(122,95,255,0.85)' : 'transparent',
                  }}
                >
                  {sel && <Check size={11} color="#0A0A0C" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold truncate" style={{ color: sel ? '#7349fe' : '#F2F2F2' }}>
                    {r.label}
                  </span>
                  <span className="block text-[11px] truncate" style={{ color: sel ? 'rgba(122,95,255,0.85)' : '#8B8BA7' }}>
                    {r.sub}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggle(`v:${r.key}`, url, sampleText)}
                aria-label={isFr ? `Écouter ${r.label}` : `Preview ${r.label}`}
                className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors"
                style={{ background: 'rgba(122,95,255,0.14)', color: '#b9a8ff' }}
              >
                {playing === `v:${r.key}` ? <Square size={13} /> : <Play size={13} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
