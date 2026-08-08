import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLang } from '../../stores/langStore';
import TryVoiceCard from './TryVoiceCard';

/* Le bouton qui ouvre l'essai, et dont le FOND devient celui de la carte.
 *
 * Le `layoutId` est partagé avec le cadre de la carte: Framer interpole
 * position, taille et rayon entre les deux, si bien que la surface du bouton
 * s'agrandit jusqu'à devenir la carte. Ce n'est pas une fenêtre qui apparaît
 * par-dessus, c'est le même fond qui grandit.
 *
 * D'où deux choix qui ne sont pas cosmétiques:
 * - c'est un élément à part, en `absolute inset-0`, qui porte le fond ET le
 *   `layoutId`. Les poser sur le bouton lui-même emporterait son contenu dans
 *   l'agrandissement, et on verrait le texte s'étirer;
 * - le bouton n'a donc aucun fond propre. Sans quoi il en resterait un derrière
 *   pendant toute l'animation, et on verrait la pilule à sa place d'origine en
 *   même temps que la carte.
 *
 * Chaque instance a son propre identifiant (`useId`): la page en monte
 * plusieurs, et deux boutons partageant un `layoutId` se disputeraient la même
 * carte, qui volerait de l'un à l'autre.
 */
export default function TryVoiceButton({
  children,
  className = '',
  variant = 'outline',
  /** `round` est la version mobile: l'icône seule, sur un rond. */
  shape = 'pill',
  label,
  /**
   * Le fond n'existe que quand la nav est detachee.
   *
   * En haut de page la barre n'a AUCUNE surface, c'est sa regle: y poser un
   * rond blanc en ferait la seule tache de la bande. L'icone reste donc nue, et
   * la surface apparait avec la pilule flottante, en meme temps que celle de la
   * nav. Le `layoutId` reste porte dans les deux cas: sans surface visible, la
   * carte grandit quand meme depuis la bonne position.
   */
  showSurface = true,
}: {
  children: ReactNode;
  className?: string;
  variant?: 'outline' | 'onDark' | 'chromatic';
  shape?: 'pill' | 'round';
  /** Obligatoire en `round`, où il n'y a pas de texte à lire. */
  label?: string;
  showSurface?: boolean;
}) {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [open, setOpen] = useState(false);
  const layoutId = `q2-try-${useId()}`;

  /* Le fond du bouton est celui de la CARTE (`q2-canvas`), pas un blanc
     littéral: c'est ce qui rend l'agrandissement continu, et ça reste juste en
     thème sombre, où la carte n'est pas blanche. */
  const surface =
    variant === 'chromatic'
      ? 'bg-q2-indigo'
      : variant === 'onDark'
        ? 'bg-white'
        : 'bg-q2-canvas border border-q2-plate';

  /* Sans fond, l'icone contraste avec la PAGE et non avec une surface qui
     n'est pas la. `onDark` sur fond sombre donnait sinon une icone noire sur du
     noir: invisible, exactement dans l'etat ou elle est nue. */
  const text = !showSurface
    ? (variant === 'onDark' ? 'text-white' : 'text-q2-ink')
    : variant === 'chromatic'
      ? 'text-white'
      : variant === 'onDark'
        ? 'text-q2-void'
        : 'text-q2-ink';

  const box =
    shape === 'round'
      ? 'w-11 h-11 rounded-full'
      : 'min-h-[44px] rounded-full px-7 py-3.5 text-[15px] font-medium';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={shape === 'round' ? label : undefined}
        className={`q2-pill relative inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2 ${box} ${text} ${className}`}
      >
        {/* Le fond, et lui seul, porte le `layoutId`. Masqué pendant que la
            carte est ouverte: sinon la surface serait peinte aux deux endroits
            à la fois. */}
        {!open && (
          <motion.span
            layoutId={layoutId}
            aria-hidden="true"
            className={`absolute inset-0 rounded-full ${showSurface ? surface : ''}`}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
          />
        )}
        {/* Le contenu s'efface avec le fond: sinon l'icone restait seule et
            nue a l'origine pendant que la carte grandit ailleurs. */}
        <span
          className="relative inline-flex items-center gap-2 transition-opacity duration-150"
          style={{ opacity: open ? 0 : 1 }}
        >
          {children}
        </span>
      </button>

      <TryVoiceCard open={open} onClose={() => setOpen(false)} isFr={isFr} layoutId={layoutId} />
    </>
  );
}
