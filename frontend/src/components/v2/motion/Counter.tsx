import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './reducedMotion';

/* Chiffre qui monte à l'entrée dans le viewport. La valeur finale est déjà
   dans le DOM au premier rendu (lecteurs d'écran et no-JS servis correctement),
   l'animation n'écrit que du textContent: aucun re-render React.
   Largeur réservée en `ch` + tabular-nums, donc zéro décalage de mise en page. */

interface CounterProps {
  value: number;
  duration?: number;
  className?: string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function Counter({ value, duration = 800, className = '' }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const final = String(value);
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.textContent = final;
      return;
    }

    let frame = 0;
    let started = 0;

    const step = (now: number) => {
      if (started === 0) started = now;
      const p = Math.min(1, (now - started) / duration);
      el.textContent = String(Math.round(value * easeOut(p)));
      if (p < 1) frame = requestAnimationFrame(step);
      else frame = 0;
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        el.textContent = '0';
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      el.textContent = final;
    };
  }, [value, duration]);

  return (
    <span
      ref={ref}
      className={`inline-block tabular-nums ${className}`}
      style={{ minWidth: `${String(value).length}ch` }}
    >
      {value}
    </span>
  );
}
