import { useEffect, useRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

/* Le halo qui suivait le pointeur sur une surface. Il ne peint plus rien: voir
   `attachGlow` ci-dessous et `.q2-glow` dans v2.css. */

export function attachGlow(_el: HTMLElement): () => void {
  /* ÉTEINT (demande utilisateur: « la lueur au curseur, enlève-la »).
     Le rendu vivait dans `.q2-glow::before` (v2.css) et il est parti. Ce qui
     restait ici serait un `pointermove` par surface survolée, écrivant à chaque
     frame des variables CSS que plus personne ne lit: du travail pour une
     lumière qui n'existe plus.
     La fonction et le hook survivent parce que des dizaines d'appels les
     référencent (CardV2, NavV2, PinnedScene). Les neutraliser à la source donne
     le même résultat visuel qu'une refonte, sans en courir le risque. */
  return () => {};
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
