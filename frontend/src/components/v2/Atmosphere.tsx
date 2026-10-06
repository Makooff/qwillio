import { useEffect, useRef } from 'react';
import './atmosphere.css';

/** Decorative study. Pointer motion never changes content or intercepts controls. */
export default function Atmosphere() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    const host = element?.parentElement;
    if (!element || !host) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(pointer: fine)');
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      element.style.setProperty('--drift-x', '0px');
      element.style.setProperty('--drift-y', '0px');
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches) return;
      const bounds = host.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--drift-x', `${x * 34}px`);
        element.style.setProperty('--drift-y', `${y * 22}px`);
      });
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', reset);
    motion.addEventListener('change', reset);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', reset);
      motion.removeEventListener('change', reset);
    };
  }, []);
  return <div ref={root} className="q-atmosphere" aria-hidden="true">
    <div className="q-atmosphere__field"><div className="q-atmosphere__ribbon" /><div className="q-atmosphere__light" /></div>
    <div className="q-atmosphere__grain" />
  </div>;
}
