import { Children, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { attachGlow } from './GlowCard';
import { prefersReducedMotion } from './reducedMotion';
import { onScrollFrame, sceneAt, sceneStarted } from './sceneProgress';

/* Scène au scroll: le bloc de titre reste épinglé à gauche pendant que les
   actes défilent à droite, l'acte courant s'illumine, les autres retombent.

   L'épinglage utilise `position: sticky` plutôt que le pin de ScrollTrigger:
   même résultat visuel, mais aucun pin-spacer injecté dans la grille, donc
   aucun décalage de mise en page quand un chunk lazy arrive plus bas dans la
   page.

   L'acte courant se déduit de `sceneProgress`, et non d'un trigger par acte:
   avec un trigger par acte les plages se recouvrent au raccord, c'est le
   dernier créé qui gagne, et le compteur annonçait « 03 » alors que le titre
   de gauche n'avait même pas fini de descendre. Une seule lecture, une seule
   vérité, et rien ne bouge à droite tant que la colonne n'est pas posée.

   Sous 1024px, la scène redevient un simple empilement: pas d'épinglage, donc
   pas de compteur, il n'aurait rien à accompagner. */

interface PinnedSceneProps {
  aside: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function PinnedScene({ aside, children, className = '' }: PinnedSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [active, setActive] = useState(0);
  const acts = Children.toArray(children);
  const total = acts.length;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene-act]'));
    if (nodes.length === 0) return;

    const detachers = nodes.map((node) => attachGlow(node));
    if (reduced) return () => detachers.forEach((off) => off());

    const stop = onScrollFrame(() => {
      /* Tant que le titre descend, la scène n'a pas commencé: on reste sur la
         première étape plutôt que de courir devant. */
      if (!sceneStarted(asideRef.current)) {
        setActive(0);
        return;
      }
      /* Partie entière: l'étape change quand la ligne de lecture atteint la
         suivante, c'est-à-dire au moment où le cadre finit de s'y poser. */
      setActive(Math.floor(sceneAt(nodes)));
    });

    return () => {
      stop();
      detachers.forEach((off) => off());
    };
  }, [reduced, total]);

  return (
    <div
      ref={rootRef}
      className={`grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 ${className}`}
    >
      {/* `data-scene-aside` sert de repère au cadre voyageur, qui vit à côté
          de la scène et doit savoir si elle a commencé. */}
      <div ref={asideRef} data-scene-aside className="lg:sticky lg:top-28 lg:self-start">
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
          <li
            key={i}
            data-scene-act
            /* `data-active` porte l'état jusqu'au contenu de l'acte: c'est la
               page qui décide à quoi ressemble une étape mise en avant, la
               scène ne connaît que l'étape courante. */
            data-active={i === active ? 'true' : undefined}
            className={`group q2-glow border-b border-q2-plate ${
              reduced
                ? ''
                : 'opacity-40 data-[active=true]:opacity-100 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]'
            }`}
          >
            {act}
          </li>
        ))}
      </ol>
    </div>
  );
}
