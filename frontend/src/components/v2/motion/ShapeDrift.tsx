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
 * DIX compositions, une par image fournie (demande utilisateur), et une de
 * chaque sur la page d'accueil. Les autres pages en reçoivent une ou deux,
 * toujours différentes: le reproche portait sur la répétition, pas sur le
 * nombre.
 * Elles forment une seule famille, pas une collection: le même demi-disque
 * partout, décliné en colonne, en paire, en disque plein, en disque coupé, et
 * en compositions carrées. Deux motifs étrangers se disputent une page; dix
 * variations d'un même geste se répondent.
 *
 * Elles sont DROITES (demande utilisateur): plus de `rotate` au montage, et
 * plus de respiration en rotation lente. Un demi-disque incliné n'est plus un
 * demi-disque, c'est une forme quelconque; c'est l'aplomb qui fait lire la
 * géométrie. Il ne reste donc qu'un seul mouvement, la parallaxe, qui est
 * exactement ce qui a été demandé.
 *
 * Rien ne bouge en reduced-motion, où la couche disparaît: c'est du décor, il
 * n'a rien à dire à qui coupe les animations. */

/* La gamme du LOGO, et rien d'autre (demande utilisateur).
   Les quatre jetons de marque sont pris tels quels, en `var()` pour rester
   liés: si la marque bouge, le décor suit le même jour. Les paliers que
   j'avais calculés entre l'indigo et le violet sont partis avec: ils tombaient
   bien sur le dégradé, mais ils ajoutaient des teintes que le logo ne porte
   pas, et une gamme se reconnaît autant à ce qu'elle exclut.
   `PALEST` est le `lift` éclairci vers le blanc, la valeur qu'il faut pour
   qu'un aplat reste du FOND et non une forme de plus. Il a son jeton lui aussi
   (`--q2-lift-soft`, signalé en revue): une teinte écrite en dur dans un
   composant est une teinte que personne ne retrouvera le jour où la marque
   bougera. */
const DEEP = 'var(--q2-deep)';      /* #7349FE, le cercle de gauche du logo */
const MID = 'var(--q2-indigo)';     /* #7A5FFF, l'indigo de marque */
const VIOLET = 'var(--q2-violet)';  /* #CD6BFB, le cercle de droite */
const PALE = 'var(--q2-lift)';      /* #B9A8FF, le mauve clair de marque */
const PALEST = 'var(--q2-lift-soft)';/* le lift éclairci, jeton de v2.css */

export type ShapeKind =
  | 'column' | 'columnAlt' | 'pair' | 'disc' | 'discCut'
  | 'twin' | 'twinMirror' | 'quarters' | 'quartersMirror' | 'core';

/** Ratio hauteur/largeur de chaque composition, pour réserver la bonne place. */
const RATIO: Record<ShapeKind, number> = {
  column: 2,
  columnAlt: 2,
  pair: 1,
  disc: 1,
  discCut: 1,
  twin: 1,
  twinMirror: 1,
  quarters: 1.34,
  quartersMirror: 1.34,
  core: 1,
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

    /* La colonne RETOURNÉE. Même famille, rythme inverse: le ventre part vers
       le bas, et les valeurs remontent le dégradé au lieu de le descendre.
       C'est ce qui casse la répétition (retour utilisateur) sans introduire un
       second motif: deux instances d'une même idée se répondent, deux motifs
       étrangers se disputent. */
    case 'columnAlt':
      return (
        <svg viewBox="0 0 100 200" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0 50a50 50 0 0 0 100 0Z" fill={VIOLET} />
          <path d="M0 50a50 50 0 0 1 100 0Z" fill={MID} />
          <path d="M0 150a50 50 0 0 0 100 0Z" fill={DEEP} />
          <path d="M0 150a50 50 0 0 1 100 0Z" fill={PALEST} />
        </svg>
      );

    /* La PAIRE: la colonne réduite à deux disques, donc carrée. Elle sert les
       sections courtes, où la colonne entière ne tiendrait pas sans être
       tranchée par le bord. */
    case 'pair':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0 50a50 50 0 0 1 100 0Z" fill={PALE} />
          <path d="M0 50a50 50 0 0 0 100 0Z" fill={DEEP} />
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

    /* Le disque COUPÉ: le même rond, dont la moitié droite passe au violet.
       La coupe est verticale et pile au centre, comme la couture des
       compositions d'origine. */
    case 'discCut':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="50" fill={PALEST} />
          <path d="M50 0a50 50 0 0 1 0 100Z" fill={MID} />
        </svg>
      );

    /* Les trois compositions carrées d'origine, rétablies (demande
       utilisateur: une de chaque). Elles sont redessinées à l'identique, mais
       REPEINTES sur le dégradé de marque comme le reste de la famille: c'était
       tout l'objet du passage aux jetons. */

    /* Grand demi-disque pâle à gauche, demi-disque profond à droite, et un
       petit demi-disque très clair posé sur la couture. */
    case 'twin':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <path d="M50 0a50 50 0 0 0 0 100Z" fill={PALE} />
          <path d="M56 0a50 50 0 0 1 0 100Z" fill={DEEP} />
          <path d="M50 25a25 25 0 0 1 0 50Z" fill={PALEST} />
          <path d="M50 25a25 25 0 0 0 0 50Z" fill={PALEST} />
        </svg>
      );

    /* La même, retournée: le plein passe à gauche. */
    case 'twinMirror':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <path d="M44 0a50 50 0 0 0 0 100Z" fill={VIOLET} />
          <path d="M50 0a50 50 0 0 1 0 100Z" fill={PALE} />
          <path d="M50 25a25 25 0 0 0 0 50Z" fill={PALEST} />
          <path d="M50 25a25 25 0 0 1 0 50Z" fill={PALEST} />
        </svg>
      );

    /* Grand demi-disque pâle coupé net en son milieu, quart profond en bas à
       gauche, demi-disque moyen détaché à droite. */
    case 'quarters':
      return (
        <svg viewBox="0 0 100 134" className="w-full h-full" preserveAspectRatio="none">
          <path d="M67 0a67 67 0 0 0 0 134Z" fill={PALE} />
          <path d="M0 67h67a33.5 33.5 0 0 1-67 0Z" fill={DEEP} />
          <path d="M67 34a33.5 33.5 0 0 1 0 67Z" fill={MID} />
        </svg>
      );

    /* Les QUARTS retournés: le grand demi-disque passe à droite, le quart
       profond en bas à gauche. Même composition, autre main. */
    case 'quartersMirror':
      return (
        <svg viewBox="0 0 100 134" className="w-full h-full" preserveAspectRatio="none">
          <path d="M33 0a67 67 0 0 1 0 134Z" fill={PALE} />
          <path d="M100 67H33a33.5 33.5 0 0 0 67 0Z" fill={DEEP} />
          <path d="M33 34a33.5 33.5 0 0 0 0 67Z" fill={MID} />
        </svg>
      );

    /* Le CŒUR clair: deux demi-disques qui se font face, et un disque très
       pâle posé pile sur la couture. C'est la seule composition où le clair
       est AU-DESSUS du profond, ce qui la rend lisible même en petit. */
    case 'core':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <path d="M50 0a50 50 0 0 0 0 100Z" fill={DEEP} />
          <path d="M50 0a50 50 0 0 1 0 100Z" fill={PALE} />
          <circle cx="50" cy="50" r="26" fill={PALEST} />
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
