import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/* Entrées V2: opacity + translateY, curve signature, stagger 40-70ms via `index`.
   Transform/opacity uniquement, `once`, reduced-motion géré par le kill-switch global. */

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
  return (
    <El
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: delay + index * 0.06 }}
      className={className}
    >
      {children}
    </El>
  );
}
