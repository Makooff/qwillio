import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { framePath, frameJourney, type FrameBox } from './frameJourney';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/**
 * Un cadre arrondi posé derrière les étapes, qui passe de l'une à l'autre au
 * scroll en se déformant par les coins.
 *
 * Les boîtes sont MESURÉES dans le DOM (`[data-step-frame]`), jamais écrites en
 * dur: les étapes n'ont pas la même hauteur selon la langue et la largeur de
 * l'écran, et un cadre calé sur des coordonnées fixes se décalerait au premier
 * texte plus long. Un `ResizeObserver` reprend les mesures quand la mise en
 * page bouge.
 *
 * Le trajet vit dans l'attribut `d`, pas dans un `transform`: c'est la
 * différence entre une forme qu'on TRANSPORTE et une forme qui SE DÉPLACE.
 * Une translation garderait la silhouette rigide, or c'est précisément la
 * déformation qui est demandée.
 *
 * En reduced-motion le composant disparaît: c'est du décor, il n'a rien à dire
 * à qui coupe les animations.
 */
export default function StepFrame({
  /** Sélecteur des éléments à encadrer, dans le conteneur parent. */
  scope,
  radius = 22,
  className = '',
}: {
  scope: React.RefObject<HTMLElement | null>;
  radius?: number;
  className?: string;
}) {
  const [reduced] = useState(prefersReducedMotion);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const boxesRef = useRef<FrameBox[]>([]);

  /* Les boîtes sont relatives au conteneur, pas à la fenêtre: le cadre est
     posé dedans en `absolute`, il doit parler le même repère. */
  const measure = useCallback(() => {
    const root = scope.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    if (rootBox.width === 0) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-step-frame]'));
    boxesRef.current = nodes.map(node => {
      const b = node.getBoundingClientRect();
      return { x: b.left - rootBox.left, y: b.top - rootBox.top, w: b.width, h: b.height };
    });
    setSize({ w: rootBox.width, h: rootBox.height });
  }, [scope]);

  useLayoutEffect(() => {
    if (reduced) return;
    measure();
    const root = scope.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => ro.disconnect();
  }, [measure, reduced, scope]);

  useEffect(() => {
    const root = scope.current;
    const path = pathRef.current;
    if (reduced || !root || !path || !size) return;
    const boxes = boxesRef.current;
    if (boxes.length < 2) return;

    const ctx = gsap.context(() => {
      /* Une seule valeur pilotée par le scroll: la position CONTINUE dans la
         liste (0 = première étape, n-1 = dernière). Un trigger par étape
         donnerait des sauts au raccord, là où une seule valeur donne un trajet
         d'un bout à l'autre. */
      const state = { at: 0 };
      const last = boxes.length - 1;

      const draw = () => {
        const at = Math.max(0, Math.min(last, state.at));
        const i = Math.min(last - 1, Math.floor(at));
        const local = at - i;
        path.setAttribute('d', frameJourney({
          from: boxes[i],
          to: boxes[i + 1],
          radius,
          progress: local,
        }));
      };

      draw();

      gsap.to(state, {
        at: last,
        ease: 'none',
        onUpdate: draw,
        scrollTrigger: {
          trigger: root,
          /* Le cadre se pose sur la première étape quand elle arrive au tiers
             haut, et a fini son voyage quand la dernière y est: le trajet suit
             la lecture, il ne la précède pas. */
          start: 'top 62%',
          end: 'bottom 72%',
          scrub: 0.7,
        },
      });
    }, root);

    return () => ctx.revert();
  }, [radius, reduced, size, scope]);

  if (reduced || !size) return null;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      className={`pointer-events-none absolute left-0 top-0 ${className}`}
    >
      <path
        ref={pathRef}
        d={boxesRef.current[0] ? framePath(boxesRef.current[0], radius) : ''}
        fill="rgba(122, 95, 255, 0.07)"
        stroke="rgba(122, 95, 255, 0.22)"
        strokeWidth={1}
      />
    </svg>
  );
}
