import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Décor géométrique, d'après les compositions fournies par l'utilisateur.
 *
 * Elles sont REDESSINÉES en SVG plutôt qu'embarquées en PNG: ce sont des
 * aplats de demi-disques, donc quelques centaines d'octets au lieu de plusieurs
 * mégaoctets, nettes à n'importe quelle taille, et surtout tenues par nos
 * violets de marque au lieu des couleurs du fichier d'origine.
 *
 * DEUX formes, et deux seulement (demande utilisateur): la colonne de
 * demi-disques alternés, et le grand disque pâle qui déborde du cadre. Les
 * compositions composites d'avant (`twin`, `twinMirror`, `quarters`) sont
 * parties: quatre motifs différents sur une même page, ce n'est plus un motif,
 * c'est une collection.
 *
 * Elles sont DROITES (demande utilisateur): plus de `rotate` au montage, et
 * plus de respiration en rotation lente. Un demi-disque incliné n'est plus un
 * demi-disque, c'est une forme quelconque; c'est l'aplomb qui fait lire la
 * géométrie. Il ne reste donc qu'un seul mouvement, la parallaxe, qui est
 * exactement ce qui a été demandé.
 *
 * Rien ne bouge en reduced-motion, où la couche disparaît: c'est du décor, il
 * n'a rien à dire à qui coupe les animations. */

/* Les valeurs du décor viennent des COULEURS DE MARQUE (demande utilisateur),
   plus des paliers pris sur le dégradé qui va de l'indigo au violet. Les
   teintes relevées dans les fichiers d'origine (#5B4BF5, #7B6FF7, #BDB6FD)
   étaient proches sans être les nôtres, et un décor qui frôle la marque sans
   la toucher se lit comme une erreur d'impression.

   Les deux bornes sont les jetons de `v2.css`, écrits en `var()` pour rester
   liés: si la marque bouge, le décor suit.

   Les paliers intermédiaires sont CALCULÉS entre l'indigo `#7A5FFF` et le
   violet `#CD6BFB`, pas choisis à l'oeil, c'est ce qui garantit qu'ils tombent
   sur le dégradé et non à côté:
     25 % → #8F62FE   50 % → #A465FD   75 % → #B868FC
   Les deux pâles sont le `lift` de marque (#B9A8FF) éclairci vers le blanc,
   à 35 % et 62 %: la même famille, assez claire pour rester du fond. */
const DEEP = 'var(--q2-deep)';      /* #7349FE */
const MID = '#A465FD';              /* mi-chemin indigo → violet */
const VIOLET = 'var(--q2-violet)';  /* #CD6BFB */
const PALE = '#D2C6FF';
const PALEST = '#E4DEFF';

export type ShapeKind = 'column' | 'disc';

/** Ratio hauteur/largeur de chaque composition, pour réserver la bonne place. */
const RATIO: Record<ShapeKind, number> = {
  column: 2,
  disc: 1,
};

function Shape({ kind }: { kind: ShapeKind }) {
  switch (kind) {
    /* La COLONNE: quatre demi-disques empilés, ventre en haut puis en bas.
       Les valeurs descendent le DÉGRADÉ de la marque dans l'ordre, du plus
       pâle au violet en passant par le profond et le mi-chemin: c'est cet
       ordre qui fait lire une progression plutôt qu'un empilement. Prises au
       hasard, les mêmes quatre teintes donneraient quatre rondelles. */
    case 'column':
      return (
        <svg viewBox="0 0 100 200" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0 50a50 50 0 0 1 100 0Z" fill={PALEST} />
          <path d="M0 50a50 50 0 0 0 100 0Z" fill={DEEP} />
          <path d="M0 150a50 50 0 0 1 100 0Z" fill={MID} />
          <path d="M0 150a50 50 0 0 0 100 0Z" fill={VIOLET} />
        </svg>
      );

    /* Le DISQUE: un rond pâle plein, posé pour déborder du cadre. Il ne porte
       aucun détail, et c'est son rôle: il remplit un vide sans y ajouter de
       lecture, là où la colonne, elle, attire l'oeil. */
    case 'disc':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="50" fill={PALE} />
        </svg>
      );
  }
}

export interface DriftedShape {
  kind: ShapeKind;
  /** Position en pourcentage de la scène, coin haut-gauche. */
  x: string;
  y: string;
  /** Largeur en pixels; la hauteur suit le ratio de la composition. */
  size: number;
  /** Amplitude de la parallaxe, en pixels. Négatif = remonte au scroll. */
  drift?: number;
  opacity?: number;
}

export default function ShapeDrift({
  shapes,
  className = '',
}: {
  shapes: DriftedShape[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>('[data-drift]');
      items.forEach((el) => {
        const amount = Number(el.dataset.driftAmount ?? 120);
        /* Parallaxe: c'est le mouvement que l'utilisateur a demandé, il est
           donc franc (jusqu'à deux cents pixels) plutôt que suggéré. */
        gsap.to(el, {
          y: amount,
          ease: 'none',
          /* `scrub: 1` comme la fenêtre du hero: le scrub est le lissage, et
             deux valeurs différentes sur la même page se voient — les formes
             rattrapaient le doigt plus vite que la capture, ce qui donnait
             deux vitesses de glissement dans le même mouvement. */
          scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 },
        });
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  if (reduced) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {shapes.map((s, i) => (
        <div
          key={`${s.kind}-${i}`}
          data-drift
          data-drift-amount={s.drift ?? 120}
          className="absolute"
          style={{
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size * RATIO[s.kind],
            opacity: s.opacity ?? 0.4,
            willChange: 'transform',
          }}
        >
          <Shape kind={s.kind} />
        </div>
      ))}
    </div>
  );
}
