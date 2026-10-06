import { useEffect, useRef } from 'react';
import './atmosphere-focus.css';

function Landscape() {
  return <div className="q-focus-scene"><div className="q-focus-ribbon" /><div className="q-focus-lines" /><div className="q-focus-grain" /></div>;
}

export default function AtmosphereFocus() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(pointer: fine)');
    let frame = 0;
    const reset = () => { cancelAnimationFrame(frame); el.style.setProperty('--reveal', '0'); };
    const move = (event: PointerEvent) => {
      if (reduced.matches || !fine.matches) return;
      const r = el.getBoundingClientRect();
      const x = event.clientX - r.left;
      const y = event.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) { reset(); return; }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--focus-x', `${x}px`);
        el.style.setProperty('--focus-y', `${y}px`);
        el.style.setProperty('--reveal', '1');
      });
    };
    const visibility = () => { el.dataset.paused = String(document.hidden); };
    const observer = new IntersectionObserver(([entry]) => { el.dataset.offscreen = String(!entry.isIntersecting); });
    observer.observe(el);
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', reset);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', reset);
    };
  }, []);
  return <div ref={root} className="q-focus" aria-hidden="true">
    <div className="q-focus-soft"><Landscape /></div>
    <div className="q-focus-sharp"><Landscape /></div>
    <div className="q-focus-reading" />
  </div>;
}
