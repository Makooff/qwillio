import { useEffect, useState } from 'react';

/**
 * L'illustration de la section « Le principe » (demande utilisateur: « compose
 * une vidéo originale qui montre, en interface iOS, l'expérience client
 * Qwillio »). Un iPhone en 3D, quatre temps: vous êtes déjà en ligne et
 * Qwillio prend le deuxième appel, elle répond en direct, la réservation tombe
 * et l'appelant reçoit son SMS, le rendez-vous est dans l'agenda. Rendue par
 * video-promo (composition `SiteExperience-<lang>-c01`) sur fond TRANSPARENT,
 * donc elle se pose sur la page sans cadre ni plaque.
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
  const base = `/marketing/qwillio-experience-${lang}`;
  const [mode, setMode] = useState<'still' | 'video' | 'webp'>('still');
  useEffect(() => { setMode(reducedMotion() ? 'still' : isSafari() ? 'webp' : 'video'); }, []);
  const label = isFr
    ? 'Animation: vous êtes déjà en ligne, Qwillio prend le deuxième appel, réserve la table, envoie un SMS de confirmation et ajoute le rendez-vous à votre agenda.'
    : 'Animation: you are already on a call, Qwillio takes the second call, books the table, texts a confirmation and adds the booking to your calendar.';
  const common = 'block w-full h-auto select-none';
  // le reflet du téléphone s'arrête au bord de l'image: un fondu en bas évite la coupe nette
  const fade = { WebkitMaskImage: 'linear-gradient(to bottom, #000 82%, transparent)', maskImage: 'linear-gradient(to bottom, #000 82%, transparent)' };
  return (
    <figure className={className} aria-label={label}>
      {mode === 'video' ? (
        <video className={common} style={fade} autoPlay muted loop playsInline preload="metadata" poster={`${base}.png`} aria-hidden="true" width={1050} height={795}>
          <source src={`${base}.webm`} type='video/webm; codecs="vp9"' />
        </video>
      ) : (
        <img className={common} style={fade} src={mode === 'webp' ? `${base}.webp` : `${base}.png`} alt="" aria-hidden="true" width={1050} height={795} decoding="async" loading="lazy" />
      )}
    </figure>
  );
}
