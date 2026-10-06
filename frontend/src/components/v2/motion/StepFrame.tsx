import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { framePath, type FrameBox } from './frameJourney';
import { prefersReducedMotion } from './reducedMotion';
import { onScrollFrame, sceneAt, sceneStarted } from './sceneProgress';

/**
 * Un cadre arrondi posé derrière les étapes.
 *
 * Comportement :
 * - Le cadre **évite les coins des cartes d'en face** : un masque (`[data-step-mask]`)
 *   le découpe dans la bande autour de chaque panneau voisin, si bien qu'il
 *   disparaît avant d'en frôler le bord et réapparaît de l'autre côté.
 * - Il est **épinglé sur l'étape courante** : il ne suit pas le scroll en
 *   continu ; il reste posé et glisse (lissé) vers la suivante uniquement au
 *   franchissement du seuil.
 *
 * Les boîtes et les trous du masque sont MESURÉS dans le DOM, jamais écrits en
 * dur. Un `ResizeObserver` reprend les mesures quand la mise en page bouge.
 *
 * En reduced-motion le composant disparaît : c'est du décor.
 */
export default function StepFrame({
  /** Sélecteur des éléments à encadrer, dans le conteneur parent. */
  scope,
  radius = 22,
  /**
   * Marge autour de la boîte encadrée, en pixels.
   *
   * > 0 fait respirer le cadre autour du texte, comme une bulle qui désigne
   *   l'étape au lieu de l'épouser au ras.
   */
  pad = 0,
  /**
   * Rayon d'effacement autour des blocs marqués `[data-step-mask]`, en pixels.
   *
   * Le cadre traverse la scène en diagonale et frôle les panneaux de la colonne
   * d'en face : le masque l'efface dans cette bande, si bien qu'il disparaît
   * avant d'arriver au bord d'une carte et réapparaît de l'autre côté.
   *
   * La valeur est RABOTÉE à la mesure pour ne jamais mordre sur une étape.
   */
  maskPad = 76,
  className = '',
}: {
  scope: React.RefObject<HTMLElement | null>;
  radius?: number;
  pad?: number;
  maskPad?: number;
  className?: string;
}) {
  const [reduced] = useState(prefersReducedMotion);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [holes, setHoles] = useState<FrameBox[]>([]);
  const [holeRadius, setHoleRadius] = useState(0);
  const [ready, setReady] = useState(false);
  const boxesRef = useRef<FrameBox[]>([]);
  const maskId = useId();
  /* Étape sur laquelle le cadre est posé, pour l'épingle lissée. */
  const currentStep = useRef(0);
  const targetStep = useRef(0);
  const rafId = useRef(0);

  const measure = useCallback(() => {
    const root = scope.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    if (rootBox.width === 0) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-step-frame]'));
    boxesRef.current = nodes.map(node => {
      const b = node.getBoundingClientRect();
      return {
        x: b.left - rootBox.left - pad,
        y: b.top - rootBox.top - pad,
        w: b.width + pad * 2,
        h: b.height + pad * 2,
      };
    });

    /* L'écart le plus grand des deux écarts d'axes : deux rectangles alignés ne
       se recouvrent que si l'on dépasse l'écart sur les DEUX axes. Rogner sur ce
       maximum est la borne exacte. */
    const gap = (a: FrameBox, b: FrameBox) =>
      Math.max(
        Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)),
        Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)),
      );

    const masked = Array.from(root.querySelectorAll<HTMLElement>('[data-step-mask]')).map(node => {
      const b = node.getBoundingClientRect();
      return { x: b.left - rootBox.left, y: b.top - rootBox.top, w: b.width, h: b.height };
    });

    let grow = maskPad;
    for (const m of masked) {
      for (const s of boxesRef.current) grow = Math.min(grow, gap(m, s) - 4);
    }
    grow = Math.max(0, grow);
    setHoles(masked.map(b => ({ x: b.x - grow, y: b.y - grow, w: b.w + grow * 2, h: b.h + grow * 2 })));
    setHoleRadius(radius + grow);

    setSize({ w: rootBox.width, h: rootBox.height });
  }, [maskPad, pad, radius, scope]);

  useLayoutEffect(() => {
    if (reduced) return;
    if (!scope.current) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(scope.current);
    return () => ro.disconnect();
  }, [measure, ready, reduced, scope]);

  useEffect(() => {
    const root = scope.current;
    const path = pathRef.current;
    if (reduced || !root || !path || !size) return;
    const boxes = boxesRef.current;
    if (boxes.length < 2) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-step-frame]'));
    const aside = root.querySelector<HTMLElement>('[data-scene-aside]');
    const last = boxes.length - 1;

    const ease = (t: number) => t * t * (3 - 2 * t);

    const drawAt = (step: number) => {
      path.setAttribute('d', framePath(boxes[step], radius));
    };

    /* Épingle lissée : le cadre ne suit pas le scroll, il glisse vers l'étape
       cible (lissé) au franchissement du seuil, une seule boucle raf. */
    const tweenTo = (target: number) => {
      if (targetStep.current === target) return;
      targetStep.current = target;
      const fromStep = currentStep.current;
      const start = performance.now();
      const DURATION = 420;

      const tick = (now: number) => {
        const t = Math.max(0, Math.min(1, (now - start) / DURATION));
        const a = boxes[fromStep];
        const b = boxes[target];
        const box: FrameBox = {
          x: a.x + (b.x - a.x) * ease(t),
          y: a.y + (b.y - a.y) * ease(t),
          w: a.w + (b.w - a.w) * ease(t),
          h: a.h + (b.h - a.h) * ease(t),
        };
        path.setAttribute('d', framePath(box, radius));
        if (t < 1) {
          rafId.current = requestAnimationFrame(tick);
        } else {
          currentStep.current = target;
          drawAt(target);
        }
      };
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(tick);
    };

    const unsub = onScrollFrame(() => {
      const raw = sceneStarted(aside) ? sceneAt(nodes) : 0;
      const at = Math.max(0, Math.min(last, raw));
      /* Épinglé : partie entière seulement. Pas de mouvement au scroll. */
      const step = Math.floor(at);
      if (step !== currentStep.current) tweenTo(step);
    });

    currentStep.current = 0;
    drawAt(0);

    return () => {
      unsub();
      cancelAnimationFrame(rafId.current);
    };
  }, [radius, reduced, size, scope]);

  if (reduced || !size) return null;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      style={{ overflow: 'visible' }}
      className={`pointer-events-none absolute left-0 top-0 z-0 ${className}`}
    >
      <defs>
        {/* ARRONDIR LES ANGLES CRÉÉS PAR LE MASQUE, par la recette du « goo » :
            flouter, puis remonter l'alpha à la verticale. Le flou émousse tous
            les sommets (convexes comme concaves), et le seuil rend la silhouette
            à nouveau franche. Ce n'est pas un dégradé : la sortie est un aplat à
            bord net, avec des coins ronds. L'ordre compte : le filtre est porté
            par le GROUPE et le masque par le tracé, sinon la coupe redeviendrait
            anguleuse. */}
        <filter
          id={`${maskId}-round`}
          x={-400}
          y={-400}
          width={size.w + 800}
          height={size.h + 800}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={11} result="soft" />
          <feColorMatrix
            in="soft"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -13"
          />
        </filter>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-400}
          y={-400}
          width={size.w + 800}
          height={size.h + 800}
        >
          <rect x={-400} y={-400} width={size.w + 800} height={size.h + 800} fill="#fff" />
          {/* Coupe NETTE (le goo arrondit les angles ailleurs, pas ici). */}
          {holes.map(h => (
            <rect
              key={`${h.x},${h.y}`}
              x={h.x}
              y={h.y}
              width={h.w}
              height={h.h}
              rx={holeRadius}
              fill="#000"
            />
          ))}
        </mask>
      </defs>
      <g filter={`url(#${maskId}-round)`}>
        <path
          mask={`url(#${maskId})`}
          ref={pathRef}
          data-frame-path
          d={boxesRef.current[0] ? framePath(boxesRef.current[0], radius) : ''}
          /* Même matière que le panneau d'en face, un `CardV2` en `bg-q2-band`.
             PLEINE, sans contour : la découpe vient du seul masque. */
          fill="rgb(var(--q2-band))"
        />
      </g>
    </svg>
  );
}
