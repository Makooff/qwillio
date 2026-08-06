import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { EASE_OUT_EXPO } from './motion/reducedMotion';

/* Entrées V2: opacity + translateY, curve signature, stagger 40-70ms via `index`.
   Transform/opacity uniquement, `once`.
   Le kill-switch CSS de globals.css ne coupe que les transitions CSS: framer
   anime en JS, donc reduced-motion doit être traité ici, à la source. */

type Tag = 'div' | 'li' | 'section' | 'article' | 'header' | 'span' | 'ul' | 'ol' | 'p';

interface RevealV2Props {
  children: ReactNode;
  /* Position dans un groupe: le délai devient index * 0.06s */
  index?: number;
  delay?: number;
  y?: number;
  className?: string;
  as?: Tag;
}

export default function RevealV2({
  children,
  index = 0,
  delay = 0,
  y = 20,
  className = '',
  as: tag = 'div',
}: RevealV2Props) {
  const El = (motion as any)[tag];
  const reduced = useReducedMotion();
  if (reduced) {
    const Tag = tag as any;
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <El
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: delay + index * 0.06 }}
      className={className}
    >
      {children}
    </El>
  );
}
