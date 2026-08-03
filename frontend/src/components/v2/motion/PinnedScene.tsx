import { Children, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { attachGlow } from './GlowCard';
import { prefersReducedMotion } from './reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Scène au scroll: le bloc de titre reste épinglé à gauche pendant que les
   actes défilent à droite, l'acte courant s'illumine, les autres retombent
   à 40 % d'opacité.

   L'épinglage utilise `position: sticky` plutôt que le pin de ScrollTrigger:
   même résultat visuel, mais aucun pin-spacer injecté dans la grille, donc
   aucun décalage de mise en page quand un chunk lazy (le player Remotion)
   arrive plus bas dans la page. ScrollTrigger garde ce qu'il fait le mieux:
   piloter la lumière en scrub et la position dans le récit.
   Sous 1024px, la scène redevient un simple stagger, sans épinglage. */

interface PinnedSceneProps {
  aside: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function PinnedScene({ aside, children, className = '' }: PinnedSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const acts = Children.toArray(children);
  const total = acts.length;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene-act]'));
    if (nodes.length === 0) return;

    const detachers = nodes.map((node) => attachGlow(node));

    if (prefersReducedMotion()) return () => detachers.forEach((off) => off());

    const ctx = gsap.context(() => {
      nodes.forEach((node, i) => {
        const last = i === nodes.length - 1;

        /* Une seule timeline par acte: montée, plateau, retombée. Deux tweens
           concurrents sur la même opacité se battraient au changement de sens. */
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: node,
            start: 'top 82%',
            end: 'bottom 34%',
            scrub: 0.6,
          },
        });
        tl.fromTo(node, { opacity: 0.4 }, { opacity: 1, ease: 'none', duration: 0.35 })
          .to(node, { opacity: 1, duration: 0.35 })
          .to(node, { opacity: last ? 1 : 0.4, ease: 'none', duration: 0.3 });

        ScrollTrigger.create({
          trigger: node,
          start: 'top 62%',
          end: 'bottom 42%',
          onToggle: (self) => {
            if (self.isActive) setActive(i);
          },
        });
      });

      /* Les actes portent l'opacité initiale via GSAP: pas de flash à 0.4
         avant que le premier trigger ne se calcule. */
      gsap.set(nodes, { opacity: 0.4 });
    }, root);

    return () => {
      ctx.revert();
      detachers.forEach((off) => off());
    };
  }, [total]);

  return (
    <div
      ref={rootRef}
      className={`grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 ${className}`}
    >
      <div className="lg:sticky lg:top-28 lg:self-start">
        {aside}
        <div className="hidden lg:flex items-center gap-4 mt-10" aria-hidden="true">
          <div className="flex items-center gap-1.5">
            {acts.map((_, i) => (
              <span
                key={i}
                className={`h-[2px] rounded-full transition-[width,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  i === active ? 'w-8 bg-q2-indigo' : 'w-4 bg-q2-plate'
                }`}
              />
            ))}
          </div>
          <span className="q2-eyebrow text-q2-faint tabular-nums">
            {String(active + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
      </div>

      <ol className="border-t border-q2-plate" role="list">
        {acts.map((act, i) => (
          <li key={i} data-scene-act className="q2-glow border-b border-q2-plate">
            {act}
          </li>
        ))}
      </ol>
    </div>
  );
}
