import type { ReactNode, HTMLAttributes } from 'react';
import { useGlow } from './motion/GlowCard';

/* Cards V2 — clair: plates taupe sans ombre ni bordure (ElevenLabs),
   drenched: carbon avec bordure hairline, zéro ombre (Linear). */

type CardVariant = 'band' | 'canvas' | 'drenched';

interface CardV2Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  /* 20px standard, 28px pour les grands blocs héro */
  large?: boolean;
  /* Active translateY(-2px) + ombre diffuse mauve au survol */
  hover?: boolean;
  /* Halo indigo qui suit le pointeur (motion/GlowCard), pointeur fin seulement */
  glow?: boolean;
  className?: string;
}

const VARIANTS: Record<CardVariant, string> = {
  band: 'bg-q2-band',
  canvas: 'bg-q2-canvas border border-q2-plate',
  drenched: 'bg-q2-carbon border border-q2-graphite-d',
};

export default function CardV2({
  children,
  variant = 'band',
  large = false,
  hover = false,
  glow = false,
  className = '',
  ...rest
}: CardV2Props) {
  const radius = variant === 'drenched' ? 'rounded-xl' : large ? 'rounded-[28px]' : 'rounded-[20px]';
  const glowRef = useGlow<HTMLDivElement>(glow);
  return (
    <div
      ref={glowRef}
      {...rest}
      className={`${VARIANTS[variant]} ${radius} p-8 ${hover ? 'q2-card-hover' : ''} ${
        glow ? 'q2-glow' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
