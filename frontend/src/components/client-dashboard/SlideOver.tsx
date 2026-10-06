import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from '../icons';

interface SlideOverProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Nom accessible du panneau; par défaut le titre. */
  ariaLabel?: string;
}

/**
 * Panneau latéral partagé par les fiches de détail (appel, lead).
 * Une seule définition du voile + du panneau + du comportement clavier,
 * pour que les deux écrans restent identiques sans se copier.
 *
 * Surface: #131313 à 65 % avec flou moyen (demande du 13/09, « légèrement
 * transparent et flou » ; à 80 % sur une page sombre, rien ne passait). Le
 * voile assombrit SANS flou pour que la page derrière reste nette. Le flou
 * fort tient le gris stable quoi qu'il y ait derrière ; `bg-white/[0.02]`
 * sans flou laissait lire la liste au travers de la fiche. L'entête porte la
 * MÊME surface que le panneau : une entête opaque sur un panneau translucide
 * se lirait comme une bande rapportée.
 *
 * Accessibilité (mêmes garanties que ConfirmDialog): Echap ferme, le
 * défilement du document est verrouillé puis restitué, le focus entre dans
 * le panneau et revient au déclencheur à la fermeture, et la navigation Tab
 * reste dans le panneau.
 */
export default function SlideOver({ title, onClose, children, ariaLabel }: SlideOverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const focusables = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#131313]/65 backdrop-blur-xl border-l border-white/[0.07] shadow-2xl z-50 overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-[#131313]/65 backdrop-blur-xl border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#F5F5F7]">{title}</h2>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau"
            className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.10] transition-colors text-[#A1A1A8] hover:text-[#F5F5F7] focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </motion.div>
    </>
  );
}
