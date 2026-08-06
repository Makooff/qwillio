import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { framePath, frameJourney, type FrameBox } from './frameJourney';
import { prefersReducedMotion } from './reducedMotion';
import { onScrollFrame, sceneAt, sceneStarted } from './sceneProgress';

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
 * L'avancée vient de `sceneProgress`, la même règle que celle qui allume
 * l'étape courante: un scrub autonome donnait un cadre en avance de deux
 * étapes sur le texte, et deux animations qui racontent la même chose ne
 * peuvent pas la raconter différemment.
 *
 * En reduced-motion le composant disparaît: c'est du décor, il n'a rien à dire
 * à qui coupe les animations.
 */
export default function StepFrame({
  /** Sélecteur des éléments à encadrer, dans le conteneur parent. */
  scope,
  radius = 22,
  /**
   * Marge autour de la boîte encadrée.
   *
   * À zéro le cadre épouse l'élément, ce qui le fait disparaître derrière un
   * panneau opaque. Une marge le fait ressortir tout autour, comme un halo qui
   * désigne l'étape en cours.
   */
  pad = 0,
  className = '',
}: {
  scope: React.RefObject<HTMLElement | null>;
  radius?: number;
  pad?: number;
  className?: string;
}) {
  const [reduced] = useState(prefersReducedMotion);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
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
      return {
        x: b.left - rootBox.left - pad,
        y: b.top - rootBox.top - pad,
        w: b.width + pad * 2,
        h: b.height + pad * 2,
      };
    });
    setSize({ w: rootBox.width, h: rootBox.height });
  }, [pad, scope]);

  useLayoutEffect(() => {
    if (reduced) return;

    /* La ref du conteneur appartient au PARENT, et React la pose après avoir
       exécuté les effets de mise en page de ses enfants: à la première passe,
       `scope.current` est encore nul. Sans cette reprise à la frame suivante,
       la mesure ne se faisait jamais, `size` restait nul, et le composant
       rendait `null` — le cadre n'a jamais été à l'écran. */
    if (!scope.current) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    /* Les images et polices arrivent après le premier rendu et déplacent les
       étapes: sans cet observateur, le cadre resterait calé sur des positions
       périmées. */
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

    return onScrollFrame(() => {
      /* Tant que la colonne de titre descend encore, le cadre reste posé sur
         la première étape: il ne part pas avant que la scène commence. */
      const raw = sceneStarted(aside) ? sceneAt(nodes) : 0;
      const at = Math.max(0, Math.min(last, raw));
      const i = Math.min(last - 1, Math.floor(at));
      path.setAttribute('d', frameJourney({
        from: boxes[i],
        to: boxes[i + 1],
        radius,
        progress: at - i,
      }));
    });
  }, [radius, reduced, size, scope]);

  if (reduced || !size) return null;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      /* `overflow: visible`: avec une marge, le cadre déborde du conteneur
         mesuré et un SVG le rognerait par défaut. */
      style={{ overflow: 'visible' }}
      className={`pointer-events-none absolute left-0 top-0 ${className}`}
    >
      <path
        ref={pathRef}
        data-frame-path
        d={boxesRef.current[0] ? framePath(boxesRef.current[0], radius) : ''}
        fill="rgba(122, 95, 255, 0.07)"
        stroke="rgba(122, 95, 255, 0.22)"
        strokeWidth={1}
      />
    </svg>
  );
}
