import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Mic, Pencil, Play, Square } from '../../icons';
import api from '../../../services/api';
import { previewUrl, type Character } from './CharacterPickerV2';
import { useVoicePreview } from '../../client/useVoicePreview';

/* Carrousel de personnages, registre produit V2 « instrument ». Une seule bulle
   ronde au centre, nom au-dessus, voix en dessous, flèches de part et d'autre.
   La grille (CharacterPickerV2) reste en place dans l'onboarding : elle sert à
   comparer, ce carrousel sert à choisir une fois que le choix est fait.

   Un personnage n'a plus de langue : il parle français et anglais, et l'aperçu
   suit celle du client. L'accent affiché décrit le timbre, rien d'autre. */

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

/** Portrait rond. Chaque personnage du catalogue porte son webp ; la voix
    clonée, elle, n'a pas de visage et prend l'icône micro, qui dit ce qu'elle
    est plutôt que d'emprunter un portrait. La pastille à l'initiale ne sert
    plus que de repli si une image manque. */
function Bubble({ c, big = false }: { c: Character; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  const size = big
    ? 'w-[120px] h-[120px] sm:w-[150px] sm:h-[150px]'
    : 'w-9 h-9';
  const shell = `${size} shrink-0 rounded-full bg-q2-obsidian border border-q2-graphite-d`;

  if (c.id === 'custom') {
    return (
      <span aria-hidden="true" className={`${shell} grid place-items-center`}>
        <Mic size={big ? 34 : 14} className="text-q2-lift" />
      </span>
    );
  }

  if (broken) {
    return (
      <span
        aria-hidden="true"
        className={`${shell} grid place-items-center font-light text-q2-lift ${big ? 'text-[44px]' : 'text-[13px]'}`}
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

function voiceLabel(c: Character, isFr: boolean) {
  const accent = ACCENT_LABEL[c.accent] || c.accent;
  const gender = c.gender === 'f' ? (isFr ? 'Femme' : 'Female') : (isFr ? 'Homme' : 'Male');
  return `${c.name} · ${accent} · ${gender}`;
}

export default function CharacterCarousel({
  characters, value, onChange, isFr = true,
}: {
  characters: Character[];
  value: string;
  onChange: (id: string) => void;
  isFr?: boolean;
}) {
  const reduce = useReducedMotion();
  const { playing, notice, toggle, prefetch, debug } = useVoicePreview(isFr);
  const [dir, setDir] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const index = Math.max(0, characters.findIndex(c => c.id === value));
  const current = characters[index];

  // Le serveur synthétise le catalogue pendant que la page se lit. Les clips
  // sont identiques d'une fois sur l'autre : la seule raison pour laquelle la
  // lecture attendait, c'est que personne ne les avait encore demandés.
  useEffect(() => {
    void api.post('/my-dashboard/characters/warm').catch(() => undefined);
  }, []);

  // Le personnage affiché est celui qu'on écoutera : son clip est téléchargé
  // d'avance, la pression suivante ne coûte plus rien.
  const currentUrl = current ? previewUrl(current.id) : null;
  useEffect(() => {
    if (currentUrl) prefetch(currentUrl);
  }, [currentUrl, prefetch]);

  // Le menu se ferme au clic dehors et à Échap : il recouvre la bulle, le
  // laisser ouvert bloquerait la navigation par flèches.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!characters.length || !current) return null;

  const go = (delta: number) => {
    if (characters.length < 2) return;
    setDir(delta);
    const next = (index + delta + characters.length) % characters.length;
    onChange(characters[next].id);
  };

  const tagline = isFr ? current.taglineFr : current.taglineEn;
  const offset = reduce ? 0 : 44;
  // `custom` sur AnimatePresence : sans lui, l'élément qui sort garde la
  // direction du rendu précédent et repart du mauvais côté.
  const slide = {
    enter: (d: number) => ({ opacity: 0, x: d >= 0 ? offset : -offset }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d >= 0 ? -offset : offset }),
  };

  return (
    <>
      {notice && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-q2-indigo/30 bg-q2-indigo/10 px-3 py-2 text-[11.5px] leading-snug text-q2-lift"
        >
          {notice}
        </p>
      )}

      <div
        role="group"
        aria-roledescription={isFr ? 'carrousel de personnages' : 'character carousel'}
        aria-label={isFr ? 'Personnage de la réceptionniste' : 'Receptionist character'}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        }}
        className="rounded-xl border border-q2-graphite-d bg-q2-obsidian px-3 py-6 sm:px-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
      >
        <span className="sr-only" aria-live="polite">
          {current.name}, {voiceLabel(current, isFr)}. {tagline}
        </span>

        <div className="flex items-center justify-center gap-2 sm:gap-5">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={characters.length < 2}
            aria-label={isFr ? 'Personnage précédent' : 'Previous character'}
            className="w-9 h-9 shrink-0 rounded-full grid place-items-center border border-q2-graphite-d text-q2-mist hover:border-q2-smoke-d hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 disabled:opacity-30"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <div className="flex-1 min-w-0 overflow-hidden">
            <AnimatePresence initial={false} mode="wait" custom={dir}>
              <motion.div
                key={current.id}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-3"
              >
                <p className="text-[16px] font-medium text-white text-center truncate max-w-full">
                  {current.name}
                </p>
                <Bubble c={current} big />
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            disabled={characters.length < 2}
            aria-label={isFr ? 'Personnage suivant' : 'Next character'}
            className="w-9 h-9 shrink-0 rounded-full grid place-items-center border border-q2-graphite-d text-q2-mist hover:border-q2-smoke-d hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 disabled:opacity-30"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Voix courante et bascule vers le catalogue complet */}
        <div ref={menuRef} className="relative mt-4 flex items-center justify-center gap-2">
          <span className="text-[12.5px] text-q2-mist truncate">{voiceLabel(current, isFr)}</span>

          <button
            type="button"
            onClick={() => toggle(current.id, previewUrl(current.id), isFr ? current.previewFr : current.previewEn)}
            aria-label={isFr ? `Écouter ${current.name}` : `Preview ${current.name}`}
            className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-q2-indigo/15 text-q2-lift hover:bg-q2-indigo/25 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
          >
            {playing === current.id
              ? <Square size={12} aria-hidden="true" />
              : <Play size={12} aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            aria-label={isFr ? 'Changer de voix' : 'Change voice'}
            className="w-7 h-7 shrink-0 rounded-full grid place-items-center border border-q2-graphite-d text-q2-fog hover:text-white hover:border-q2-smoke-d transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
          >
            <Pencil size={12} aria-hidden="true" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -4 }}
                transition={{ duration: 0.15 }}
                role="listbox"
                aria-label={isFr ? 'Voix disponibles' : 'Available voices'}
                className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-2 w-[280px] max-h-[264px] overflow-y-auto rounded-xl border border-q2-graphite-d bg-q2-carbon p-1"
              >
                {characters.map(c => {
                  const sel = c.id === current.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${sel ? 'bg-q2-indigo/10' : ''}`}
                    >
                      <Bubble c={c} />
                      <button
                        type="button"
                        role="option"
                        aria-selected={sel}
                        onClick={() => {
                          const target = characters.findIndex(x => x.id === c.id);
                          setDir(target >= index ? 1 : -1);
                          onChange(c.id);
                          setMenuOpen(false);
                        }}
                        className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                      >
                        <p className={`text-[12.5px] font-medium truncate ${sel ? 'text-q2-lift' : 'text-white'}`}>
                          {c.name}
                        </p>
                        <p className="text-[11px] text-q2-fog truncate">
                          {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? 'F' : (isFr ? 'H' : 'M')}
                        </p>
                      </button>
                      {sel && <Check size={13} className="shrink-0 text-q2-lift" aria-hidden="true" />}
                      <button
                        type="button"
                        onClick={() => toggle(c.id, previewUrl(c.id), isFr ? c.previewFr : c.previewEn)}
                        aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
                        className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-q2-indigo/15 text-q2-lift hover:bg-q2-indigo/25 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                      >
                        {playing === c.id
                          ? <Square size={12} aria-hidden="true" />
                          : <Play size={12} aria-hidden="true" />}
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {tagline && (
          <p className="mt-2 text-center text-[11.5px] text-q2-fog q2-body-text">{tagline}</p>
        )}

        {debug && (
          // Seulement après une pression : « aucune erreur, aucun son » n'est
          // autrement pas rapportable par la personne qui tient le téléphone.
          <p className="mt-3 text-center text-[10px] font-mono text-q2-fog">{debug}</p>
        )}

        {/* Repères de position : lire « 3 sur 10 » sans compter les points */}
        {characters.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
            {characters.map((c, i) => (
              <span
                key={c.id}
                className={`h-1 rounded-full transition-colors duration-150 ${
                  i === index ? 'w-4 bg-q2-lift' : 'w-1 bg-q2-graphite-d'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
