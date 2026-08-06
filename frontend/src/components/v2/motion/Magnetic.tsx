import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { isCoarsePointer } from './reducedMotion';

/* Attraction magnétique d'un CTA pilule: le bouton suit le pointeur de
   quelques pixels, ressort amorti, retour à zéro à la sortie. Réservé aux
   CTA rares (héro, clôture), jamais aux éléments fréquents.
   Désactivé au doigt et en reduced-motion: on rend alors un simple span,
   sans écouteur, donc sans coût. */

interface MagneticProps {
  children: ReactNode;
  /* Amplitude maximale en pixels sur chaque axe */
  strength?: number;
  className?: string;
}

const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

export default function Magnetic({ children, strength = 6, className = '' }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [coarse] = useState(isCoarsePointer);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 240, damping: 20, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 240, damping: 20, mass: 0.35 });

  if (reduced || coarse) {
    return <span className={`inline-flex ${className}`}>{children}</span>;
  }

  const onMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * strength);
    y.set(clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      className={`inline-flex ${className}`}
      style={{ x: springX, y: springY }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {children}
    </motion.span>
  );
}
