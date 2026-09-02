import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '../../lib/utils';

/*
 * Carrousel « squeeze »: un panneau prend la place, les autres se replient en
 * lattes sur la droite. Trois écarts avec la source, tous délibérés:
 *
 * 1. Pas de `"use client"`: le projet est en Vite, pas en Next.
 * 2. Pas de bloc `@font-face` Geist injecté: la police du site est Outfit et
 *    elle seule (CLAUDE.md). Le composant n'impose donc aucune police et hérite
 *    de celle de la page.
 * 3. Les jetons shadcn (`bg-muted`, `text-foreground`, `text-muted-foreground`,
 *    `ring-offset-background`, `var(--primary)`) n'existent pas ici: ils sont
 *    traduits en jetons `q2-*`, qui basculent seuls avec le thème.
 *
 * Les variantes de conteneur (`@lg:`, `@xl:`) exigent le greffon
 * `@tailwindcss/container-queries`, déclaré dans tailwind.config.js.
 */

/* -------------------------------------------------------------------------- */
/*                                   slides                                   */
/* -------------------------------------------------------------------------- */

export type SqueezeSlide = {
  /** Clé stable. À défaut, la position dans le tableau. */
  id?: string | number;
  /** La phrase d'ouverture, en encre, sous les panneaux. */
  title: string;
  /** La suite de la phrase, en gris. */
  description?: string;
  /** Image du panneau. Elle se recadre par le milieu quand le panneau rétrécit. */
  image?: string;
  /** Texte alternatif. Sans lui, l'image est lue comme décorative. */
  imageAlt?: string;
  /** N'importe quel fond CSS: un dégradé, une couleur, des couches. Sert quand il n'y a pas d'image. */
  background?: string;
  /** Se pose dans le coin du panneau ouvert: un nom, un logo, une légende. */
  overlay?: ReactNode;
  /** Le texte du bouton. Pas de texte, pas de bouton. */
  action?: string;
  /** Où mène le bouton. */
  href?: string;
  /** Ouvre le lien dans un nouvel onglet. */
  target?: string;
  /**
   * Remplace le suivi de `href`. Reçoit l'évènement: c'est ce qui permet à
   * l'appelant de faire `preventDefault()` puis de router côté client, sans
   * quoi un lien interne rechargerait la page entière.
   */
  onAction?: (event: MouseEvent<HTMLElement>) => void;
};

/* -------------------------------------------------------------------------- */
/*                                  geometry                                  */
/* -------------------------------------------------------------------------- */

/** Un nombre est lu en pixels; une chaîne passe telle quelle, `2rem` compris. */
type Size = number | string;

const size = (value: Size) => (typeof value === 'number' ? `${value}px` : value);

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * La rangée est quatre colonnes et une queue de lattes, et c'est une bande qui
 * glisse, pas un anneau qui tourne.
 *
 * Les quatre colonnes se partagent ce qui reste une fois payés la carte
 * ouverte, les lattes et les écarts. La carte ouverte part d'un bloc 16:9 puis
 * en rend un peu, d'où la première part négative. La colonne −1 et tout ce qui
 * dépasse la colonne 3 est une latte: une carte qui quitte le devant se réduit
 * donc à une latte et poursuit sa sortie par la gauche.
 */
const SHARES = [-0.06, 0.61, 0.3, 0.15];

/** La colonne survolée prend plus de place. */
const STRETCHED = [0, 0.71, 0.4, 0.25];

/** Ses voisines cèdent un peu pour la payer. */
const SQUEEZED = [-0.12, 0.59, 0.28, 0.13];

/** Une carte de la bande. `key` garde React sur le même nœud quand la bande s'allonge. */
type Card = { key: number; slide: number };

/* -------------------------------------------------------------------------- */
/*                                    hooks                                   */
/* -------------------------------------------------------------------------- */

/** Vrai tant que le lecteur demande moins de mouvement. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  return reduced;
}

/* -------------------------------------------------------------------------- */
/*                                 component                                  */
/* -------------------------------------------------------------------------- */

export type SqueezeCarouselProps = {
  /** Les panneaux, dans l'ordre où on les lit. */
  slides: SqueezeSlide[];
  /** Le panneau ouvert au départ. Par défaut `0`. */
  defaultIndex?: number;
  /** Appelé avec le panneau qui vient de s'ouvrir. */
  onIndexChange?: (index: number) => void;
  /** Hauteur de la rangée. Par défaut `clamp(180px, 32cqi, 340px)`. */
  height?: Size;
  /** Largeur d'une latte. Par défaut `8`. */
  slatWidth?: Size;
  /** Espace entre les lattes. Par défaut `8`. */
  slatGap?: Size;
  /** Espace entre les quatre colonnes. Par défaut `16`. */
  gap?: Size;
  /** Arrondi d'un panneau. Par défaut `6`. */
  radius?: Size;
  /** Durée du glissement, en millisecondes. Par défaut `1000`. */
  duration?: number;
  /** Élargit le panneau sous le curseur. Par défaut `true`. */
  hoverGrow?: boolean;
  /** Avance tout seul. Par défaut `false`. */
  autoplay?: boolean;
  /** Millisecondes qu'un panneau reste ouvert en lecture automatique. Par défaut `6000`. */
  interval?: number;
  /** Affiche les deux flèches. Par défaut `true`. */
  controls?: boolean;
  /** Le fond du bouton, des flèches et de l'anneau de focus. Par défaut l'indigo de la marque. */
  accent?: string;
  /** Ce qui se pose dessus: le libellé et les pointes de flèche. */
  accentForeground?: string;
  /** Ce qu'un lecteur d'écran appelle le carrousel. Par défaut `"Featured"`. */
  label?: string;
  /** Classes supplémentaires pour un panneau. */
  panelClassName?: string;
} & Omit<ComponentProps<'div'>, 'onSelect'>;

/**
 * Un carrousel qui donne la place à un panneau et replie les autres en lattes
 * sur la droite. Ouvrir une latte l'élargit et fait glisser la rangée; le texte
 * et le bouton en dessous se fondent en même temps.
 */
export function SqueezeCarousel({
  slides,
  defaultIndex = 0,
  onIndexChange,
  height = 'clamp(180px, 32cqi, 340px)',
  slatWidth = 8,
  slatGap = 8,
  gap = 16,
  radius = 6,
  duration = 1000,
  hoverGrow = true,
  autoplay = false,
  interval = 6000,
  controls = true,
  accent = 'var(--sq-accent, #7A5FFF)',
  accentForeground = 'var(--sq-accent-foreground, #FFFFFF)',
  label = 'Featured',
  panelClassName,
  className,
  style,
  ...props
}: SqueezeCarouselProps) {
  const count = slides.length;
  const wrap = (i: number) => ((i % count) + count) % count;

  // Quatre colonnes plus une queue de lattes. Moins de diapositives, queue plus courte.
  const slats = clamp(count - 4, 1, 3);
  const visible = 4 + slats;

  const reduced = useReducedMotion();
  const ms = reduced ? 0 : duration;

  const ids = useId();
  const seed = useRef(0);
  const strip = useRef<HTMLDivElement>(null);

  /* --- la bande --------------------------------------------------------- */

  const window0 = () =>
    Array.from({ length: visible }, (_, p) => ({
      key: seed.current++,
      slide: wrap(defaultIndex + p),
    }));

  const [cards, setCards] = useState<Card[]>(window0);
  // La colonne de chaque carte: sa place dans la bande, plus ceci. Avancer
  // décale vers le bas, si bien que la carte qui était en colonne 0 passe en
  // colonne −1: une latte, en route vers la sortie par la gauche.
  const [column, setColumn] = useState(0);
  // Lu par le rangement plus bas, qui part d'un minuteur et ne peut donc pas se
  // fier à une valeur capturée au moment où il a été programmé.
  const columnRef = useRef(0);
  const forward = useRef(true);
  // De combien la bande est glissée, compté en lattes. Normalement identique à
  // `column`; les deux se séparent le temps d'une image après un rognage ou
  // avant un retour en arrière, quand la bande doit bouger sans qu'on la voie.
  const [slid, setSlid] = useState(0);
  const [still, setStill] = useState(false);
  const [hover, setHover] = useState(-1);

  const open = cards[-column]?.slide ?? defaultIndex;
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Un pas laisse la bande plus longue qu'il ne faut. Une fois le mouvement
  // fini, la ramener aux cartes visibles et remettre les compteurs à zéro: même
  // image, donc rien ne doit s'animer au passage.
  // Avancer ajoute à la queue, reculer ajoute en tête, donc les cartes visibles
  // sont simplement les dernières ou les premières de la bande. Compter depuis
  // un numéro de colonne reviendrait à se fier à un chiffre capturé avant que
  // le pas auquel il appartient ait été appliqué, ce qu'un clic rapide casse.
  const settle = useCallback(() => {
    setCards((strip) => (forward.current ? strip.slice(-visible) : strip.slice(0, visible)));
    columnRef.current = 0;
    setColumn(0);
    setSlid(0);
    setStill(true);
  }, [visible]);

  useLayoutEffect(() => {
    if (!still) return;
    const id = requestAnimationFrame(() => setStill(false));
    return () => cancelAnimationFrame(id);
  }, [still]);

  const step = useCallback(
    (by: number) => {
      if (count < 2 || by === 0) return;

      timers.current.forEach(clearTimeout);
      timers.current = [];
      forward.current = by > 0;

      if (by > 0) {
        // La latte qui arrive rejoint la queue à pleine taille avant que rien ne
        // bouge, pour que le bout de la rangée ne soit jamais amputé.
        setCards((strip) => [
          ...strip,
          ...Array.from({ length: by }, (_, k) => ({
            key: seed.current++,
            slide: wrap(strip[strip.length - 1].slide + 1 + k),
          })),
        ]);
        columnRef.current -= by;
        setColumn(columnRef.current);
        setSlid((s) => s - by);
      } else {
        // En arrière, la bande doit grandir par l'avant, ce qui pousse tout vers
        // la droite. La glisser d'autant vers la gauche sans transition, puis la
        // laisser revenir.
        setCards((strip) => [
          ...Array.from({ length: -by }, (_, k) => ({
            key: seed.current++,
            slide: wrap(strip[0].slide - (-by - k)),
          })),
          ...strip,
        ]);
        setSlid((s) => s + by);
        setStill(true);
        timers.current.push(window.setTimeout(() => setSlid(0), 0));
      }

      timers.current.push(window.setTimeout(settle, ms + 20));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, ms, settle],
  );

  useEffect(() => {
    onIndexChange?.(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* --- lecture automatique ---------------------------------------------- */

  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!autoplay || paused || reduced || count < 2) return;
    const timer = window.setTimeout(() => step(1), interval);
    return () => clearTimeout(timer);
  }, [autoplay, paused, reduced, count, open, interval, step]);

  /* --- clavier ---------------------------------------------------------- */

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number | undefined> = { ArrowRight: 1, ArrowLeft: -1 };
    const by = moves[event.key];
    if (by === undefined) return;
    event.preventDefault();
    step(by);
  };

  if (!count) return null;

  /* --- rendu ------------------------------------------------------------ */

  const slat = size(slatWidth);
  const shares = hoverGrow && hover >= 0 && hover <= 3 && !reduced ? null : SHARES;

  /** La part d'une colonne, une fois le curseur entendu. */
  const shareOf = (col: number) => {
    if (shares) return SHARES[col];
    return hover === col ? STRETCHED[col] : SQUEEZED[col];
  };

  /** La largeur d'une colonne, calculée en CSS pour n'avoir rien à mesurer. */
  const widthOf = (col: number) => {
    if (col < 0 || col > 3) return slat;
    if (col === 0) return `calc(var(--sq-hero) + var(--sq-room) * ${shareOf(0)})`;
    return `calc(var(--sq-room) * ${shareOf(col)})`;
  };

  const vars = {
    '--sq-h': size(height),
    '--sq-gap': size(gap),
    '--sq-slat-gap': size(slatGap),
    '--sq-radius': size(radius),
    '--sq-ms': `${ms}ms`,
    // easeOutExpo, la courbe sur laquelle la rangée glisse
    '--sq-ease': 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--sq-fill': accent,
    '--sq-on-fill': accentForeground,
    // Un bloc 16:9 fixe à la fois la carte ouverte et la taille à laquelle toute
    // image est dessinée, si bien qu'une image garde une seule échelle quelle
    // que soit l'étroitesse de sa carte.
    '--sq-hero': 'calc(var(--sq-h) * 16 / 9)',
    '--sq-room': `calc(100cqi - var(--sq-hero) - ${slats} * var(--sq-slat-gap) - 3 * var(--sq-gap) - ${slats} * ${slat})`,
  } as CSSProperties;

  const move = `translateX(calc(${slid} * (${slat} + var(--sq-gap))))`;

  return (
    <div
      className={cn('flex w-full flex-col', className)}
      // Les points de rupture et les largeurs ci-dessous lisent la largeur
      // donnée à ce carrousel, pas celle de la fenêtre.
      style={{
        containerType: 'inline-size',
        ...vars,
        ...style,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setHover(-1);
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      {...props}
    >
      {controls && count > 1 && (
        <div className="mb-4 flex justify-end gap-2">
          <Arrow back label="Précédent" onClick={() => step(-1)} />
          <Arrow label="Suivant" onClick={() => step(1)} />
        </div>
      )}

      <div className="w-full overflow-hidden" style={{ height: 'var(--sq-h)' }}>
        <div
          ref={strip}
          role="tablist"
          aria-label={label}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="flex h-full w-max"
          style={{
            transform: move,
            transition: still ? 'none' : `transform var(--sq-ms) var(--sq-ease)`,
          }}
        >
          {cards.map((card, place) => {
            const col = place + column;
            const slide = slides[card.slide];
            const front = col === 0;

            return (
              <button
                key={card.key}
                type="button"
                role="tab"
                id={`${ids}-tab-${card.key}`}
                aria-selected={front}
                aria-controls={`${ids}-panel`}
                aria-label={slide.title}
                tabIndex={front ? 0 : -1}
                onMouseMove={() => hoverGrow && setHover(col)}
                onClick={() => col > 0 && step(col)}
                className={cn(
                  'relative isolate h-full shrink-0 cursor-pointer overflow-hidden bg-q2-plate p-0',
                  'outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  'focus-visible:ring-[var(--sq-fill)] focus-visible:ring-offset-q2-canvas',
                  panelClassName,
                )}
                style={{
                  width: widthOf(col),
                  marginLeft:
                    place === 0 ? 0 : col < 4 ? 'var(--sq-gap)' : 'var(--sq-slat-gap)',
                  borderRadius: `min(var(--sq-radius), calc(${widthOf(col)} / 2))`,
                  transitionProperty: 'width, margin-left',
                  transitionDuration: still ? '0s' : 'var(--sq-ms)',
                  transitionTimingFunction: 'var(--sq-ease)',
                }}
              >
                <Picture slide={slide} />

                {slide.overlay && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-4 pt-16 @lg:p-6 @lg:pt-20"
                    style={{
                      opacity: front ? 1 : 0,
                      transition: `opacity var(--sq-ms) var(--sq-ease)`,
                      backgroundImage: 'linear-gradient(to top, rgb(0 0 0 / 0.55), transparent)',
                    }}
                  >
                    {slide.overlay}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`${ids}-panel`} role="tabpanel" aria-live="polite" className="mt-6 grid @xl:mt-7">
        {slides.map((slide, i) => {
          const shown = i === open;

          return (
            <div
              key={slide.id ?? i}
              aria-hidden={!shown}
              className={cn(
                'col-start-1 row-start-1 flex flex-col gap-4',
                '@xl:flex-row @xl:items-start @xl:justify-between @xl:gap-10',
              )}
              style={{
                opacity: shown ? 1 : 0,
                visibility: shown ? 'visible' : 'hidden',
                pointerEvents: shown ? 'auto' : 'none',
                transition: `opacity var(--sq-ms) var(--sq-ease), visibility var(--sq-ms)`,
              }}
            >
              <p className="max-w-[46rem] text-balance text-[15px] leading-[1.6] @lg:text-[17px]">
                <span className="text-q2-ink">{slide.title}</span>{' '}
                {slide.description && <span className="text-q2-body">{slide.description}</span>}
              </p>

              {slide.action && <Action slide={slide} shown={shown} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   pieces                                   */
/* -------------------------------------------------------------------------- */

/**
 * Dessinée à un bloc 16:9 fixe et centrée, jamais à la largeur de sa carte.
 * Laissé à lui-même, `object-fit: cover` suit le bord qui contraint: la hauteur
 * tant que la carte est une latte, la largeur une fois ouverte. L'image se
 * remettrait donc à l'échelle en plein glissement, et serait rééchantillonnée à
 * chaque image. Un seul bloc, une seule échelle: la carte ne change que ce
 * qu'on en voit.
 */
function Picture({ slide }: { slide: SqueezeSlide }) {
  const box = {
    width: 'var(--sq-hero)',
    minWidth: '100%',
  } as const;

  if (slide.image) {
    return (
      <img
        src={slide.image}
        alt={slide.imageAlt ?? ''}
        draggable={false}
        className="absolute inset-y-0 left-1/2 h-full max-w-none -translate-x-1/2 object-cover"
        style={box}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-0 left-1/2 -translate-x-1/2"
      style={{ background: slide.background, ...box }}
    />
  );
}

function Arrow({
  back = false,
  label,
  onClick,
}: {
  back?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid size-9 cursor-pointer place-items-center rounded-md',
        'bg-[var(--sq-fill)] text-[var(--sq-on-fill)]',
        'outline-none transition-opacity hover:opacity-85',
        'focus-visible:ring-2 focus-visible:ring-[var(--sq-fill)]',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-q2-canvas',
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path
          d={
            back
              ? 'M9.6 2.6 5.1 7.1h9.1v1.8H5.1l4.5 4.5-1.2 1.2-6-6L1.8 8l.6-.6 6-6 1.2 1.2Z'
              : 'M6.4 2.6l4.5 4.5H1.8v1.8h9.1l-4.5 4.5 1.2 1.2 6-6 .6-.6-.6-.6-6-6-1.2 1.2Z'
          }
        />
      </svg>
    </button>
  );
}

/** Le bouton sous le texte. Un lien quand il a un `href`, un bouton sinon. */
function Action({ slide, shown }: { slide: SqueezeSlide; shown: boolean }) {
  const inside = (
    <>
      {slide.action}
      <svg
        width="6"
        height="9"
        viewBox="0 0 6 9"
        fill="none"
        aria-hidden="true"
        className="transition-transform duration-200 group-hover/sq-action:translate-x-0.5"
      >
        <path
          d="M1.2 1 4.7 4.5 1.2 8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );

  const dress = cn(
    'group/sq-action inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md',
    'bg-[var(--sq-fill)] px-4 py-2.5 text-sm font-medium text-[var(--sq-on-fill)]',
    'outline-none transition-opacity hover:opacity-85',
    'focus-visible:ring-2 focus-visible:ring-[var(--sq-fill)]',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-q2-canvas',
  );

  if (slide.href) {
    return (
      <a
        href={slide.href}
        target={slide.target}
        rel={slide.target === '_blank' ? 'noreferrer' : undefined}
        tabIndex={shown ? 0 : -1}
        onClick={slide.onAction}
        className={dress}
      >
        {inside}
      </a>
    );
  }

  return (
    <button type="button" tabIndex={shown ? 0 : -1} onClick={slide.onAction} className={dress}>
      {inside}
    </button>
  );
}

export default SqueezeCarousel;
