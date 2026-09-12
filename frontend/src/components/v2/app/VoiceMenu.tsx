import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Anchored from './Anchored';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Mic, Play, Search, Square } from '../../icons';
import VoiceCloner from '../../client/VoiceCloner';
import api from '../../../services/api';
import type { CatalogVoice, SelectedVoice } from '../../client/VoicePicker';
import { previewUrl } from '../../client/CharacterPicker';
import type { Character } from './CharacterPickerV2';

/**
 * Le menu de voix, en verre, ouvert par le crayon du carrousel.
 *
 * Il réunit deux sources que l'ancienne page séparait en deux composants
 * empilés (`CharacterPicker` puis `VoicePicker`), ce qui obligeait à choisir un
 * personnage avant même de savoir quelles voix existaient:
 *
 *   - les PERSONNAGES du catalogue, qui ont un visage, un nom et un caractère;
 *   - les VOIX du catalogue, servies à chaud par /my-dashboard/voices: les
 *     voix Cartesia dans la langue de l'agent, et les clones du client.
 *
 * Choisir un personnage change le personnage. Choisir une voix ne change que
 * le timbre et garde le personnage: c'est la distinction que le produit tient
 * partout ailleurs, elle ne se perd pas ici.
 *
 * Recherche et filtres travaillent sur les deux listes à la fois: avec une
 * dizaine de personnages et parfois cent voix sur le compte, faire défiler
 * n'est pas une façon de choisir.
 */

export type VoiceFilter = 'all' | 'f' | 'm' | 'cloned';

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
  /** L'élément sous lequel le menu se pose; il est rendu hors de la carte. */
  anchor: RefObject<HTMLElement | null>;
}

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

/** Normalise pour la recherche: sans accents, sans casse. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function genderOf(v: CatalogVoice): 'f' | 'm' | null {
  const g = (v.gender || '').toLowerCase();
  if (g.startsWith('f')) return 'f';
  if (g.startsWith('m')) return 'm';
  return null;
}

/**
 * Les voix du catalogue que le menu montre.
 *
 * ── Ce que la règle d'avant cachait, et pourquoi elle existait ─────────────
 *
 * Le menu ne montrait que les voix CLONÉES, pour une raison qui tenait au
 * catalogue ElevenLabs: le compte porte des dizaines de voix de bibliothèque
 * anglaises (« Skylar · Approachable American female »), servies sans filtre
 * de langue, et en proposer une donnait une réceptionniste française avec un
 * accent américain. Ne montrer que les clones était la bonne réponse à CE
 * catalogue-là.
 *
 * Le catalogue Cartesia n'a pas ce défaut: le serveur le filtre sur la langue
 * de l'agent, et il rend 69 voix françaises. La règle « clones seulement »
 * les cachait toutes — le client voyait la liste des personnages, croyait
 * qu'aucune voix n'avait été ajoutée, et il avait raison de le croire.
 *
 * D'où la règle exacte, et pas plus large: une voix est montrée si elle est
 * CLONÉE (elle est au client) ou si elle vient de CARTESIA (elle est dans sa
 * langue). Une voix de bibliothèque ElevenLabs reste cachée, pour la raison
 * d'origine qui n'a pas changé.
 *
 * Les clones ont leur onglet (« Clonées »), avec le bouton qui en crée un:
 * ils n'ont pas de genre, et ce sont les seules voix qui appartiennent au
 * client. Sous « Femmes » et « Hommes » on ne voit que le catalogue.
 */
export function visibleVoices(
  voices: CatalogVoice[],
  filter: VoiceFilter,
  query: string,
): CatalogVoice[] {
  const q = fold(query.trim());
  return voices.filter(v => {
    if (!v.cloned && v.provider !== 'cartesia') return false;
    if (filter === 'cloned' && !v.cloned) return false;
    if ((filter === 'f' || filter === 'm') && (v.cloned || genderOf(v) !== filter)) return false;
    if (!q) return true;
    return fold(`${v.name} ${v.accent || ''} ${v.description || ''}`).includes(q);
  });
}

export default function VoiceMenu({
  characters, characterId, onCharacter,
  override, onOverride,
  playing, onToggle, previewUrlFor,
  isFr, anchor,
}: VoiceMenuProps) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VoiceFilter>('all');
  /* Le clonage s'ouvre DANS le menu, sous « Clonées », par son bouton. */
  const [cloning, setCloning] = useState(false);
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
      if (filter === 'cloned') return false;
      if (filter !== 'all' && c.gender !== filter) return false;
      if (!q) return true;
      return fold(`${c.name} ${c.accent} ${(isFr ? c.taglineFr : c.taglineEn) || ''}`).includes(q);
    }),
    [characters, filter, q, isFr],
  );

  const shownVoices = useMemo(() => visibleVoices(voices ?? [], filter, query), [voices, filter, query]);

  /* La phrase du personnage courant: c'est elle que chaque voix du catalogue
     dit à l'écoute, pour auditionner ce que l'appelant entendra et non une
     démonstration choisie par le fournisseur. */
  const current = characters.find(c => c.id === characterId);
  const sampleText = (isFr ? current?.previewFr : current?.previewEn) || '';

  const empty = !shownCharacters.length && !shownVoices.length && filter !== 'cloned';

  return (
    /* Le placement est sur `Anchored`, l'animation sur son enfant: framer
       écrit un `transform` inline pour animer `y`, qui écraserait tout
       centrage porté par le conteneur. Et le conteneur vit HORS de la carte:
       posé dedans en `absolute`, le menu était coupé par son bord ou lui
       donnait un ascenseur à chaque ouverture. */
    <Anchored anchor={anchor} maxWidth={340}>
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduce ? 0 : -6 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-label={isFr ? 'Choisir une voix' : 'Choose a voice'}
        /* La matière des cartes, opaque (`q2-obsidian`, bord `q2-graphite-d`),
           et plus du verre: le flou est proscrit hors de la barre de
           navigation, et un menu de la couleur de sa carte se lit comme une
           partie de la fiche, pas comme un objet étranger posé dessus. */
        className="rounded-2xl border border-q2-graphite-d bg-q2-obsidian shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)] overflow-hidden"
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
              className="flex-1 min-w-0 bg-transparent py-1 text-[16px] sm:text-[13px] text-white placeholder:text-q2-fog focus:outline-none"
            />
          </div>

          {/* Filtres */}
          <div className="mt-1.5 flex items-center gap-1">
            {([
              ['all', isFr ? 'Toutes' : 'All'],
              ['f', isFr ? 'Femmes' : 'Female'],
              ['m', isFr ? 'Hommes' : 'Male'],
              ['cloned', isFr ? 'Clonées' : 'Cloned'],
            ] as [VoiceFilter, string][]).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                aria-pressed={filter === v}
                className={`rounded-full px-3 py-1.5 text-[12px] transition-colors duration-150 ${
                  filter === v ? 'bg-q2-indigo/25 text-white' : 'text-q2-fog hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[min(58vh,340px)] overflow-y-auto overscroll-contain px-1.5 pb-1.5">
          {/* Personnages */}
          {shownCharacters.length > 0 && (
            <>
              <p className="px-1.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-q2-fog">
                {isFr ? 'Personnages' : 'Characters'}
              </p>
              {shownCharacters.map(c => {
                const sel = c.id === characterId && !override;
                return (
                  <div key={c.id} className={`flex items-center gap-2 rounded-xl px-1.5 py-2 ${sel ? 'bg-white/[0.06]' : ''}`}>
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
                      className="w-9 h-9 shrink-0 rounded-full grid place-items-center bg-q2-indigo/20 text-q2-lift hover:bg-q2-indigo/30 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                    >
                      {playing === c.id ? <Square size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* La voix du client, s'il en a enregistré une. Pas de titre quand il
              n'y a rien dessous: une section vide fait chercher ce qui manque. */}
          {(shownVoices.length > 0 || (voices === null && !failed)) && (
            <p className="px-1.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-q2-fog">
              {filter === 'cloned' ? (isFr ? 'Vos voix clonées' : 'Your cloned voices') : (isFr ? 'Voix' : 'Voices')}
            </p>
          )}

          {voices === null && !failed && (
            <p className="flex items-center gap-2 px-1.5 py-2 text-[11.5px] text-q2-fog">
              <Loader2 size={12} aria-hidden="true" />
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
              <div key={v.voiceId} className={`flex items-center gap-2 rounded-xl px-1.5 py-2 ${sel ? 'bg-white/[0.06]' : ''}`}>
                <button
                  type="button"
                  aria-pressed={sel}
                  /* Une voix ne remplace QUE le timbre: le personnage, son visage
                     et son ton restent ceux qui sont choisis dans le carrousel. */
                  /* `provider` voyage avec le choix: un identifiant Cartesia ne
                     désigne rien chez ElevenLabs, et sans ce champ le serveur
                     le chercherait dans le mauvais catalogue. */
                  onClick={() => onOverride({
                    voiceId: v.voiceId,
                    name: v.name,
                    ...(v.cloned ? { cloned: true } : {}),
                    ...(v.provider ? { provider: v.provider } : {}),
                  })}
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
                  /* Deux façons d'écouter. Un clone ElevenLabs porte un extrait
                     tout fait, qui est déjà un enregistrement. Une voix Cartesia
                     n'en a pas: notre route synthétise la phrase du personnage
                     avec elle, ce qui est mieux — on entend ce que l'appelant
                     entendra, pas une démonstration du fournisseur. Le bouton
                     n'est plus désactivé faute d'extrait: c'est ce qui rendait
                     toute voix Cartesia muette dans ce menu. */
                  onClick={() => (v.previewUrl
                    ? onToggle(`voice:${v.voiceId}`, v.previewUrl, '')
                    : onToggle(`voice:${v.voiceId}`, previewUrl(characterId, v), sampleText))}
                  aria-label={isFr ? `Écouter ${v.name}` : `Preview ${v.name}`}
                  className="w-9 h-9 shrink-0 rounded-full grid place-items-center bg-q2-indigo/20 text-q2-lift hover:bg-q2-indigo/30 transition-colors duration-150 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  {playing === `voice:${v.voiceId}` ? <Square size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                </button>
              </div>
            );
          })}

          {empty && voices !== null && (
            <p className="px-1.5 py-3 text-center text-[11.5px] text-q2-fog">
              {isFr ? 'Rien ne correspond.' : 'Nothing matches.'}
            </p>
          )}

          {/* Le clonage vit ICI, sous son onglet (demande utilisateur): c'est
              une voix de plus parmi les autres, pas une cérémonie à part sous
              la fiche. Le bouton ouvre l'enregistreur sur place; la révélation
              ne bouge que `opacity` et `transform`, jamais la hauteur. */}
          {filter === 'cloned' && voices !== null && !failed && (
            <div className="px-1.5 pb-1">
              {!cloning && !override?.cloned && (
                <button
                  type="button"
                  onClick={() => setCloning(true)}
                  className="mt-1.5 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-q2-graphite-d px-3 py-2.5 text-[12.5px] font-medium text-q2-mist transition-colors duration-150 hover:border-q2-smoke-d hover:text-white active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  <Mic size={13} aria-hidden="true" />
                  {isFr ? 'Créer ma voix' : 'Create my voice'}
                </button>
              )}
              <AnimatePresence initial={false}>
                {(cloning || override?.cloned) && (
                  <motion.div
                    key="cloner"
                    initial={{ opacity: 0, y: reduce ? 0 : -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <VoiceCloner
                      voice={override?.cloned ? { voiceId: override.voiceId, name: override.name, cloned: true } : null}
                      isFr={isFr}
                      /* Un clone est choisi dès qu'il existe; le supprimer rend
                         la voix du personnage. Le personnage, lui, ne bouge pas. */
                      onChange={v => { setCloning(false); onOverride(v ? { ...v, cloned: true } : null); }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Retour à la voix du personnage, visible seulement quand il y a de quoi revenir */}
        {override && (
          <button
            type="button"
            onClick={() => onOverride(null)}
            className="w-full border-t border-white/10 px-3 py-3 text-left text-[12.5px] text-q2-fog hover:text-white transition-colors duration-150"
          >
            {isFr ? 'Revenir à la voix du personnage' : 'Back to the character’s own voice'}
          </button>
        )}
      </motion.div>
    </Anchored>
  );
}
