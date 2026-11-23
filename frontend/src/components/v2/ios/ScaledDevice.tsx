import { useLayoutEffect, useRef, useState } from 'react';
import { Device, W } from './IosKit';

/**
 * Le boîtier du kit, mis à l'échelle de la colonne qui le reçoit. Propre au
 * site: IosKit reste le miroir exact de video-promo, où Remotion fixe la taille.
 */
export default function ScaledDevice({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / (W + 26));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="w-full"><Device scale={scale}>{children}</Device></div>;
}
