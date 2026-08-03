import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Parallaxe légère appliquée aux éléments d'un groupe existant, chacun à sa
   propre vitesse: une rangée d'avatars cesse d'être un bloc et respire.

   Le déplacement passe par la propriété CSS `translate`, pas par `transform`:
   les enfants ciblés peuvent déjà porter un transform (entrée GSAP de la
   galerie, hover Tailwind) et les deux propriétés se composent au lieu de
   s'écraser. Écriture dans le callback de ScrollTrigger, déjà cadencé rAF. */

interface ParallaxGroupProps {
  children: ReactNode;
  /* Sélecteur des éléments à décaler, relatif au conteneur */
  selector: string;
  /* Amplitude crête en pixels avant pondération par élément */
  amount?: number;
  className?: string;
}

/* Vitesses déterministes et non alignées: pas de vague régulière. */
const SPEEDS = [1, 0.45, 0.8, 0.3, 0.95, 0.55, 0.7, 0.35, 0.85, 0.5];

export default function ParallaxGroup({
  children,
  selector,
  amount = 12,
  className = '',
}: ParallaxGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = ref.current;
    if (!wrap || prefersReducedMotion()) return;
    const nodes = Array.from(wrap.querySelectorAll<HTMLElement>(selector));
    if (nodes.length === 0) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: wrap,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const p = self.progress * 2 - 1;
          nodes.forEach((node, i) => {
            node.style.translate = `0 ${(p * amount * SPEEDS[i % SPEEDS.length]).toFixed(2)}px`;
          });
        },
      });
    }, wrap);

    return () => {
      ctx.revert();
      nodes.forEach((node) => {
        node.style.translate = '';
      });
    };
  }, [selector, amount]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
