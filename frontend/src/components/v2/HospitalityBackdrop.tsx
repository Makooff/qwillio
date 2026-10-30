import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from '../icons';
import { useLang } from '../../stores/langStore';
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
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [paused, setPaused] = useState(false);
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
  const onEnded = useCallback(() => {
    if (!paused) advance();
  }, [paused, advance]);
  const onError = useCallback(() => {
    setErrorCount(c => c + 1);
    advance();
  }, [advance]);
  const toggle = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      try { await video.play(); setPaused(false); } catch { setErrorCount(c => c + 1); }
    } else { video.pause(); setPaused(true); }
  };
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
            ref={videoRef}
            autoPlay={!paused}
            muted
            playsInline
            preload="metadata"
            poster={clip.poster}
            onEnded={onEnded}
            onError={onError}
            className="absolute inset-0 h-full w-full object-cover object-[60%_center]"
          >
            <source src={clip.src} type="video/mp4" />
          </video>
        )}
      </div>
      {!reduced && !failed && (
        <button type="button" onClick={toggle} aria-label={paused ? (isFr ? 'Reprendre la vidéo de fond' : 'Resume background video') : (isFr ? 'Mettre la vidéo de fond en pause' : 'Pause background video')} className="absolute right-4 top-24 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-black/50 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
      )}
    </>
  );
}
