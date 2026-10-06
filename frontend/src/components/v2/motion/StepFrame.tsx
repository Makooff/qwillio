import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { framePath, type FrameBox } from './frameJourney';
import { prefersReducedMotion } from './reducedMotion';
import { onScrollFrame, sceneAt, sceneStarted } from './sceneProgress';

/**
 * Un cadre arrondi posé derrière les étapes.
 *
 * Comportement (revert, retour utilisateur) :
 * - Le cadre est **plein** : plus de masque qui découpe un trou devant le
 *   panneau d'en face. Avant, on voyait la bulle trouée en pleine surface, ce
 *   qui se lisait comme un artefact.
 * - Il est **épinglé sur l'étape courante** : pendant qu'on scrolle dans une
 *   étape il ne bouge pas, et il glisse (lissé) vers la suivante uniquement au
 *   franchissement du seuil. Plus de scrub continu qui le faisait suivre le
 *   scroll millimètre par millimètre.
 *
 * Les boîtes restent MESURÉES dans le DOM (`[data-step-frame]`), jamais écrites
 * en dur : les étapes n'ont pas la même hauteur selon la langue et la largeur.
 * Un `ResizeObserver` reprend les mesures quand la mise en page bouge.
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
  /** Étape sur laquelle le cadre est posé, et avancement du tween vers elle. */
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

    /* Tween lissé entre deux positions de bulle. Easing smoothstep : démarrage
       et arrêt amortis, pas de secousse au franchissement du seuil. */
    const ease = (t: number) => t * t * (3 - 2 * t);

    const drawAt = (step: number) => {
      path.setAttribute('d', framePath(boxes[step], radius));
    };

    /* Anime le `d` de la bulle vers l'étape cible en douceur, indépendamment du
       scroll. Une seule boucle raf à la fois. */
    const tweenTo = (target: number) => {
      if (targetStep.current === target) return;
      targetStep.current = target;
      const fromStep = currentStep.current;
      const start = performance.now();
      const DURATION = 420;

      const tick = (now: number) => {
        const t = Math.max(0, Math.min(1, (now - start) / DURATION));
        /* Interpole les boîtes entières, pas seulement `d` : on garde un
           rectangle arrondi pendant tout le trajet, comme avant. */
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
      /* Épinglé : on ne garde que la partie entière. Le cadre ne bouge qu'au
         franchissement de l'étape, puis glisse vers la suivante. */
      const step = Math.floor(at);
      if (step !== currentStep.current) tweenTo(step);
    });

    /* Position de départ au premier rendu. */
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
      <path
        ref={pathRef}
        data-frame-path
        d={boxesRef.current[0] ? framePath(boxesRef.current[0], radius) : ''}
        /* Même matière que le panneau d'en face, un `CardV2` en `bg-q2-band`.
           Aucun contour, aucun masque : un aplat plein, opaque, bien centré. */
        fill="rgb(var(--q2-band))"
      />
    </svg>
  );
}
