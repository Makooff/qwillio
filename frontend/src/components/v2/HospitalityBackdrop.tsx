import { useCallback, useEffect, useState } from 'react';
import { prefersReducedMotion } from './motion/reducedMotion';

/** Licensed illustrative sector footage (Mixkit Free License), not customer
 * endorsements. Three distinct businesses rotate; parents keep their contrast
 * treatments. Only the active clip has a source; each clip plays once and the
 * playlist wraps around. */
const CLIPS = [
  { src: '/marketing/service-cafe.mp4', poster: '/marketing/service-cafe.webp' },
  { src: '/marketing/sector-salon.mp4', poster: '/marketing/sector-salon.webp' },
  { src: '/marketing/sector-bakery.mp4', poster: '/marketing/sector-bakery.webp' },
] as const;
const MAX_ERRORS = CLIPS.length + 1;

export default function HospitalityBackdrop({ dark = false }: { dark?: boolean }) {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const failed = errorCount >= MAX_ERRORS;
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const change = () => setReduced(media.matches);
    media.addEventListener?.('change', change);
    return () => media.removeEventListener?.('change', change);
  }, []);
  const advance = useCallback(() => setIndex(i => (i + 1) % CLIPS.length), []);

  const onError = useCallback(() => {
    setErrorCount(c => c + 1);
    advance();
  }, [advance]);

  const clip = CLIPS[index];
  return (
    <>
      <div
        aria-hidden="true"
        data-hospitality-backdrop
        data-nav-dark={dark ? '' : undefined}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ maskImage: 'linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%)' }}
      >
        <img src={clip.poster} alt="" width={1920} height={1080} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[60%_center]" />
        {!reduced && !failed && (
          <video
            key={clip.src}
            autoPlay
            muted
            playsInline
            preload="metadata"
            poster={clip.poster}
            onEnded={advance}
            onError={onError}
            className="absolute inset-0 h-full w-full object-cover object-[60%_center]"
          >
            <source src={clip.src} type="video/mp4" />
          </video>
        )}
      </div>

    </>
  );
}
