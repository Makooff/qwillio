import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Décor géométrique, d'après les quatre compositions fournies par
   l'utilisateur.
 *
 * Elles sont REDESSINÉES en SVG plutôt qu'embarquées en PNG: ce sont des
 * aplats de demi-disques, donc quelques centaines d'octets au lieu de plusieurs
 * mégaoctets, nettes à n'importe quelle taille, et surtout tenues par nos
 * variables de marque au lieu des couleurs du fichier d'origine.
 *
 * Deux mouvements se superposent: une parallaxe au scroll (la forme traverse la
 * section pendant qu'on la dépasse) et une respiration lente. Rien ne bouge en
 * reduced-motion, où la couche disparaît: c'est du décor, il n'a rien à dire à
 * qui coupe les animations. */

/* Les trois valeurs relevées dans les fichiers, transposées sur nos violets. */
const DEEP = '#5B4BF5';
const MID = '#7B6FF7';
const PALE = '#BDB6FD';
const PALEST = '#D8D5FE';

export type ShapeKind = 'twin' | 'twinMirror' | 'column' | 'quarters';

/** Ratio hauteur/largeur de chaque composition, pour réserver la bonne place. */
const RATIO: Record<ShapeKind, number> = {
  twin: 1,
  twinMirror: 1,
  column: 2,
  quarters: 1.34,
};

function Shape({ kind }: { kind: ShapeKind }) {
  switch (kind) {
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
          <path d="M44 0a50 50 0 0 0 0 100Z" fill={DEEP} />
          <path d="M50 0a50 50 0 0 1 0 100Z" fill={PALE} />
          <path d="M50 25a25 25 0 0 0 0 50Z" fill={PALEST} />
          <path d="M50 25a25 25 0 0 1 0 50Z" fill={PALEST} />
        </svg>
      );

    /* Colonne de quatre demi-disques alternés, ventre en haut puis en bas. */
    case 'column':
      return (
        <svg viewBox="0 0 100 200" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0 50a50 50 0 0 1 100 0Z" fill={PALE} />
          <path d="M0 50a50 50 0 0 0 100 0Z" fill={DEEP} />
          <path d="M0 150a50 50 0 0 1 100 0Z" fill={MID} />
          <path d="M0 150a50 50 0 0 0 100 0Z" fill={PALE} />
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
  }
}

export interface DriftedShape {
  kind: ShapeKind;
  /** Position en pourcentage de la scène, coin haut-gauche. */
  x: string;
  y: string;
  /** Largeur en pixels; la hauteur suit le ratio de la composition. */
  size: number;
  rotate?: number;
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
      items.forEach((el, i) => {
        const amount = Number(el.dataset.driftAmount ?? 120);
        /* Parallaxe: c'est le mouvement que l'utilisateur a demandé, il est
           donc franc (jusqu'à deux cents pixels) plutôt que suggéré. */
        gsap.to(el, {
          y: amount,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 0.7 },
        });
        /* Respiration: jamais la même durée d'une forme à l'autre, sinon les
           quatre repartent ensemble et le décor se met à battre la mesure. */
        gsap.to(el, {
          rotate: `+=${i % 2 ? 6 : -6}`,
          duration: 12 + i * 2.3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
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
            transform: `rotate(${s.rotate ?? 0}deg)`,
            willChange: 'transform',
          }}
        >
          <Shape kind={s.kind} />
        </div>
      ))}
    </div>
  );
}
