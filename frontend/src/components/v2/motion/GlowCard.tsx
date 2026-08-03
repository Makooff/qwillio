import { useEffect, useRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { isCoarsePointer, prefersReducedMotion } from './reducedMotion';

/* Halo indigo qui suit le pointeur sur une surface. Le rendu vit dans la
   classe CSS `.q2-glow` (v2.css): un pseudo-élément en radial-gradient à 8 %
   piloté par trois variables CSS. On n'écrit jamais dans l'état React, donc
   zéro re-render pendant le déplacement de la souris, et une seule écriture
   par frame via requestAnimationFrame.
   Silencieux au doigt et en reduced-motion. */

export function attachGlow(el: HTMLElement): () => void {
  if (prefersReducedMotion() || isCoarsePointer()) return () => {};

  let frame = 0;
  let px = 0;
  let py = 0;

  const paint = () => {
    frame = 0;
    el.style.setProperty('--q2-glow-x', `${px}px`);
    el.style.setProperty('--q2-glow-y', `${py}px`);
  };

  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    px = e.clientX - r.left;
    py = e.clientY - r.top;
    if (frame === 0) frame = requestAnimationFrame(paint);
  };

  const onEnter = () => el.style.setProperty('--q2-glow-o', '1');

  const onLeave = () => {
    el.style.setProperty('--q2-glow-o', '0');
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointerleave', onLeave);

  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerenter', onEnter);
    el.removeEventListener('pointerleave', onLeave);
    if (frame !== 0) cancelAnimationFrame(frame);
  };
}

/* Hook pour les surfaces déjà composées (CardV2, panneaux de nav). */
export function useGlow<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    return attachGlow(el);
  }, [enabled]);
  return ref;
}

interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export default function GlowCard({ children, className = '', ...rest }: GlowCardProps) {
  const ref = useGlow<HTMLDivElement>();
  return (
    <div ref={ref} {...rest} className={`q2-glow ${className}`}>
      {children}
    </div>
  );
}
