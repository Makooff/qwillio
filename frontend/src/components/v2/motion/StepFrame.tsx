import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { frameJourney, framePath, type FrameBox } from './frameJourney';
import { prefersReducedMotion } from './reducedMotion';
import { onScrollFrame, sceneAt, sceneStarted } from './sceneProgress';

/**
 * Un cadre arrondi posé derrière les étapes, qui passe de l'une à l'autre au
 * scroll en rapetissant par son coin de sortie puis en regrandissant depuis le
 * coin d'entrée de la suivante. Cette déformation par les coins est le cœur de
 * l'animation : on la conserve intégralement.
 *
 * Les boîtes sont MESURÉES dans le DOM (`[data-step-frame]`), jamais écrites en
 * dur : les étapes n'ont pas la même hauteur selon la langue et la largeur de
 * l'écran. Un `ResizeObserver` reprend les mesures quand la mise en page bouge.
 *
 * Le trajet vit dans l'attribut `d` et non dans un `transform`, parce que la
 * TAILLE change en chemin et qu'un `scale` sur un tracé étirerait aussi son
 * filet. Le tracé est recalculé, donc le filet garde son épaisseur du début à
 * la fin.
 *
 * L'avancée vient de `sceneProgress`, la même règle que celle qui allume
 * l'étape courante : un scrub autonome donnerait un cadre en avance sur le
 * texte.
 *
 * La bulle est PLEINE (retour utilisateur) : plus de masque qui découpait un
 * trou devant le panneau d'en face — on voyait la surface trouée, ce qui se
 * lisait comme un artefact. Le cadre traverse donc la scène sans s'effacer.
 *
 * En reduced-motion le composant disparaît : c'est du décor, il n'a rien à dire
 * à qui coupe les animations.
 */
export default function StepFrame({
  /** Sélecteur des éléments à encadrer, dans le conteneur parent. */
  scope,
  radius = 22,
  /**
   * Marge autour de la boîte encadrée, en pixels.
   *
   * > 0 fait respirer le cadre autour du texte, comme une bulle qui désigne
   *   l'étape au lieu de l'épouser au ras. C'est cette marge qui donne le même
   *   espacement que les autres blocs de texte fixes (retour utilisateur).
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
  }, [pad, radius, scope]);

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

    return onScrollFrame(() => {
      /* Tant que la colonne de titre descend encore, le cadre reste posé sur
         la première étape : il ne part pas avant que la scène commence. */
      const raw = sceneStarted(aside) ? sceneAt(nodes) : 0;
      const at = Math.max(0, Math.min(last, raw));
      const i = Math.min(last - 1, Math.floor(at));
      /* La déformation par les coins, intégralement conservée : le cadre
         rapetisse par son coin de sortie, traverse, regrandit depuis le coin
         d'entrée de la suivante. */
      const { path: d } = frameJourney({
        from: boxes[i],
        to: boxes[i + 1],
        radius,
        progress: at - i,
      });
      path.setAttribute('d', d);
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
      style={{ overflow: 'visible' }}
      className={`pointer-events-none absolute left-0 top-0 z-0 ${className}`}
    >
      <path
        ref={pathRef}
        data-frame-path
        d={boxesRef.current[0] ? framePath(boxesRef.current[0], radius) : ''}
        /* Même matière que le panneau d'en face, un `CardV2` en `bg-q2-band`.
           PLEINE, sans masque ni contour : un aplat opaque. La déformation par
           les coins est le tracé lui-même, calculé par `frameJourney`. */
        fill="rgb(var(--q2-band))"
      />
    </svg>
  );
}
