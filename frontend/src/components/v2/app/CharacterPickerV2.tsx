import { useEffect, useState } from 'react';
import { Play, Square, Mic } from 'lucide-react';
import api from '../../../services/api';
import { useVoicePreview } from '../../client/useVoicePreview';

/* Grille de personnages, registre produit V2. Le contrat vient du catalogue
   serveur (voice-characters.ts) : un personnage n'a plus de langue, il parle
   français et anglais, et l'aperçu suit la langue du client. L'accent reste une
   information sur le timbre, jamais une barrière. */

export interface Character {
  id: string;
  name: string;
  /** Servi depuis /characters/<id>.webp. */
  avatar?: string;
  /** Accent porté par la voix, pas une restriction sur qui peut la choisir. */
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
 * Le clip joue ce que cette carte donnera vraiment à entendre. Exporté parce
 * que l'URL est aussi la clé de cache : le préchargement et la lecture doivent
 * tomber exactement sur la même.
 */
export function previewUrl(characterId: string): string {
  return `/my-dashboard/characters/${characterId}/preview`;
}

/**
 * Portrait rond 48px. Chaque personnage du catalogue porte son webp ; la voix
 * clonée, elle, n'a pas de visage et prend l'icône micro, qui dit ce qu'elle
 * est plutôt que d'emprunter un portrait. La pastille à l'initiale ne sert plus
 * que de repli si une image manque.
 */
function CharacterAvatar({ c }: { c: Character }) {
  const [broken, setBroken] = useState(false);
  const shell = 'w-12 h-12 shrink-0 rounded-full bg-q2-obsidian border border-q2-graphite-d';

  if (c.id === 'custom') {
    return (
      <span aria-hidden="true" className={`${shell} grid place-items-center`}>
        <Mic size={16} className="text-q2-lift" />
      </span>
    );
  }

  if (broken) {
    return (
      <span
        aria-hidden="true"
        className={`${shell} grid place-items-center text-[15px] font-medium text-q2-lift`}
      >
        {c.name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={c.avatar || `/characters/${c.id}.webp`}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className={`${shell} object-cover`}
    />
  );
}

export default function CharacterPickerV2({
  characters, value, onChange, isFr = true,
}: {
  characters: Character[];
  value: string;
  onChange: (id: string) => void;
  isFr?: boolean;
}) {
  const { playing, notice, toggle, prefetch, debug } = useVoicePreview(isFr);

  // Le serveur synthétise le catalogue pendant que la page se lit. Les clips
  // sont identiques d'une fois sur l'autre : la seule raison pour laquelle la
  // lecture attendait, c'est que personne ne les avait encore demandés.
  useEffect(() => {
    void api.post('/my-dashboard/characters/warm').catch(() => undefined);
  }, []);

  // La carte sélectionnée est celle qu'on écoutera en premier : son clip est
  // téléchargé d'avance et gardé en mémoire.
  const selectedUrl = value && characters.some(c => c.id === value) ? previewUrl(value) : null;
  useEffect(() => {
    if (selectedUrl) prefetch(selectedUrl);
  }, [selectedUrl, prefetch]);

  return (
    <>
      {notice && (
        <p
          role="status"
          className="mb-2 rounded-lg border border-q2-indigo/30 bg-q2-indigo/10 px-3 py-2 text-[11.5px] leading-snug text-q2-lift"
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
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors duration-150 ${
                sel
                  ? 'bg-q2-indigo/10 border-q2-indigo/55'
                  : 'bg-q2-obsidian border-q2-graphite-d'
              }`}
            >
              <CharacterAvatar c={c} />
              <button
                type="button"
                onClick={() => onChange(c.id)}
                aria-pressed={sel}
                className="flex-1 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                <div className="flex items-center gap-2">
                  <p className={`text-[13px] font-medium truncate ${sel ? 'text-q2-lift' : 'text-white'}`}>{c.name}</p>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-q2-graphite-d text-q2-fog">
                    {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? 'F' : (isFr ? 'H' : 'M')}
                  </span>
                </div>
                <p className={`text-[11.5px] mt-0.5 ${sel ? 'text-q2-mist' : 'text-q2-fog'}`}>{tagline}</p>
              </button>
              <button
                type="button"
                onClick={() => toggle(c.id, previewUrl(c.id), isFr ? c.previewFr : c.previewEn)}
                aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
                className="shrink-0 w-8 h-8 rounded-full grid place-items-center bg-q2-indigo/15 text-q2-lift hover:bg-q2-indigo/25 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                {playing === c.id
                  ? <Square size={13} aria-hidden="true" />
                  : <Play size={13} aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
      {debug && (
        // Seulement après une pression : « aucune erreur, aucun son » n'est
        // autrement pas rapportable par la personne qui tient le téléphone.
        <p className="mt-2 text-[10px] font-mono text-q2-fog">{debug}</p>
      )}
    </>
  );
}
