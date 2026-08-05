import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import { ChevronLeft, ChevronRight, Mic, Play, Square } from 'lucide-react';
import { prefersReducedMotion } from './motion/reducedMotion';
import { useVoicePreview } from '../client/useVoicePreview';

/* Sélection des réceptionnistes, portée du Circular Carousel de nexus-ui
   (DA/references/21st/circular-carousel/source.tsx, collé par l'utilisateur) :
   arc elliptique x = sin(a)*rx / y = -cos(a)*ry, AnimatePresence popLayout,
   transition 0.65 s cubic-bezier(0.22, 1, 0.36, 1), autoplay pausé au survol
   et au focus, flèches clavier sur le conteneur, chevrons whileHover 1.08 /
   whileTap 0.95, points indicateurs (l'actif s'étire en pilule).

   Écarts assumés vis-à-vis de la référence, exigés ou déjà validés :
   - les items sont des BULLES avatar rondes, et l'actif est DEUX FOIS plus
     grand que les autres (décision utilisateur) : voisins à ~0.5 puis
     décroissance douce pour que le morphing reste fluide pendant l'orbite ;
     le mouvement lui-même (pas PI/5, wrap orbital jusqu'à |d| 4, opacité,
     timings) est celui du source, sans retouche ;
   - le compteur central du source (l'ellipse est occupée par les visages)
     rejoint la rangée de contrôles, entre les chevrons ;
   - les dots de la référence portent transition-all, banni par la DA :
     transition ciblée ici ;
   - glisser tactile conservé (un cran par 64px), acquis des phases précédentes.

   L'aperçu de voix joue les VRAIES voix ElevenLabs, comme le dashboard : même
   hook partagé (components/client/useVoicePreview — cache module, fixes iOS,
   repli navigateur annoncé), pointé sur l'endpoint public
   GET /api/public/characters/:id/preview?lang=…, clips en cache serveur.
   La langue vient du site : chaque personnage parle FR et EN.
   En reduced-motion : rangée statique, fiche et aperçu conservés. */

interface Preset {
  id: string;
  name: string;
  personalityFr: string;
  personalityEn: string;
  descFr: string;
  descEn: string;
}

const PRESETS: Preset[] = [
  { id: 'marie', name: 'Marie', personalityFr: 'Chaleureuse', personalityEn: 'Warm', descFr: 'Accueillante, le sourire dans la voix. Celle qui met vos clients à l’aise dès la première seconde.', descEn: 'Welcoming, a smile in her voice. She puts your customers at ease from the first second.' },
  { id: 'camille', name: 'Camille', personalityFr: 'Premium', personalityEn: 'Premium', descFr: 'Soignée et raffinée, pour une image haut de gamme au téléphone.', descEn: 'Polished and refined, for an upscale image on the phone.' },
  { id: 'lea', name: 'Léa', personalityFr: 'Énergique', personalityEn: 'Energetic', descFr: 'Dynamique et enthousiaste, elle donne du rythme à chaque appel.', descEn: 'Dynamic and enthusiastic, she keeps every call moving.' },
  { id: 'sofia', name: 'Sofia', personalityFr: 'Décontractée', personalityEn: 'Casual', descFr: 'Naturelle, conversationnelle. On oublie qu’on parle à un accueil.', descEn: 'Natural and conversational. Callers forget they reached a front desk.' },
  { id: 'nour', name: 'Nour', personalityFr: 'Bienveillante', personalityEn: 'Caring', descFr: 'Douce et attentive, pour les métiers où l’on appelle parfois inquiet.', descEn: 'Gentle and attentive, for trades where callers are sometimes worried.' },
  { id: 'lucas', name: 'Lucas', personalityFr: 'Professionnel', personalityEn: 'Professional', descFr: 'Posé et direct, rassurant. Le ton d’un cabinet qui inspire confiance.', descEn: 'Calm and direct, reassuring. The tone of a practice that inspires trust.' },
  { id: 'adrien', name: 'Adrien', personalityFr: 'Chaleureux', personalityEn: 'Warm', descFr: 'Avenant, il met à l’aise tout de suite et laisse l’appelant finir ses phrases.', descEn: 'Approachable, he puts callers at ease at once and lets them finish their sentences.' },
  { id: 'hugo', name: 'Hugo', personalityFr: 'Décontracté', personalityEn: 'Casual', descFr: 'Détendu et direct, comme un collègue au comptoir. Réponses nettes, rendez-vous vite calé.', descEn: 'Relaxed and direct, like a colleague at the desk. Crisp answers, a quickly booked slot.' },
  { id: 'theo', name: 'Théo', personalityFr: 'Énergique', personalityEn: 'Energetic', descFr: 'Motivé et concret, ça s’entend au téléphone. Il aime les appels qui aboutissent.', descEn: 'Driven and concrete, you can hear it on the line. He likes calls that get somewhere.' },
  { id: 'julien', name: 'Julien', personalityFr: 'Premium', personalityEn: 'Premium', descFr: 'Distingué et posé, le sens du détail et des formules, pour une maison haut de gamme.', descEn: 'Distinguished and composed, a sense of detail and phrasing, for a high-end house.' },
];

const COUNT = PRESETS.length;
/* Constantes du source nexus-ui : VISIBLE_COUNT 5 -> pas PI/5, wrap orbital
   jusqu'à |d| = half*2 = 4 (les visages font le tour de l'ellipse) */
const STEP = Math.PI / 5;
const EDGE = 4;
/* Actif 2x plus grand que les autres (décision utilisateur), décroissance
   douce ensuite pour garder le morphing fluide pendant la rotation */
const SCALE = [1, 0.5, 0.46, 0.42, 0.38];
/* Formule d'opacité du source : max(0.3, 1 - d/(half+1) * 0.7) */
const OPACITY = [1, 0.767, 0.533, 0.3, 0.3];
/* Diamètre DOM du visage avant mise à l'échelle */
const FACE = 160;
const NARROW = 520;
const AUTOPLAY_MS = 4000;

/* Distance signée la plus courte sur l'anneau, wrap de la référence */
function ringDelta(i: number, active: number) {
  let d = (i - active + COUNT) % COUNT;
  if (d > COUNT / 2) d -= COUNT;
  return d;
}

/* Portage direct de getItemPosition (source.tsx) : ellipse sin/cos, échelle,
   opacité et zIndex par distance, null au-delà du bord. */
function getItemPosition(i: number, active: number, rx: number, ry: number) {
  const d = ringDelta(i, active);
  const dist = Math.abs(d);
  if (dist > EDGE) return null;
  const angle = d * STEP;
  const x = Math.sin(angle) * rx;
  const y = -Math.cos(angle) * ry;
  return {
    x,
    y,
    scale: SCALE[dist],
    opacity: OPACITY[dist],
    zIndex: EDGE + 1 - dist,
    isActive: dist === 0,
  };
}

/* URL du clip public (mêmes voix que le dashboard, cache serveur + ETag) et
   phrase de repli pour la voix du navigateur si l'audio réel échoue. */
function previewUrl(id: string, isFr: boolean) {
  return `/public/characters/${id}/preview?lang=${isFr ? 'fr' : 'en'}`;
}

function fallbackLine(name: string, isFr: boolean) {
  return isFr
    ? `Bonjour, ici ${name}, merci d’appeler ! Comment puis-je vous aider ?`
    : `Hello, this is ${name}, thanks for calling! How can I help you?`;
}

function VoicePreviewButton({
  speaking,
  onToggle,
  isFr,
  name,
  className = '',
  style,
}: {
  speaking: boolean;
  onToggle: () => void;
  isFr: boolean;
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={style}
      aria-label={
        speaking
          ? isFr
            ? `Arrêter l’aperçu de la voix de ${name}`
            : `Stop the voice preview for ${name}`
          : isFr
            ? `Écouter un aperçu de la voix de ${name}`
            : `Hear a voice preview for ${name}`
      }
      /* Pastille de 32px visuels, mais une zone tactile de 44px étendue par
         un pseudo-élément: le doigt n'a pas à viser le glyphe. */
      className={`relative w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full bg-q2-ink text-white ring-2 ring-q2-canvas hover:bg-q2-indigo transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo after:absolute after:-inset-1.5 after:content-[''] ${className}`}
    >
      {speaking ? (
        <Square size={10} fill="currentColor" aria-hidden="true" />
      ) : (
        <Play size={10} fill="currentColor" aria-hidden="true" />
      )}
    </button>
  );
}

function PersonaCard({
  preset,
  isFr,
  preview,
}: {
  preset: Preset;
  isFr: boolean;
  preview?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' });
    }, el);
    return () => ctx.revert();
  }, [preset.id]);

  return (
    <div
      ref={ref}
      id="recep-panel"
      role="tabpanel"
      aria-labelledby={`recep-tab-${preset.id}`}
      tabIndex={0}
      className="bg-q2-band rounded-3xl p-6 sm:p-8 max-w-[640px] mx-auto text-center sm:text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
    >
      <div className="flex items-center gap-3 mb-1.5 flex-wrap justify-center sm:justify-start">
        <p className="text-xl text-q2-ink font-normal">{preset.name}</p>
        <span className="q2-eyebrow text-q2-indigo">
          {isFr ? preset.personalityFr : preset.personalityEn}
        </span>
        {preview}
      </div>
      <p className="text-[15px] text-q2-body leading-relaxed q2-body-text mb-3">
        {isFr ? preset.descFr : preset.descEn}
      </p>
      <p className="text-[13px] text-q2-body q2-body-text">
        {isFr
          ? 'Voix dédiée, avec aperçu audio dans le dashboard. Français et anglais : la langue vient de vos appels, pas du personnage.'
          : 'A dedicated voice, with an audio preview in the dashboard. French and English: the language comes from your calls, not from the character.'}
      </p>
    </div>
  );
}

function VoiceCloneNote({ isFr }: { isFr: boolean }) {
  return (
    <div className="flex items-center gap-4 mt-5 sm:mt-6 max-w-[640px] mx-auto">
      <span className="w-12 h-12 shrink-0 rounded-full bg-q2-ink text-white flex items-center justify-center">
        <Mic size={18} aria-hidden="true" />
      </span>
      <p className="text-[15px] text-q2-body leading-relaxed q2-body-text">
        {isFr
          ? 'Ou clonez votre propre voix : 20 à 90 secondes d’enregistrement, avec votre consentement explicite, et elle répond avec votre timbre.'
          : 'Or clone your own voice: 20 to 90 seconds of recording, with your explicit consent, and she answers with your timbre.'}
      </p>
    </div>
  );
}

export default function CircularReceptionists({ isFr }: { isFr: boolean }) {
  const [active, setActive] = useState(0);
  const [reduced] = useState(prefersReducedMotion);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  /* Rayons de l'ellipse et taille de visage, déduits de la largeur de scène */
  const [dims, setDims] = useState({ rx: 250, ry: 112, face: FACE });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; x: number; consumed: number } | null>(null);

  const preset = PRESETS[active];
  /* Vraies voix, hook partagé avec le dashboard (cache module, fixes iOS,
     repli navigateur annoncé par `notice`). */
  const { playing, notice, toggle, prefetch, stop } = useVoicePreview(isFr);
  const speaking = playing === preset.id;
  const onTogglePreview = useCallback(() => {
    toggle(preset.id, previewUrl(preset.id, isFr), fallbackLine(preset.name, isFr));
  }, [toggle, preset.id, preset.name, isFr]);

  /* Changer de personnage coupe l'aperçu en cours et précharge le clip du
     nouveau, pour que ▶ parte sans attente. */
  useEffect(() => {
    stop();
    prefetch(previewUrl(preset.id, isFr));
  }, [preset.id, isFr, stop, prefetch]);

  const goTo = useCallback((next: number) => {
    setActive(((next % COUNT) + COUNT) % COUNT);
  }, []);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  /* Autoplay de la référence : 4 s, pausé au survol, au focus, et pendant
     qu'une voix parle (avancer couperait l'aperçu). */
  useEffect(() => {
    if (reduced || isHovered || isFocused || playing !== null) return;
    const id = setInterval(() => setActive((a) => (a + 1) % COUNT), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduced, isHovered, isFocused, playing]);

  useEffect(() => {
    if (reduced) return;
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = stage.clientWidth;
      if (w === 0) return;
      const face = w < NARROW ? 116 : FACE;
      const rx = Math.min(w * 0.42, 250);
      setDims({ rx, ry: Math.round(rx * 0.42), face });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [reduced]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(COUNT - 1);
    }
  };

  /* Glisser: un cran tous les 64px parcourus, sans inertie */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === 'mouse') return;
    dragRef.current = { id: e.pointerId, x: e.clientX, consumed: 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const total = e.clientX - drag.x;
    const steps = Math.trunc(total / 64);
    if (steps !== drag.consumed) {
      goTo(active - (steps - drag.consumed));
      drag.consumed = steps;
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const label = isFr ? 'Réceptionnistes' : 'Receptionists';

  /* Repli reduced-motion: la rangée simple, sans arc ni animation. La fiche et
     l'aperçu de voix restent là, l'aperçu passe dans l'en-tête de la fiche. */
  if (reduced) {
    return (
      <div>
        <div className="flex flex-wrap gap-2.5 sm:gap-3 mb-8" role="tablist" aria-label={label}>
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              id={`recep-tab-${p.id}`}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-controls="recep-panel"
              aria-label={`${p.name}, ${isFr ? p.personalityFr : p.personalityEn}`}
              onClick={() => setActive(i)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo focus-visible:ring-offset-2 ${
                active === i ? 'ring-2 ring-q2-indigo ring-offset-2 ring-offset-q2-canvas' : ''
              }`}
            >
              <img
                src={`/characters/${p.id}.webp`}
                alt=""
                loading="lazy"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
        <PersonaCard
          preset={preset}
          isFr={isFr}
          preview={
            <VoicePreviewButton
              speaking={speaking}
              onToggle={onTogglePreview}
              isFr={isFr}
              name={preset.name}
            />
          }
        />
        {notice && (
          <p role="status" className="text-[12px] text-q2-body q2-body-text max-w-[640px] mx-auto mt-3">
            {notice}
          </p>
        )}
        <VoiceCloneNote isFr={isFr} />
      </div>
    );
  }

  /* Bord bas de la bulle active dans la scène (centre + -ry + rayon) : le
     bouton d'aperçu s'y accroche, l'anneau décoratif aussi. */
  const activeCenterY = -dims.ry;
  const ringSize = dims.face + 12;

  return (
    <div>
      <div
        ref={stageRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-[300px] sm:h-[400px] overflow-hidden touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-3xl"
      >
        {/* Centre de l'ellipse au milieu de scène : l'orbite complète occupe
            le haut (actif) ET redescend derrière en bas, comme la référence */}
        <div className="absolute left-1/2 top-1/2">
          {/* Anneau décoratif sous la bulle active : l'arc vient à lui */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full ring-1 ring-q2-plate"
            style={{
              width: ringSize,
              height: ringSize,
              left: -ringSize / 2,
              top: activeCenterY - ringSize / 2,
            }}
          />
          <AnimatePresence mode="popLayout">
            {PRESETS.map((p, i) => {
              const pos = getItemPosition(i, active, dims.rx, dims.ry);
              if (!pos) return null;
              return (
                <motion.button
                  key={p.id}
                  layout
                  type="button"
                  id={`recep-tab-${p.id}`}
                  aria-label={`${p.name}, ${isFr ? p.personalityFr : p.personalityEn}`}
                  aria-current={pos.isActive}
                  onClick={() => goTo(i)}
                  initial={{ opacity: 0, scale: 0.8, x: pos.x, y: pos.y }}
                  animate={{
                    x: pos.x,
                    y: pos.y,
                    scale: pos.scale,
                    opacity: pos.opacity,
                    zIndex: pos.zIndex,
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  className={`absolute cursor-pointer rounded-full overflow-hidden bg-q2-band focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-q2-canvas ${
                    pos.isActive
                      ? 'shadow-[0_20px_60px_-12px_rgba(20,16,50,0.28)]'
                      : 'shadow-[0_8px_24px_-4px_rgba(20,16,50,0.14)]'
                  }`}
                  style={{
                    width: dims.face,
                    height: dims.face,
                    left: -dims.face / 2,
                    top: -dims.face / 2,
                    transformOrigin: 'center center',
                  }}
                >
                  <img
                    src={`/characters/${p.id}.webp`}
                    alt=""
                    loading={i < 4 ? 'eager' : 'lazy'}
                    width={FACE}
                    height={FACE}
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              );
            })}
          </AnimatePresence>
          <VoicePreviewButton
            speaking={speaking}
            onToggle={onTogglePreview}
            isFr={isFr}
            name={preset.name}
            className="absolute z-30"
            style={{ left: -16, top: activeCenterY + dims.face / 2 - 24 }}
          />
        </div>
      </div>

      {/* Contrôles de la référence : chevrons animés, compteur re-animé à
          chaque changement, dots avec l'actif en pilule */}
      <div className="flex items-center justify-center gap-4 mt-4 mb-6 sm:mt-5 sm:mb-8">
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={prev}
          aria-label={isFr ? 'Réceptionniste précédente' : 'Previous receptionist'}
          className="w-10 h-10 inline-flex items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-ink hover:border-q2-faint transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </motion.button>

        <div className="flex flex-col items-center gap-2 w-32">
          <motion.p
            key={preset.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            aria-hidden="true"
            className="q2-eyebrow text-q2-faint tabular-nums"
          >
            {String(active + 1).padStart(2, '0')} / {String(COUNT).padStart(2, '0')}
          </motion.p>
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={isFr ? `Aller à ${p.name}` : `Go to ${p.name}`}
                aria-current={i === active}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                  i === active
                    ? 'w-6 bg-q2-ink'
                    : 'w-1.5 bg-q2-plate hover:bg-q2-faint'
                }`}
              />
            ))}
          </div>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={next}
          aria-label={isFr ? 'Réceptionniste suivante' : 'Next receptionist'}
          className="w-10 h-10 inline-flex items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-ink hover:border-q2-faint transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
        >
          <ChevronRight size={17} aria-hidden="true" />
        </motion.button>
      </div>

      {notice && (
        <p role="status" className="text-[12px] text-q2-body q2-body-text max-w-[640px] mx-auto -mt-3 mb-4 text-center sm:text-left">
          {notice}
        </p>
      )}
      <PersonaCard preset={preset} isFr={isFr} />
      <VoiceCloneNote isFr={isFr} />
    </div>
  );
}
