import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLang } from '../../stores/langStore';
import TryVoiceCard from './TryVoiceCard';

/* Le bouton qui ouvre l'essai, et dont le CONTOUR devient la carte.
 *
 * Le `layoutId` est partagé avec le cadre de la carte: Framer interpole la
 * position et la taille entre les deux, si bien que la pilule s'agrandit
 * jusqu'à la carte au lieu qu'une fenêtre apparaisse par-dessus. C'est
 * pourquoi le contour vit sur un élément à part, en `absolute inset-0`: un
 * `layoutId` sur le bouton lui-même aurait emporté son texte dans
 * l'agrandissement.
 *
 * Chaque instance a son propre identifiant (`useId`): la page en monte
 * plusieurs, et deux boutons partageant un `layoutId` se disputeraient la
 * même carte, qui volerait de l'un à l'autre.
 */
export default function TryVoiceButton({
  children,
  className = '',
  variant = 'outline',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'outline' | 'onDark' | 'chromatic';
}) {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [open, setOpen] = useState(false);
  const layoutId = `q2-try-${useId()}`;

  const skin =
    variant === 'onDark'
      ? 'text-q2-void bg-white hover:bg-q2-mist'
      : variant === 'chromatic'
        ? 'text-white bg-q2-indigo hover:bg-q2-deep'
        : 'text-q2-ink bg-q2-canvas hover:border-q2-faint';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`q2-pill relative inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2 ${skin} ${className}`}
      >
        {/* Le contour, et lui seul, porte le `layoutId`. */}
        {!open && (
          <motion.span
            layoutId={layoutId}
            aria-hidden="true"
            className={`absolute inset-0 rounded-full ${variant === 'outline' ? 'border border-q2-plate' : ''}`}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
          />
        )}
        <span className="relative">{children}</span>
      </button>

      <TryVoiceCard open={open} onClose={() => setOpen(false)} isFr={isFr} layoutId={layoutId} />
    </>
  );
}
