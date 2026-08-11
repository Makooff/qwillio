import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { framePath, frameJourney, type FrameBox } from './frameJourney';
import { prefersReducedMotion } from './reducedMotion';
import { onScrollFrame, sceneAt, sceneStarted } from './sceneProgress';

/**
 * Un cadre arrondi posé derrière les étapes, qui passe de l'une à l'autre au
 * scroll en rapetissant par son coin de sortie puis en regrandissant depuis le
 * coin d'entrée de la suivante.
 *
 * Les boîtes sont MESURÉES dans le DOM (`[data-step-frame]`), jamais écrites en
 * dur: les étapes n'ont pas la même hauteur selon la langue et la largeur de
 * l'écran, et un cadre calé sur des coordonnées fixes se décalerait au premier
 * texte plus long. Un `ResizeObserver` reprend les mesures quand la mise en
 * page bouge.
 *
 * Le trajet vit dans l'attribut `d` et non dans un `transform`, parce que la
 * TAILLE change en chemin et qu'un `scale` sur un tracé étirerait aussi son
 * filet: un cadre qui rapetisse aurait un contour plus fin au milieu du trajet.
 * Le tracé est recalculé, donc le filet garde son épaisseur du début à la fin.
 * La silhouette, elle, reste un rectangle arrondi tout du long: la déformation
 * qu'il y avait ici rendait le passage mou (retour utilisateur).
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
  /**
   * Rayon d'effacement autour des blocs marqués `[data-step-mask]`, en pixels.
   *
   * Le cadre traverse la scène en diagonale et frôle les panneaux de la colonne
   * d'en face: on voyait la forme passer contre eux, ce qui donne un mouvement
   * qui « bave » sur les cartes voisines (retour utilisateur, qui demande deux
   * centimètres). Le masque l'efface dans cette bande, si bien qu'il disparaît
   * avant d'arriver au bord d'une carte et réapparaît de l'autre côté.
   *
   * La valeur est RABOTÉE à la mesure pour ne jamais mordre sur une étape: si
   * l'écart réel entre un panneau et l'étape la plus proche est plus petit, le
   * masque rétrécit d'autant. Sans cela, le cadre au repos se ferait rogner un
   * bord sur les écrans étroits, où la gouttière se resserre.
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
  const [ready, setReady] = useState(false);
  const boxesRef = useRef<FrameBox[]>([]);
  const maskId = useId();

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
    /* LES TROUS DU MASQUE, mesurés comme les étapes et dans le même repère.
       L'écart utilisé est le PLUS GRAND des deux écarts d'axes: deux rectangles
       alignés sur les axes ne se recouvrent que si l'on dépasse l'écart sur les
       DEUX axes à la fois. Rogner sur ce maximum est donc la borne exacte, et
       non une marge de sécurité choisie au jugé. */
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

    setSize({ w: rootBox.width, h: rootBox.height });
  }, [maskPad, pad, scope]);

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
      /* `overflow: visible`: avec une marge, le cadre déborde du conteneur
         mesuré et un SVG le rognerait par défaut. */
      style={{ overflow: 'visible' }}
      /* z-0 explicite: le cadre est le FOND des etapes, qui montent en z-10.
         Sans ordre ecrit, un element positionne passe au-dessus de ses freres
         statiques, et un fond opaque masque alors tout le texte. */
      className={`pointer-events-none absolute left-0 top-0 z-0 ${className}`}
    >
      {/* `userSpaceOnUse`, et une zone plus large que le SVG: par défaut un
          masque se cale sur la boîte de son utilisateur avec 10 % de marge, ce
          qui couperait le cadre quand il déborde du conteneur mesuré (`pad`). */}
      <defs>
        <filter id={`${maskId}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={16} />
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
          {/* Les trous sont FLOUS, sinon le masque tranche le cadre net et l'on
              voit un rectangle coupé à l'équerre au lieu d'une forme qui s'en
              va. Le flou ne porte que sur le masque: la forme, elle, reste
              nette là où elle est visible. */}
          <g filter={`url(${`#${maskId}-soft`})`}>
            {holes.map(h => (
              <rect
                key={`${h.x},${h.y}`}
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                rx={radius}
                fill="#000"
              />
            ))}
          </g>
        </mask>
      </defs>
      <path
        mask={`url(#${maskId})`}
        ref={pathRef}
        data-frame-path
        d={boxesRef.current[0] ? framePath(boxesRef.current[0], radius) : ''}
        /* MÊME matière que le panneau d'en face, qui est un `CardV2` en
           `bg-q2-band` cerné de `q2-plate`. Le cadre était en voile mauve, si
           bien que les deux colonnes d'une même ligne n'avaient pas le même
           fond (retour utilisateur). Il ne désigne plus l'étape par sa couleur
           mais par sa seule présence. */
        fill="rgb(var(--q2-band))"
        stroke="rgb(var(--q2-plate))"
        strokeWidth={1}
      />
    </svg>
  );
}
