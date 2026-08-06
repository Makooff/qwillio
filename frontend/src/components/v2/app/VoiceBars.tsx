import { useEffect, useRef, useState } from 'react';
import { currentLevel } from '../../client/useVoicePreview';
import { prefersReducedMotion } from '../motion/reducedMotion';

/**
 * Les barres qui bougent avec la voix.
 *
 * Réactives au SIGNAL, pas au fait qu'une lecture soit en cours: le niveau est
 * lu sur l'analyseur branché dans le graphe audio de `useVoicePreview`. Une
 * animation décorative jouée pendant la lecture aurait l'air juste une seconde
 * puis dériverait de la voix, et c'est exactement ce qui fait qu'un
 * visualiseur sonne faux.
 *
 * Le rendu passe par `transform: scaleY` et non par la hauteur: une hauteur
 * animée relance la mise en page à chaque frame, une transformation reste sur
 * le compositeur. Le niveau est lu une fois par frame pour tout le composant,
 * pas une fois par barre.
 */

/** Assez pour lire un rythme, assez peu pour rester lisible en 200 px. */
const BAR_COUNT = 28;

/**
 * Décalage de phase par barre.
 *
 * Sans lui les vingt-huit barres montent et descendent ensemble, ce qui ne
 * ressemble pas à un son mais à une respiration. Le décalage est déterministe
 * (dérivé de l'indice) pour que deux montages donnent la même silhouette.
 */
function phaseOf(i: number): number {
  return Math.sin(i * 12.9898) * 43758.5453 % 1;
}

export default function VoiceBars({
  active,
  className = '',
}: {
  /** Une lecture est en cours: en dehors, les barres retombent au repos. */
  active: boolean;
  className?: string;
}) {
  const [reduced] = useState(prefersReducedMotion);
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || reduced) return;

    const bars = Array.from(wrap.children) as HTMLElement[];
    let smoothed = 0;

    const tick = () => {
      /* Une seule lecture de l'analyseur par frame: la faire par barre
         multiplierait par vingt-huit le coût pour la même valeur. */
      const target = active ? currentLevel() : 0;
      // Montée franche, descente douce: une voix attaque vite et s'éteint lentement.
      smoothed += (target - smoothed) * (target > smoothed ? 0.45 : 0.12);

      const now = performance.now() / 1000;
      for (let i = 0; i < bars.length; i++) {
        const wave = 0.55 + 0.45 * Math.sin(now * 6 + phaseOf(i) * Math.PI * 2);
        /* 0,12 au repos: les barres restent visibles comme un trait, elles ne
           disparaissent pas quand rien ne joue. */
        const scale = 0.12 + smoothed * wave * 1.9;
        bars[i].style.transform = `scaleY(${Math.min(1, scale).toFixed(3)})`;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [active, reduced]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`flex items-center justify-center gap-[3px] h-8 ${className}`}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          className="w-[3px] h-full rounded-full bg-q2-indigo/70"
          style={{
            transformOrigin: 'center',
            transform: 'scaleY(0.12)',
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
}
