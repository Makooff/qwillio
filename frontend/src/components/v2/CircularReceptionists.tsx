import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { prefersReducedMotion } from './motion/reducedMotion';

/* Sélection des réceptionnistes en carrousel circulaire: les dix visages sont
   posés sur un arc, l'actif descend au centre-bas et s'agrandit, sa fiche de
   personnalité s'écrit dessous. Flèches, clavier (gauche/droite, Origine/Fin)
   et glisser au doigt font tourner l'arc.

   Les données sont celles du catalogue serveur (voice-characters.ts), les
   mêmes que ReceptionistGallery, qui reste en place comme repli réutilisable
   ailleurs. Chaque personnage porte sa voix, avec aperçu audio dans le
   dashboard, et parle français et anglais: la langue vient du client, pas du
   personnage. Le onzième choix est le clonage de voix (VoiceCloner, 20-90 s).

   Motion: transform et opacity uniquement, une seule écriture GSAP par
   changement d'index. En reduced-motion on rend une rangée simple, sans arc,
   sans animation: le composant reste entièrement utilisable au clavier. */

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
/* Échelle et opacité par distance à l'actif */
const SCALE = [1, 0.76, 0.6, 0.48, 0.44, 0.42];
const OPACITY = [1, 0.88, 0.62, 0.32, 0, 0];
/* Diamètre du visage au repos, avant mise à l'échelle */
const FACE = 88;

/* Distance signée la plus courte sur un anneau de COUNT éléments */
function ringDelta(i: number, active: number) {
  let d = (i - active + COUNT) % COUNT;
  if (d > COUNT / 2) d -= COUNT;
  return d;
}

function PersonaCard({ preset, isFr }: { preset: Preset; isFr: boolean }) {
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
      <div className="flex items-baseline gap-3 mb-1.5 flex-wrap justify-center sm:justify-start">
        <p className="text-xl text-q2-ink font-normal">{preset.name}</p>
        <span className="q2-eyebrow text-q2-indigo">
          {isFr ? preset.personalityFr : preset.personalityEn}
        </span>
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
    <div className="flex items-center gap-4 mt-6 max-w-[640px] mx-auto">
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
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<{ id: number; x: number; consumed: number } | null>(null);

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
      const span = w * 0.46;
      const depth = h * 0.42;
      const edgeAngle = 2 * Math.atan(depth / span);
      const radius = span / Math.sin(edgeAngle);
      const step = edgeAngle / EDGE;
      /* Ligne de base: le centre de l'actif, posé au bas de la scène */
      const baseY = h - FACE / 2 - 22;

      PRESETS.forEach((_, i) => {
        const el = tabsRef.current[i];
        if (!el) return;
        const d = ringDelta(i, active);
        const a = d * step;
        const x = radius * Math.sin(a);
        const y = baseY - radius * (1 - Math.cos(a)) - FACE / 2;
        const k = Math.min(Math.abs(d), SCALE.length - 1);
        const vars = {
          x,
          y,
          scale: SCALE[k],
          opacity: OPACITY[k],
          zIndex: 20 - Math.abs(d),
          duration: animate ? 0.62 : 0,
          ease: 'expo.out',
          overwrite: 'auto' as const,
        };
        gsap.to(el, vars);
      });
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

  const preset = PRESETS[active];
  const label = isFr ? 'Réceptionnistes' : 'Receptionists';

  /* Repli reduced-motion: la rangée simple, sans arc ni animation */
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
        <PersonaCard preset={preset} isFr={isFr} />
        <VoiceCloneNote isFr={isFr} />
      </div>
    );
  }

  return (
    <div>
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
        className="relative h-[240px] sm:h-[300px] overflow-hidden touch-pan-y select-none"
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
            className="absolute top-0 left-1/2 -ml-[44px] w-[88px] h-[88px] rounded-full overflow-hidden bg-q2-band focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-q2-canvas"
          >
            <img
              src={`/characters/${p.id}.webp`}
              alt=""
              loading={i < 4 ? 'eager' : 'lazy'}
              width={88}
              height={88}
              className="w-full h-full object-cover"
            />
          </button>
        ))}

        {/* Anneau de l'actif, purement décoratif: il ne bouge pas, l'arc vient à lui */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -ml-[48px] w-[96px] h-[96px] rounded-full ring-1 ring-q2-plate"
          style={{ top: 'calc(100% - 114px)' }}
        />
      </div>

      <div className="flex items-center justify-center gap-3 mt-5 mb-8">
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
