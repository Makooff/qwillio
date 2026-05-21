import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type Tag = 'div' | 'li' | 'section' | 'article' | 'header' | 'span' | 'ul' | 'ol';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: Tag;
}

export default function Reveal({ children, delay = 0, y = 24, className = '', as: tag = 'div' }: RevealProps) {
  const El = (motion as any)[tag];
  return (
    <El
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </El>
  );
}
