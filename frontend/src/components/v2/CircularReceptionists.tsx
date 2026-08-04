import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ChevronLeft, ChevronRight, Mic, Play, Square } from 'lucide-react';
import { prefersReducedMotion } from './motion/reducedMotion';

/* Sélection des réceptionnistes en carrousel circulaire: les dix visages sont
   posés sur un arc, l'actif descend au centre-bas et s'agrandit nettement
   (160px contre 77px pour ses voisins), sa fiche de personnalité s'écrit
   dessous. Flèches, clavier (gauche/droite, Origine/Fin) et glisser au doigt
   font tourner l'arc.

   Un bouton d'aperçu posé sur le bas du visage actif fait dire une phrase
   d'accueil par le moteur de synthèse du navigateur, dans la langue du site:
   aucun appel réseau, l'aperçu audio des vraies voix vit dans le dashboard.

   Les données sont celles du catalogue serveur (voice-characters.ts), les
   mêmes que ReceptionistGallery, qui reste en place comme repli réutilisable
   ailleurs. Chaque personnage porte sa voix et parle français et anglais: la
   langue vient du client, pas du personnage. Le onzième choix est le clonage
   de voix (VoiceCloner, 20-90 s).

   Motion: transform et opacity uniquement, une seule écriture GSAP par
   changement d'index. En reduced-motion on rend une rangée simple, sans arc,
   sans animation: la fiche et l'aperçu de voix restent disponibles. */

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
/* Nombre de visages visibles de chaque côté de l'actif: au-delà, le visage
   sort de l'arc (opacité 0) et le débordement de la scène le découpe */
const EDGE = 3;
/* Échelle et opacité par distance à l'actif. L'écart entre 1 et 0.48 est
   voulu: on doit voir d'un coup d'œil qui décroche. */
const SCALE = [1, 0.48, 0.38, 0.3, 0.28, 0.26];
const OPACITY = [1, 0.88, 0.62, 0.32, 0, 0];
/* Diamètre du visage dans le DOM, avant mise à l'échelle. L'actif le porte
   tel quel, ses voisins descendent à environ 77px. */
const FACE = 160;
/* Sous cette largeur de scène, tout l'arc rétrécit d'un cran */
const NARROW = 520;
const NARROW_SCALE = 0.75;

/* Distance signée la plus courte sur un anneau de COUNT éléments */
function ringDelta(i: number, active: number) {
  let d = (i - active + COUNT) % COUNT;
  if (d > COUNT / 2) d -= COUNT;
  return d;
}

/* Aperçu de voix par synthèse du navigateur: une phrase d'accueil dans la
   langue du site, coupée dès qu'on change de personnage ou de langue. */
function useVoicePreview(preset: Preset, isFr: boolean) {
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => {
    stop();
    return stop;
  }, [preset.id, isFr, stop]);

  const toggle = useCallback(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (speaking) {
      stop();
      return;
    }
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(
      isFr
        ? `Bonjour, ici ${preset.name}, merci d’appeler ! Comment puis-je vous aider ?`
        : `Hello, this is ${preset.name}, thanks for calling! How can I help you?`,
    );
    utt.lang = isFr ? 'fr-FR' : 'en-US';
    utt.rate = 0.98;
    const match = synth.getVoices().find((v) => v.lang.startsWith(isFr ? 'fr' : 'en'));
    if (match) utt.voice = match;
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utt);
  }, [isFr, preset.name, speaking, stop]);

  return { speaking, toggle };
}

function VoicePreviewButton({
  speaking,
  onToggle,
  isFr,
  name,
  className = '',
}: {
  speaking: boolean;
  onToggle: () => void;
  isFr: boolean;
  name: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
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
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<{ id: number; x: number; consumed: number } | null>(null);

  const preset = PRESETS[active];
  const { speaking, toggle } = useVoicePreview(preset, isFr);

  const go = useCallback((next: number) => {
    setActive(((next % COUNT) + COUNT) % COUNT);
  }, []);

  /* Pose l'arc: chaque visage prend son angle, seuls x/y/scale sont écrits */
  const layout = useCallback(
    (animate: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (w === 0) return;

      /* L'arc est déduit de la scène, pas de constantes en dur: le visage le
         plus éloigné encore visible atterrit à `span` du centre et `depth`
         plus haut. Le rayon et le pas s'en déduisent, donc la courbe reste
         juste de 390px à 1200px sans point de rupture. */
      /* Empan plafonné: sans lui, un écran large étirerait l'arc en rangée
         plate et la courbe ne se lirait plus. Angle de bord plafonné à 72deg:
         au-delà l'arc se referme sur lui-même et les visages se rattrapent. */
      const vs = w < NARROW ? NARROW_SCALE : 1;
      /* Diamètre visible de l'actif, une fois la mise à l'échelle appliquée */
      const facePx = FACE * vs;
      const span = Math.min(w * 0.46, 300);
      const depth = h * 0.58;
      const edgeAngle = Math.min(2 * Math.atan(depth / span), (72 * Math.PI) / 180);
      const radius = span / Math.sin(edgeAngle);
      const step = edgeAngle / EDGE;
      /* Ligne de base: le centre de l'actif, posé au bas de la scène */
      const baseY = h - facePx / 2 - 22;

      PRESETS.forEach((_, i) => {
        const el = tabsRef.current[i];
        if (!el) return;
        const d = ringDelta(i, active);
        const a = d * step;
        const x = radius * Math.sin(a);
        /* FACE et non facePx: l'élément est mis à l'échelle depuis son
           centre, la translation part donc de sa taille DOM */
        const y = baseY - radius * (1 - Math.cos(a)) - FACE / 2;
        const k = Math.min(Math.abs(d), SCALE.length - 1);
        const vars = {
          x,
          y,
          scale: SCALE[k] * vs,
          opacity: OPACITY[k],
          zIndex: 20 - Math.abs(d),
          duration: animate ? 0.62 : 0,
          ease: 'expo.out',
          overwrite: 'auto' as const,
        };
        gsap.to(el, vars);
      });

      const ring = ringRef.current;
      if (ring) {
        const size = facePx + 12;
        ring.style.width = `${size}px`;
        ring.style.height = `${size}px`;
        ring.style.marginLeft = `${-size / 2}px`;
        ring.style.top = `${baseY - size / 2}px`;
      }
    },
    [active],
  );

  useLayoutEffect(() => {
    if (reduced) return;
    layout(false);
  }, [reduced, layout]);

  useEffect(() => {
    if (reduced) return;
    layout(true);
  }, [active, reduced, layout]);

  useEffect(() => {
    if (reduced) return;
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => layout(false));
    ro.observe(stage);
    return () => ro.disconnect();
  }, [reduced, layout]);

  useEffect(
    () => () => {
      gsap.killTweensOf(tabsRef.current.filter(Boolean) as HTMLButtonElement[]);
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(active + 1);
      tabsRef.current[(active + 1) % COUNT]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(active - 1);
      tabsRef.current[(active - 1 + COUNT) % COUNT]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
      tabsRef.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      go(COUNT - 1);
      tabsRef.current[COUNT - 1]?.focus();
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
      go(active - (steps - drag.consumed));
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
              onToggle={toggle}
              isFr={isFr}
              name={preset.name}
            />
          }
        />
        <VoiceCloneNote isFr={isFr} />
      </div>
    );
  }

  return (
    <div>
      {/* Le bouton d'aperçu vit hors du tablist: un bouton simple entre des
          role="tab" casserait la sémantique de la liste */}
      <div className="relative">
        <div
          ref={stageRef}
          role="tablist"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative h-[300px] sm:h-[400px] overflow-hidden touch-pan-y select-none"
        >
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active === i}
              tabIndex={active === i ? 0 : -1}
              aria-label={`${p.name}, ${isFr ? p.personalityFr : p.personalityEn}`}
              onClick={() => go(i)}
              id={`recep-tab-${p.id}`}
              aria-controls="recep-panel"
              /* Pose neutre en haut au centre: GSAP n'écrit que x/y/scale */
              style={{ willChange: 'transform' }}
              className="absolute top-0 left-1/2 -ml-[80px] w-[160px] h-[160px] rounded-full overflow-hidden bg-q2-band focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-q2-canvas"
            >
              <img
                src={`/characters/${p.id}.webp`}
                alt=""
                loading={i < 4 ? 'eager' : 'lazy'}
                width={160}
                height={160}
                className="w-full h-full object-cover"
              />
            </button>
          ))}

          {/* Anneau de l'actif, décoratif: il ne bouge pas, l'arc vient à lui.
              Ses dimensions suivent l'échelle de la scène, écrites par layout */}
          <span
            ref={ringRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 rounded-full ring-1 ring-q2-plate"
          />
        </div>

        <VoicePreviewButton
          speaking={speaking}
          onToggle={toggle}
          isFr={isFr}
          name={preset.name}
          className="absolute left-1/2 -ml-4 bottom-[6px] z-30"
        />
      </div>

      <div className="flex items-center justify-center gap-3 mt-4 mb-6 sm:mt-5 sm:mb-8">
        <button
          type="button"
          onClick={() => go(active - 1)}
          aria-label={isFr ? 'Réceptionniste précédente' : 'Previous receptionist'}
          className="q2-pill w-11 h-11 inline-flex items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-ink hover:border-q2-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <p className="q2-eyebrow text-q2-faint tabular-nums w-16 text-center" aria-hidden="true">
          {String(active + 1).padStart(2, '0')} / {COUNT}
        </p>
        <button
          type="button"
          onClick={() => go(active + 1)}
          aria-label={isFr ? 'Réceptionniste suivante' : 'Next receptionist'}
          className="q2-pill w-11 h-11 inline-flex items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-ink hover:border-q2-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      <PersonaCard preset={preset} isFr={isFr} />
      <VoiceCloneNote isFr={isFr} />
    </div>
  );
}
