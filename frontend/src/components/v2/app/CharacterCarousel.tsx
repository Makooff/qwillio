import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Mic, Pencil, Play, Square } from '../../icons';
import api from '../../../services/api';
import { previewUrl, type Character } from './CharacterPickerV2';
import { useVoicePreview } from '../../client/useVoicePreview';
import VoiceMenu from './VoiceMenu';
import VoiceBars from './VoiceBars';
import type { SelectedVoice } from '../../client/VoicePicker';

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
  characters, value, onChange, isFr = true, override = null, onOverride,
  agentName, onAgentName,
  toneId, onTone, tones = [],
  children,
  previewUrlFor,
  warmEndpoint = '/my-dashboard/characters/warm',
}: {
  characters: Character[];
  value: string;
  onChange: (id: string) => void;
  isFr?: boolean;
  /* Voix qui remplace celle du personnage. Le personnage garde son visage et
     son ton: seul le timbre change. */
  override?: SelectedVoice | null;
  onOverride?: (v: SelectedVoice | null) => void;
  /* Le prénom sous lequel l'agent se présente. Optionnel: la grille
     d'onboarding monte ce carrousel sans agent nommé, et affiche alors le nom
     du personnage, comme avant. */
  agentName?: string;
  onAgentName?: (v: string) => void;
  /**
   * Le ton retenu, et la liste où le choisir.
   *
   * Optionnels: la grille d'onboarding monte le même carrousel sans réglage de
   * ton. Sans eux, la ligne sous le visage reste l'accroche du personnage,
   * comme avant.
   */
  toneId?: string;
  onTone?: (v: string) => void;
  tones?: { v: string; l: string; d: string }[];
  /** Posé dans la fiche, sous les repères de position. */
  children?: ReactNode;
  /**
   * D'où viennent les clips. Par défaut la route du tableau de bord, qui est
   * derrière un JWT. La page d'essai publique passe la route publique: sans
   * cette bascule, chaque aperçu y répondait 401 et AUCUNE voix ne sortait,
   * alors que le carrousel s'affichait normalement.
   */
  previewUrlFor?: (id: string) => string;
  /** Préchauffage serveur du catalogue. `null` quand la route n'est pas ouverte. */
  warmEndpoint?: string | null;
}) {
  /* Par défaut, l'aperçu porte la voix de remplacement. C'est la seule façon
     que la fiche joue ce que l'appelant entendra: sans elle, on auditionne le
     catalogue et l'agent parle avec autre chose. La page d'essai publique
     passe sa propre fonction, elle n'a pas de voix de remplacement. */
  const previewFor = previewUrlFor ?? ((id: string) => previewUrl(id, override));

  const reduce = useReducedMotion();
  const { playing, notice, line, toggle, prefetch } = useVoicePreview(isFr);
  const [dir, setDir] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const toneRef = useRef<HTMLDivElement | null>(null);

  /* Renommage sur place. Le brouillon est local et n'est remonté qu'à la
     validation: le parent enregistre tout seul 900 ms après le dernier
     changement, et lui envoyer chaque frappe ferait resynchroniser l'assistant
     Vapi une fois par lettre. Échap rend la valeur d'origine. */
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const canRename = typeof onAgentName === 'function';

  useEffect(() => {
    if (renaming) nameInputRef.current?.select();
  }, [renaming]);

  const startRename = () => { setDraftName(agentName ?? ''); setRenaming(true); };
  const commitRename = () => {
    const next = draftName.trim();
    setRenaming(false);
    // Un nom vide n'est pas un effacement, c'est un abandon: l'agent doit bien
    // se présenter sous un prénom.
    if (next && next !== agentName) onAgentName?.(next);
  };

  const index = Math.max(0, characters.findIndex(c => c.id === value));
  const current = characters[index];

  // Le serveur synthétise le catalogue pendant que la page se lit. Les clips
  // sont identiques d'une fois sur l'autre : la seule raison pour laquelle la
  // lecture attendait, c'est que personne ne les avait encore demandés.
  useEffect(() => {
    if (!warmEndpoint) return;
    void api.post(warmEndpoint).catch(() => undefined);
  }, [warmEndpoint]);

  // Le personnage affiché est celui qu'on écoutera : son clip est téléchargé
  // d'avance, la pression suivante ne coûte plus rien.
  const currentUrl = current ? previewFor(current.id) : null;
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

  /* Même sort pour la liste des tons: elle recouvre les repères de position,
     et la laisser ouverte garderait la fiche à moitié masquée. */
  useEffect(() => {
    if (!toneOpen) return;
    const onDown = (e: MouseEvent) => {
      if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setToneOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [toneOpen]);

  if (!characters.length || !current) return null;

  const go = (delta: number) => {
    if (characters.length < 2) return;
    setDir(delta);
    const next = (index + delta + characters.length) % characters.length;
    onChange(characters[next].id);
  };

  const tagline = isFr ? current.taglineFr : current.taglineEn;
  const tone = tones.find(t => t.v === toneId) ?? null;
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

        {/* Le nom vit AU-DESSUS du bloc animé, et non dedans comme le nom de
            personnage qu'il remplace: c'est le nom de l'agent, pas celui du
            visage, et le laisser dans l'animation le ferait remonter à chaque
            flèche, en fermant le champ au milieu d'une saisie. */}
        {canRename && (
          <div className="mb-4 flex items-center justify-center gap-2">
            {renaming ? (
              <input
                ref={nameInputRef}
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  if (e.key === 'Escape') { e.preventDefault(); setRenaming(false); }
                }}
                aria-label={isFr ? "Nom de l'agent" : 'Agent name'}
                maxLength={40}
                className="w-[180px] rounded-lg border border-q2-indigo/50 bg-q2-void px-3 py-1 text-center text-[16px] font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              />
            ) : (
              <>
                <p className="text-[16px] font-medium text-white truncate max-w-[220px]">
                  {agentName || current.name}
                </p>
                <button
                  type="button"
                  onClick={startRename}
                  aria-label={isFr ? "Renommer l'agent" : 'Rename the agent'}
                  className="w-7 h-7 shrink-0 rounded-full grid place-items-center border border-q2-graphite-d text-q2-fog hover:text-white hover:border-q2-smoke-d transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  <Pencil size={12} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}

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
                {/* Sans agent nommé, la place du nom revient au personnage,
                    comme avant. Avec, il est déjà écrit au-dessus, et le
                    répéter dirait deux fois la même chose. */}
                {!canRename && (
                  <p className="text-[16px] font-medium text-white text-center truncate max-w-full">
                    {current.name}
                  </p>
                )}
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

        {/* Le diagramme réactif à l'audio, demandé par l'utilisateur: il est
            branché sur l'analyseur du lecteur, donc il suit la voix et non un
            simple état « ça joue ». */}
        <VoiceBars active={playing === current.id} className="mt-4" />

        {/* Voix courante et bascule vers le catalogue complet */}
        <div ref={menuRef} className="relative mt-4 flex items-center justify-center gap-2">
          <span className="text-[12.5px] text-q2-mist truncate">
            {override ? `${current.name} · ${override.name}` : voiceLabel(current, isFr)}
          </span>

          <button
            type="button"
            onClick={() => toggle(current.id, previewFor(current.id), (isFr ? current.previewFr : current.previewEn) || undefined)}
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
              <VoiceMenu
                characters={characters}
                characterId={current.id}
                onCharacter={id => {
                  const target = characters.findIndex(x => x.id === id);
                  setDir(target >= index ? 1 : -1);
                  onChange(id);
                  setMenuOpen(false);
                }}
                override={override}
                onOverride={v => { onOverride?.(v); setMenuOpen(false); }}
                playing={playing}
                onToggle={toggle}
                previewUrlFor={previewFor}
                isFr={isFr}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Pendant la lecture, la phrase enregistrée remplace la accroche: on
            lit exactement ce que la voix est en train de dire. */}
        {playing === current.id && line ? (
          <p className="mt-2 text-center text-[11.5px] italic text-q2-mist q2-body-text">« {line} »</p>
        ) : tone ? (
          /* Le TON se choisit ici, sous le visage (demande utilisateur).
             Il occupait une section à part, plus bas, alors qu'il est déjà
             décrit sous le personnage: on lisait le ton à un endroit et on le
             changeait à un autre. Le chevron ouvre la liste, et la phrase
             affichée est la description du ton retenu, pas l'accroche du
             personnage: ce qu'on lit est ce qui est réglé. */
          <div ref={toneRef} className="relative mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setToneOpen(o => !o)}
              aria-expanded={toneOpen}
              aria-haspopup="listbox"
              aria-label={isFr ? 'Changer le ton' : 'Change the tone'}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] text-q2-fog hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
            >
              <span className="truncate q2-body-text">{tone.d}</span>
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={`shrink-0 transition-transform duration-200 ${toneOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {toneOpen && (
                /* Même partage que le menu des voix: le placement sur la boîte
                   extérieure, l'animation sur l'intérieure. Framer écrit un
                   `transform` inline pour animer `y`, qui effacerait le
                   centrage porté par une classe. */
                <div className="absolute top-full left-1/2 -translate-x-1/2 z-30 mt-1.5 w-[min(260px,calc(100vw-2rem))]">
                  <motion.ul
                    role="listbox"
                    aria-label={isFr ? 'Ton' : 'Tone'}
                    initial={{ opacity: 0, y: reduce ? 0 : -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden rounded-2xl border border-white/10 p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)]"
                    style={{
                      background: 'rgba(18, 19, 22, 0.62)',
                      backdropFilter: 'blur(22px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(22px) saturate(160%)',
                    }}
                  >
                    {tones.map(t => (
                      <li key={t.v}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={t.v === tone.v}
                          onClick={() => { onTone?.(t.v); setToneOpen(false); }}
                          className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 ${
                            t.v === tone.v ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-medium text-white">{t.l}</span>
                            <span className="block text-[11px] leading-snug text-q2-fog q2-body-text">{t.d}</span>
                          </span>
                          {t.v === tone.v && <Check size={13} className="mt-0.5 shrink-0 text-q2-lift" aria-hidden="true" />}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : tagline ? (
          <p className="mt-2 text-center text-[11.5px] text-q2-fog q2-body-text">{tagline}</p>
        ) : null}

        {/* La ligne de diagnostic (« 49 ko · lecteur audio · 0,7 s ») était un
            outil de mise au point, pas de l'interface: elle s'affichait à tous
            les clients après chaque écoute. Retirée (retour utilisateur). Le
            `notice` au-dessus suffit à dire qu'un aperçu a échoué. */}

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

        {/* Ce que le parent veut poser DANS la fiche, sous le personnage: la
            personnalisation y est descendue (demande utilisateur), parce
            qu'elle décrit la même chose que le ton et le visage juste
            au-dessus, et non un réglage séparé de la page. */}
        {children && <div className="mt-5 border-t border-q2-graphite-d pt-4">{children}</div>}
      </div>
    </>
  );
}
