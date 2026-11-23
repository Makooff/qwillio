import { useEffect, useState } from 'react';

/**
 * L'illustration qui referme le hero (demande utilisateur: « mets les iPhone
 * des vidéos pour faire comprendre le principe rapidement »). Ce sont les deux
 * téléphones de la vidéo c01 de la campagne: vous êtes déjà en ligne, un
 * deuxième appel arrive, Qwillio le prend et la réservation tombe. Rendus par
 * video-promo (composition `SiteLoop-<lang>-c01`) sur fond TRANSPARENT, donc
 * ils se posent sur la transition du hero sans cadre ni plaque.
 *
 * Trois sources, parce qu'aucun format ne couvre tout le monde:
 * - WebM VP9 avec alpha: Chrome, Edge, Firefox.
 * - WebP animé avec alpha: Safari, qui lit le WebM mais en ignore la couche
 *   alpha et peindrait un fond noir derrière les téléphones.
 * - Une image fixe: `prefers-reduced-motion`, et avant le premier rendu.
 */
const isSafari = () => typeof navigator !== 'undefined' && /^((?!chrome|chromium|crios|android|edg).)*safari/i.test(navigator.userAgent);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function HeroCallLoop({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const lang = isFr ? 'fr' : 'en';
  const base = `/marketing/hero-call-loop-${lang}`;
  const [mode, setMode] = useState<'still' | 'video' | 'webp'>('still');
  useEffect(() => { setMode(reducedMotion() ? 'still' : isSafari() ? 'webp' : 'video'); }, []);
  const label = isFr
    ? 'Animation: vous êtes déjà en ligne, un deuxième appel arrive, Qwillio le prend et la réservation arrive sur votre téléphone.'
    : 'Animation: you are already on a call, a second call comes in, Qwillio takes it and the booking lands on your phone.';
  const common = 'block w-full h-auto select-none';
  return (
    <figure className={className} aria-label={label}>
      {mode === 'video' ? (
        <video className={common} autoPlay muted loop playsInline preload="metadata" poster={`${base}.png`} aria-hidden="true" width={648} height={648}>
          <source src={`${base}.webm`} type='video/webm; codecs="vp9"' />
        </video>
      ) : (
        <img className={common} src={mode === 'webp' ? `${base}.webp` : `${base}.png`} alt="" aria-hidden="true" width={648} height={648} decoding="async" />
      )}
    </figure>
  );
}
