import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Play, Search, Square } from '../../icons';
import api from '../../../services/api';
import type { CatalogVoice, SelectedVoice } from '../../client/VoicePicker';
import type { Character } from './CharacterPickerV2';

/**
 * Le menu de voix, en verre, ouvert par le crayon du carrousel.
 *
 * Il réunit deux sources que l'ancienne page séparait en deux composants
 * empilés (`CharacterPicker` puis `VoicePicker`), ce qui obligeait à choisir un
 * personnage avant même de savoir quelles voix existaient:
 *
 *   - les PERSONNAGES du catalogue, qui ont un visage, un nom et un caractère;
 *   - les VOIX du compte ElevenLabs, servies à chaud par /my-dashboard/voices,
 *     donc toujours à jour, clones compris.
 *
 * Choisir un personnage change le personnage. Choisir une voix ne change que
 * le timbre et garde le personnage: c'est la distinction que le produit tient
 * partout ailleurs, elle ne se perd pas ici.
 *
 * Recherche et filtres travaillent sur les deux listes à la fois: avec une
 * dizaine de personnages et parfois cent voix sur le compte, faire défiler
 * n'est pas une façon de choisir.
 */

type GenderFilter = 'all' | 'f' | 'm';

export interface VoiceMenuProps {
  characters: Character[];
  characterId: string;
  onCharacter: (id: string) => void;
  /** Voix qui remplace celle du personnage, ou null pour la sienne. */
  override: SelectedVoice | null;
  onOverride: (v: SelectedVoice | null) => void;
  /** Lecture d'un extrait: le carrousel possède déjà le lecteur, on s'y branche. */
  playing: string | null;
  onToggle: (key: string, url: string, text: string) => void;
  previewUrlFor: (characterId: string) => string;
  isFr: boolean;
}

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

/** Normalise pour la recherche: sans accents, sans casse. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function genderOf(v: CatalogVoice): 'f' | 'm' | null {
  const g = (v.gender || '').toLowerCase();
  if (g.startsWith('f')) return 'f';
  if (g.startsWith('m')) return 'm';
  return null;
}

export default function VoiceMenu({
  characters, characterId, onCharacter,
  override, onOverride,
  playing, onToggle, previewUrlFor,
  isFr,
}: VoiceMenuProps) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<GenderFilter>('all');
  const [clonedOnly, setClonedOnly] = useState(false);
  const [voices, setVoices] = useState<CatalogVoice[] | null>(null);
  const [failed, setFailed] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  /* Le catalogue ElevenLabs est chargé à l'ouverture, pas au montage de la
     page: personne ne paie l'appel s'il ne demande jamais à changer de voix. */
  useEffect(() => {
    let alive = true;
    api.get('/my-dashboard/voices')
      .then(({ data }) => { if (alive) setVoices(Array.isArray(data?.voices) ? data.voices : []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  /* Le champ prend le focus à l'ouverture: le menu s'ouvre pour chercher. */
  useEffect(() => { searchRef.current?.focus(); }, []);

  const q = fold(query.trim());

  const shownCharacters = useMemo(
    () => characters.filter(c => {
      if (clonedOnly) return false;
      if (gender !== 'all' && c.gender !== gender) return false;
      if (!q) return true;
      return fold(`${c.name} ${c.accent} ${(isFr ? c.taglineFr : c.taglineEn) || ''}`).includes(q);
    }),
    [characters, clonedOnly, gender, q, isFr],
  );

  const shownVoices = useMemo(
    () => (voices ?? []).filter(v => {
      if (clonedOnly && !v.cloned) return false;
      if (gender !== 'all' && genderOf(v) !== gender) return false;
      if (!q) return true;
      return fold(`${v.name} ${v.accent || ''} ${v.description || ''}`).includes(q);
    }),
    [voices, clonedOnly, gender, q],
  );

  const empty = !shownCharacters.length && !shownVoices.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -6 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-label={isFr ? 'Choisir une voix' : 'Choose a voice'}
      /* Verre: le flou est ce qui distingue un menu posé AU-DESSUS de la page
         d'un panneau qui en fait partie. Teinte très basse, la matière vient
         du flou et de la saturation, pas de la couleur. */
      className="absolute top-full left-1/2 -translate-x-1/2 z-30 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)] overflow-hidden"
      style={{
        background: 'rgba(18, 19, 22, 0.62)',
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
      }}
    >
      {/* Recherche */}
      <div className="p-2 pb-1.5">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5">
          <Search size={13} className="shrink-0 text-q2-fog" aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isFr ? 'Chercher une voix' : 'Search a voice'}
            aria-label={isFr ? 'Chercher une voix' : 'Search a voice'}
            className="flex-1 min-w-0 bg-transparent text-[12.5px] text-white placeholder:text-q2-fog focus:outline-none"
          />
        </div>

        {/* Filtres */}
        <div className="mt-1.5 flex items-center gap-1">
          {([
            ['all', isFr ? 'Toutes' : 'All'],
            ['f', isFr ? 'Femmes' : 'Female'],
            ['m', isFr ? 'Hommes' : 'Male'],
          ] as [GenderFilter, string][]).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setGender(v)}
              aria-pressed={gender === v}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors duration-150 ${
                gender === v ? 'bg-q2-indigo/25 text-white' : 'text-q2-fog hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setClonedOnly(o => !o)}
            aria-pressed={clonedOnly}
            className={`ml-auto rounded-full px-2.5 py-1 text-[11px] transition-colors duration-150 ${
              clonedOnly ? 'bg-q2-indigo/25 text-white' : 'text-q2-fog hover:text-white'
            }`}
          >
            {isFr ? 'Clonées' : 'Cloned'}
          </button>
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto px-1.5 pb-1.5">
        {/* Personnages */}
        {shownCharacters.length > 0 && (
          <>
            <p className="px-1.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-q2-fog">
              {isFr ? 'Personnages' : 'Characters'}
            </p>
            {shownCharacters.map(c => {
              const sel = c.id === characterId && !override;
              return (
                <div key={c.id} className={`flex items-center gap-2 rounded-xl px-1.5 py-1.5 ${sel ? 'bg-white/[0.06]' : ''}`}>
                  <button
                    type="button"
                    aria-pressed={sel}
                    onClick={() => { onCharacter(c.id); onOverride(null); }}
                    className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                  >
                    <p className="text-[12.5px] font-medium text-white truncate">{c.name}</p>
                    <p className="text-[11px] text-q2-fog truncate">
                      {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? 'F' : (isFr ? 'H' : 'M')}
                    </p>
                  </button>
                  {sel && <Check size={13} className="shrink-0 text-q2-lift" aria-hidden="true" />}
                  <button
                    type="button"
                        onClick={() => onToggle(c.id, previewUrlFor(c.id), (isFr ? c.previewFr : c.previewEn) || '')}
                    aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
                    className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-q2-indigo/20 text-q2-lift hover:bg-q2-indigo/30 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                  >
                    {playing === c.id ? <Square size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* Voix du compte */}
        <p className="px-1.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-q2-fog">
          {isFr ? 'Voix du compte' : 'Account voices'}
        </p>

        {voices === null && !failed && (
          <p className="flex items-center gap-2 px-1.5 py-2 text-[11.5px] text-q2-fog">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            {isFr ? 'Chargement des voix' : 'Loading voices'}
          </p>
        )}

        {failed && (
          <p className="px-1.5 py-2 text-[11.5px] text-q2-fog">
            {isFr
              ? 'Voix indisponibles pour le moment. Les personnages restent utilisables.'
              : 'Voices unavailable right now. Characters still work.'}
          </p>
        )}

        {voices !== null && !failed && shownVoices.map(v => {
          const sel = override?.voiceId === v.voiceId;
          return (
            <div key={v.voiceId} className={`flex items-center gap-2 rounded-xl px-1.5 py-1.5 ${sel ? 'bg-white/[0.06]' : ''}`}>
              <button
                type="button"
                aria-pressed={sel}
                /* Une voix ne remplace QUE le timbre: le personnage, son visage
                   et son ton restent ceux qui sont choisis dans le carrousel. */
                onClick={() => onOverride({ voiceId: v.voiceId, name: v.name, cloned: v.cloned })}
                className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                <p className="text-[12.5px] font-medium text-white truncate">
                  {v.name}
                  {v.cloned && (
                    <span className="ml-1.5 rounded-full bg-q2-indigo/25 px-1.5 py-0.5 text-[9.5px] align-middle text-q2-lift">
                      {isFr ? 'clonée' : 'cloned'}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-q2-fog truncate">
                  {[v.accent, v.description].filter(Boolean).join(' · ') || (isFr ? 'Sans description' : 'No description')}
                </p>
              </button>
              {sel && <Check size={13} className="shrink-0 text-q2-lift" aria-hidden="true" />}
              <button
                type="button"
                /* Une voix du compte n'a pas de texte d'exemple à nous: son
                   extrait ElevenLabs est déjà un enregistrement. */
                onClick={() => onToggle(`voice:${v.voiceId}`, v.previewUrl ?? '', '')}
                disabled={!v.previewUrl}
                aria-label={isFr ? `Écouter ${v.name}` : `Preview ${v.name}`}
                className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-q2-indigo/20 text-q2-lift hover:bg-q2-indigo/30 transition-colors duration-150 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                {playing === `voice:${v.voiceId}` ? <Square size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
              </button>
            </div>
          );
        })}

        {empty && voices !== null && (
          <p className="px-1.5 py-3 text-center text-[11.5px] text-q2-fog">
            {isFr ? 'Rien ne correspond.' : 'Nothing matches.'}
          </p>
        )}
      </div>

      {/* Retour à la voix du personnage, visible seulement quand il y a de quoi revenir */}
      {override && (
        <button
          type="button"
          onClick={() => onOverride(null)}
          className="w-full border-t border-white/10 px-3 py-2 text-left text-[11.5px] text-q2-fog hover:text-white transition-colors duration-150"
        >
          {isFr ? 'Revenir à la voix du personnage' : 'Back to the character’s own voice'}
        </button>
      )}
    </motion.div>
  );
}
