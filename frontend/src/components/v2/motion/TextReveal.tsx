import { Children, Fragment, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT_EXPO } from './reducedMotion';

/* Révélation de titre mot par mot au scroll (translateY + opacity, jamais
   de masque qui rognerait les jambages). Les enfants texte sont découpés en
   mots, les enfants React (SerifWord) restent une unité insécable: le mot
   serif italique garde sa ligature visuelle.
   Transform/opacity uniquement, `once`, statique si reduced-motion. */

function toUnits(children: ReactNode): ReactNode[] {
  const units: ReactNode[] = [];
  Children.toArray(children).forEach((child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      String(child)
        .split(/\s+/)
        .forEach((word) => {
          if (word.length > 0) units.push(word);
        });
    } else if (isValidElement(child)) {
      units.push(child);
    }
  });
  return units;
}

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
  stagger = 0.03,
  className = '',
}: TextRevealProps) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{children}</span>;

  const units = toUnits(children);

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-12% 0px -8% 0px' }}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {units.map((unit, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          <motion.span
            style={{ display: 'inline-block' }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
            }}
          >
            {unit}
          </motion.span>
        </Fragment>
      ))}
    </motion.span>
  );
}
