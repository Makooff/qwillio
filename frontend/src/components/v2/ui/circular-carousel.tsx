import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from '../../icons';

/* PORT VERBATIM du Circular Carousel de nexus-ui
   (DA/references/21st/circular-carousel/source.tsx, collé par l'utilisateur).
   La mécanique est celle du fichier, intouchée : getItemPosition (ellipse
   sin/cos, RADIUS 220/100, VISIBLE_COUNT 5, wrap, formules scale/opacité/
   zIndex), AnimatePresence popLayout + layout, transitions 0.65 s
   cubic-bezier(0.22,1,0.36,1), autoplay 4 s pausé au survol/focus, flèches
   clavier, chevrons whileHover/whileTap, dots, compteur central.

   Seuls écarts, tous actés avec l'utilisateur :
   - `cn` remplacé par un join local (pas de lib/utils ici), "use client" retiré ;
   - l'item porte un avatar rond + nom + tag (contenu Qwillio) et les couleurs
     passent aux tokens q2 clairs (méthode : « reprendre les designs, juste
     ajuster avec mes couleurs et typo ») ;
   - UNE ligne d'échelle : l'actif reste à la formule (=1), les autres prennent
     la formule x 0.55 pour que l'actif soit ~2x plus grand, morphing intact ;
   - les dots du fichier portaient transition-all (banni DA) : transition ciblée ;
   - `pauseSignal` : l'autoplay se met aussi en pause pendant qu'une voix joue
     (avancer couperait l'aperçu). */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface CarouselItem {
  id: string;
  title: string;
  description: string;
  tag?: string;
  avatar?: string;
}

export interface CircularCarouselProps {
  items: CarouselItem[];
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  pauseSignal?: boolean;
  className?: string;
}

/* VISIBLE_COUNT fixe le pas angulaire (180/VISIBLE_COUNT). À 7, le pas est de
   25,7 degrés : les dix visages tiennent sur l'arc sans se chevaucher, alors
   qu'à 5 ils se marchaient dessus (deux cartes tombaient au même x, ±209).

   La fenêtre de repli (`half`) ne suit plus VISIBLE_COUNT mais la MOITIÉ du
   catalogue. C'est ce qui rend la téléportation invisible : avec l'ancien
   calcul, une carte sautait de l'écart +3 (bien visible) à l'écart -6, on
   voyait celle de gauche réapparaître à droite. En repliant à la moitié, le
   saut se produit entre les deux écarts LES PLUS GRANDS, là où la carte est
   déjà transparente (voir FADE_OUT). */
const VISIBLE_COUNT = 7;
const RADIUS_X = 220;
const RADIUS_Y = 100;

/* Écart à partir duquel une carte est complètement effacée. Le fondu commence
   avant, donc rien ne disparaît d'un coup, et le saut se fait à zéro. */
const FADE_OUT = 3.6;

/* De quoi l'anneau doit tenir compte pour se mettre à l'échelle: la position
   et la demi-largeur de la carte de l'écart 2, la dernière que l'oeil lit
   vraiment. Écrit à partir des mêmes constantes que `getItemPosition`, pour
   qu'un changement de VISIBLE_COUNT ou de rayon ne laisse pas ce cadrage en
   arrière. */
const OUTER_X = Math.sin((2 / VISIBLE_COUNT) * Math.PI) * RADIUS_X;
/* 56 = demi-largeur d'une carte; son échelle à l'écart 2 vaut
   (1 - 2/maxDistance * 0,3) * 0,55, avec maxDistance = 4. */
const OUTER_CARD_HALF = 56 * (1 - (2 / (Math.floor(VISIBLE_COUNT / 2) + 1)) * 0.3) * 0.55;

/* Hauteur reellement occupee par l'arc, mesuree: les cartes s'arretent a 165
   dans la boite de 280 du fichier. Garder 280 laissait 98 px de vide sous
   l'anneau en 390 px, et c'est cette bande qui separait le compteur des
   fleches. 178 rend les 13 px d'air qu'il faut sous la derniere carte. */
const ARC_CONTENT_H = 178;

function getItemPosition(index: number, activeIndex: number, total: number) {
  const offset = index - activeIndex;
  const half = Math.floor(total / 2);
  let adjustedOffset = offset;

  if (offset > half) adjustedOffset = offset - total;
  if (offset < -half) adjustedOffset = offset + total;

  const angle = (adjustedOffset / VISIBLE_COUNT) * Math.PI;
  const x = Math.sin(angle) * RADIUS_X;
  const y = -Math.cos(angle) * RADIUS_Y;

  const distance = Math.abs(adjustedOffset);
  const maxDistance = Math.floor(VISIBLE_COUNT / 2) + 1;
  const scale = Math.max(0, 1 - (distance / maxDistance) * 0.3);
  const opacity = distance >= FADE_OUT ? 0 : Math.max(0, 1 - (distance / FADE_OUT) ** 1.3);
  const zIndex = VISIBLE_COUNT - distance;

  /* Actif 2x (décision utilisateur) : la formule du fichier reste la base,
     les non-actifs prennent un multiplicateur unique. */
  return { x, y, scale: distance === 0 ? scale : scale * 0.55, opacity, zIndex, adjustedOffset };
}

export function CircularCarousel({
  items,
  activeIndex: controlledIndex,
  onActiveChange,
  autoPlay = true,
  autoPlayInterval = 4000,
  pauseSignal = false,
  className,
}: CircularCarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  /* Les rayons du fichier sont en pixels fixes : sur un téléphone, l'orbite
     déborde de l'écran. Plutôt que de toucher au math, on met TOUT l'anneau à
     l'échelle du cadre disponible (demi-empan réel : 218 + 80 de demi-carte). */
  const [k, setK] = useState(1);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      /* L'échelle se calait sur la carte de l'écart 3 (x = ±214) plus une
         demi-carte pleine, soit un demi-empan de 276. En 390 px cela donnait
         0,60: tout l'anneau, compteur compris, rétrécissait de 40 % pour
         faire tenir DEUX CARTES QUI SONT DÉJÀ PRESQUE TRANSPARENTES (opacité
         0,21 à cet écart, et le masque de bord les efface par-dessus).
         On dimensionne donc sur l'écart 2, la dernière carte réellement
         lisible, et les fantômes du bord restent au masque, dont c'est le
         travail. En 390 px l'échelle passe de 0,60 à ~0,87. */
      const half = w / 2 - 6;
      setK(Math.max(0.72, Math.min(1, half / (OUTER_X + OUTER_CARD_HALF))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeIndex = controlledIndex ?? internalIndex;
  const total = items.length;

  const goTo = useCallback(
    (index: number) => {
      const newIndex = ((index % total) + total) % total;
      if (controlledIndex === undefined) {
        setInternalIndex(newIndex);
      }
      onActiveChange?.(newIndex);
    },
    [total, controlledIndex, onActiveChange],
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (!autoPlay || isHovered || isFocused || pauseSignal) return;
    intervalRef.current = setInterval(next, autoPlayInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, autoPlayInterval, isHovered, isFocused, pauseSignal, next]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    const el = containerRef.current;
    el?.addEventListener('keydown', handler);
    return () => el?.removeEventListener('keydown', handler);
  }, [next, prev]);

  const activeItem = items[activeIndex];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Circular carousel"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        'relative flex flex-col items-center justify-center gap-5 sm:gap-8 outline-none',
        className,
      )}
    >
      {/* Circular track */}
      {/* Hauteur du fichier (280). Deux ajustements de cadre seulement : un cran
          de largeur en plus (la carte extrême est à x = ±209, le fichier la
          rognait) et l'ancre à 164, parce que l'empan réel de l'arc va de -164 à
          +95 autour d'elle une fois les cartes centrées sur leur point
          d'orbite. Géométrie du conteneur, pas de l'animation. */}
      <div ref={trackRef} className="relative w-full max-w-xl" style={{ height: ARC_CONTENT_H * k }}>
        <div
          /* `overflow-hidden`, et ce n'est pas cosmetique: les cartes des ecarts
             lointains sortent de la piste, et un masque CACHE des pixels sans
             COUPER la mise en page. Elles ajoutaient donc 8 px a la largeur du
             document en 390 px, d'ou une bande noire a droite et une page qui
             glisse lateralement sur iOS. Pire, hors de la boite elles n'etaient
             meme plus masquees, donc peintes en clair. Coupees au bord, elles
             disparaissent la ou le masque les a deja effacees. */
          className="absolute inset-x-0 top-0 h-[280px] overflow-hidden"
          style={{
            transform: `scale(${k})`,
            transformOrigin: 'top center',
            /* Fondu aux deux bords : même effacée, une carte qui reviendrait
               par le côté ne couperait jamais net sur l'arête de la piste. */
            maskImage: 'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 16%, black 84%, transparent 100%)',
          }}
        >
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => {
            const pos = getItemPosition(i, activeIndex, total);
            if (!pos) return null;

            const isActive = i === activeIndex;

            return (
              <motion.button
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  x: pos.x,
                  y: pos.y,
                  scale: pos.scale,
                  opacity: pos.opacity,
                  zIndex: pos.zIndex,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                }}
                onClick={() => goTo(i)}
                aria-label={item.title}
                aria-current={isActive}
                className={cn(
                  'absolute left-1/2 top-[164px] flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-q2-plate bg-q2-canvas p-2 transition-shadow duration-300',
                  isActive
                    ? 'shadow-[0_20px_60px_-12px_rgba(20,16,50,0.28)]'
                    : 'shadow-[0_8px_24px_-4px_rgba(20,16,50,0.12)] hover:shadow-[0_12px_32px_-4px_rgba(20,16,50,0.18)]',
                )}
                /* Les classes -translate-x/y-1/2 du fichier sont écrasées par le
                   transform que framer écrit pour x/y : sans ça chaque carte
                   pend en bas à droite de son point d'orbite. Les marges
                   négatives (moitié de w-40/h-32) rétablissent le centrage voulu
                   par l'auteur, sans toucher aux valeurs animées. */
                style={{ transformOrigin: 'center center', marginLeft: -56, marginTop: -56 }}
              >
                {item.avatar && (
                  <img
                    src={item.avatar}
                    alt=""
                    loading={i < 4 ? 'eager' : 'lazy'}
                    width={64}
                    height={64}
                    className="h-14 w-14 rounded-full object-cover bg-q2-band"
                  />
                )}
                <span
                  className={cn(
                    'leading-tight transition-colors duration-300',
                    isActive ? 'text-q2-ink text-[13px]' : 'text-q2-graphite text-[12px]',
                  )}
                >
                  {item.title}
                </span>
                {item.tag && (
                  <span className="rounded-full bg-q2-band px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-q2-indigo">
                    {item.tag}
                  </span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
        </div>
      </div>
      {/* Le compteur est un ELEMENT DE FLUX, sous l'arc.
          Il etait `absolute inset-0` sur le bloc entier, donc centre sur
          piste + gouttiere + controles: sa position ne tenait qu'a la hauteur
          de la piste, et resserrer celle-ci le ramenait sur le visage. Place
          dans le flux, il est sous les cartes parce qu'on l'y a mis. */}
      <motion.div
        key={activeItem.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center pointer-events-none -my-1"
        /* Le compteur vit HORS du groupe mis à l'échelle: sans cette
           transformation il restait à 48 px pendant que les cartes
           rétrécissaient d'un tiers, et le « 04 » écrasait l'anneau sur
           téléphone (retour utilisateur). */
        style={{ transform: `scale(${k})` }}
      >
        <span className="text-4xl font-light tracking-tight text-q2-ink/80 tabular-nums">
          {String(activeIndex + 1).padStart(2, '0')}
        </span>
        {/* « of 10 » du fichier remplacé par « / 10 » : le site est FR et EN,
            la barre oblique se lit dans les deux langues. */}
        <span className="mt-1 text-xs text-q2-faint tabular-nums">
          / {String(total).padStart(2, '0')}
        </span>
      </motion.div>


      {/* Controls */}
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={prev}
          aria-label="Previous item"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-graphite transition-colors hover:bg-q2-band hover:text-q2-ink focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
        >
          <ChevronLeft className="size-5" />
        </motion.button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5" role="tablist">
          {items.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              onClick={() => goTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-[width,background-color] duration-300',
                i === activeIndex
                  ? 'w-6 bg-q2-ink/80'
                  : 'w-1.5 bg-q2-plate hover:bg-q2-faint',
              )}
              aria-label={`Go to item ${i + 1}`}
            />
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={next}
          aria-label="Next item"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-graphite transition-colors hover:bg-q2-band hover:text-q2-ink focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
        >
          <ChevronRight className="size-5" />
        </motion.button>
      </div>
    </div>
  );
}

export default CircularCarousel;
