import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Décor géométrique dérivé du kit « 10 Geometric Shapes » (BRIX), fourni par
   l'utilisateur.
 *
 * Les fichiers livrés sont des PNG de 6690 px pour des aplats de deux couleurs:
 * les embarquer tels quels coûterait plusieurs mégaoctets et figerait le bleu
 * du kit. Les mêmes formes sont donc REDESSINÉES ici en SVG. On y gagne le
 * poids (quelques centaines d'octets), la netteté à toutes les tailles, et
 * surtout les couleurs de la marque au lieu de celles du kit.
 *
 * Elles dérivent de deux façons qui se superposent: une respiration continue
 * (translation et rotation lentes, en boucle) et une parallaxe au scroll. Rien
 * ne bouge en reduced-motion, où la couche disparaît entièrement: c'est du
 * décor, il n'a rien à dire à qui coupe les animations.
 */

const INDIGO = '#7A5FFF';
const VIOLET = '#CD6BFB';
/* Le kit oppose un plein saturé à un pâle de la même famille. On garde ce
   rapport, transposé sur nos deux teintes. */
const PALE = 'rgba(122, 95, 255, 0.30)';
const PALE_VIOLET = 'rgba(205, 107, 251, 0.26)';

type ShapeKind = 'disc' | 'half' | 'rings' | 'halfDot' | 'quarter' | 'hourglass';

function Shape({ kind, fill, pale }: { kind: ShapeKind; fill: string; pale: string }) {
  switch (kind) {
    case 'disc':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d="M50 0a50 50 0 0 1 0 100Z" fill={fill} />
          <path d="M50 0a50 50 0 0 0 0 100Z" fill={pale} />
        </svg>
      );
    case 'half':
      return (
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M0 50a50 50 0 0 1 100 0Z" fill={fill} />
        </svg>
      );
    case 'rings':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="50" fill={fill} />
          {[34, 22, 11].map(r => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
          ))}
        </svg>
      );
    case 'halfDot':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d="M50 0a50 50 0 0 1 0 100Z" fill={pale} />
          <circle cx="50" cy="50" r="22" fill={fill} />
        </svg>
      );
    case 'quarter':
      return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d="M0 100V0a100 100 0 0 1 100 100Z" fill={fill} />
        </svg>
      );
    case 'hourglass':
      return (
        <svg viewBox="0 0 100 120" className="w-full h-full">
          <path d="M0 50a50 50 0 0 1 100 0Z" fill={fill} />
          <path d="M0 70a50 50 0 0 0 100 0Z" fill={pale} />
        </svg>
      );
  }
}

export interface DriftedShape {
  kind: ShapeKind;
  /** Position en pourcentage de la scène, coin haut-gauche de la forme. */
  x: string;
  y: string;
  /** Côté en pixels (largeur; la hauteur suit le ratio du tracé). */
  size: number;
  rotate?: number;
  tone?: 'indigo' | 'violet';
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
        const amount = Number(el.dataset.driftAmount ?? 60);
        /* Parallaxe: la forme traverse la section pendant qu'on la dépasse. */
        gsap.to(el, {
          y: amount,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
        });
        /* Respiration: jamais la même durée d'une forme à l'autre, sinon les
           six repartent ensemble et le décor se met à battre la mesure. */
        gsap.to(el, {
          xPercent: i % 2 ? 3.5 : -3.5,
          rotate: `+=${i % 2 ? 7 : -7}`,
          duration: 9 + i * 1.7,
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
          data-drift-amount={s.drift ?? 60}
          className="absolute"
          style={{
            left: s.x,
            top: s.y,
            width: s.size,
            opacity: s.opacity ?? 0.18,
            transform: `rotate(${s.rotate ?? 0}deg)`,
            willChange: 'transform',
          }}
        >
          <Shape
            kind={s.kind}
            fill={s.tone === 'violet' ? VIOLET : INDIGO}
            pale={s.tone === 'violet' ? PALE_VIOLET : PALE}
          />
        </div>
      ))}
    </div>
  );
}
