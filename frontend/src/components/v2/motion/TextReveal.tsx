import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger, SplitText);

/* Révélation de titre au scroll via GSAP SplitText: les mots montent depuis
   un masque de ligne (yPercent 110 -> 0), la signature des sites référence.
   Le découpage attend document.fonts.ready (sinon les lignes se calculent
   sur la mauvaise fonte), respecte les éléments imbriqués (SerifWord reste
   une unité), et se révert proprement au démontage. Statique si
   reduced-motion. API inchangée: children, delay, stagger, className. */

interface TextRevealProps {
  children: ReactNode;
  /* Décalage avant le premier mot, pour enchaîner avec un eyebrow */
  delay?: number;
  stagger?: number;
  className?: string;
}

export default function TextReveal({
  children,
  delay = 0,
  stagger = 0.04,
  className = '',
}: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let split: SplitText | null = null;
    let cancelled = false;
    const ctx = gsap.context(() => {
      document.fonts.ready.then(() => {
        if (cancelled || !ref.current) return;
        split = SplitText.create(ref.current, {
          type: 'lines,words',
          mask: 'lines',
          linesClass: 'q2-split-line',
        });
        gsap.from(split.words, {
          yPercent: 110,
          duration: 0.7,
          ease: 'expo.out',
          stagger,
          delay,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      });
    }, el);

    return () => {
      cancelled = true;
      split?.revert();
      ctx.revert();
    };
  }, [delay, stagger]);

  return (
    <span ref={ref} className={className} style={{ display: 'block' }}>
      {children}
    </span>
  );
}
