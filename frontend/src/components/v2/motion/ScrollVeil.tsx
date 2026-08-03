import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Transition de registre: le bas d'une section claire s'assombrit
   progressivement au scroll pour rejoindre la section drenched qui suit,
   au lieu d'une coupure nette. Un simple dégradé en position absolue dont
   seule l'opacité est animée en scrub.
   Le parent doit être `relative`. Décoratif, donc aria-hidden, et invisible
   en reduced-motion (opacité 0, aucun ScrollTrigger créé). */

interface ScrollVeilProps {
  /* Couleur d'arrivée, celle de la section drenched suivante */
  to?: string;
  height?: string;
  className?: string;
}

export default function ScrollVeil({
  to = '#08090A',
  height = '44vh',
  className = '',
}: ScrollVeilProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom bottom',
            scrub: 0.5,
          },
        },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 ${className}`}
      style={{
        height,
        opacity: 0,
        background: `linear-gradient(180deg, rgba(8, 9, 10, 0) 0%, ${to} 100%)`,
      }}
    />
  );
}
