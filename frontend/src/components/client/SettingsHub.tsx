import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from '../icons';

/**
 * Le hub de réglages: des rangées groupées, et un PANNEAU qui s'ouvre par-dessus.
 *
 * La page de la réceptionniste empilait cinq accordéons. Sur un téléphone c'est
 * la pire des formes: fermé on lit cinq titres et rien d'autre, ouvert le
 * contenu pousse tout ce qui suit hors de l'écran, et on perd le fil entre le
 * réglage qu'on modifie et la liste qu'on parcourait. Le commentaire d'origine
 * assumait ce choix pour ne pas éclater l'état: la sauvegarde automatique est
 * une seule et même chose pour toute la page, et des sous-pages routées
 * l'auraient coupée en cinq.
 *
 * Le panneau garde cet argument intact et règle la lecture: c'est le MÊME arbre
 * React, donc le même état et la même sauvegarde, mais posé au-dessus de la
 * page au lieu de la déplier. Une chose à la fois, plein écran sur téléphone,
 * et la liste reste là où on l'a laissée.
 *
 * Le vocabulaire est celui de la page Paramètres: intitulé de groupe en petites
 * capitales, carte unique, rangées séparées par un filet, tuile d'icône à
 * gauche, chevron à droite.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export function HubGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B75]">
        {label}
      </p>
      {/* Une seule carte, des filets entre les rangées: c'est ce qui distingue
          un groupe d'une pile de cartes identiques. */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden divide-y divide-white/[0.05]">
        {children}
      </div>
    </section>
  );
}

export interface HubRowProps {
  title: string;
  hint?: string;
  icon: React.ElementType;
  /** Affiché à droite du titre: un état, un compteur, une pastille. */
  right?: ReactNode;
  onOpen: () => void;
}

export function HubRow({ title, hint, icon: Icon, right, onOpen }: HubRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      /* 62 px: la rangée doit rester confortable au pouce. `active:` plutôt que
         `hover:`, qui piège les doigts dans un état survolé. */
      className="w-full flex items-center gap-3.5 px-4 h-[62px] text-left transition-colors active:bg-white/[0.05] sm:hover:bg-white/[0.02]"
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <Icon size={15} className="text-[#F5F5F7]" aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium text-[#F5F5F7] truncate">{title}</span>
        {hint && <span className="block text-[12px] text-[#6B6B75] truncate">{hint}</span>}
      </span>
      {right}
      <ChevronRight size={15} className="text-[#6B6B75] flex-shrink-0" aria-hidden="true" />
    </button>
  );
}

export function HubPanel({
  open, onClose, title, hint, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    /* Le fond ne défile pas derrière un panneau plein écran: sur téléphone le
       moindre glissement emmène la page et on croit avoir fermé. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex sm:items-center sm:justify-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            /* Entrée et sortie ASYMÉTRIQUES: 260 ms pour arriver, 180 pour
               partir. Une fermeture se veut expédiée, on a déjà décidé.
               `transform` et `opacity` seulement, jamais la géométrie. */
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985 }}
            animate={{
              opacity: 1, y: 0, scale: 1,
              transition: { duration: reduce ? 0.12 : 0.26, ease: EASE },
            }}
            exit={reduce
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { opacity: 0, y: 12, scale: 0.99, transition: { duration: 0.18, ease: EASE } }}
            className="relative flex w-full flex-col bg-[#0A0A0C] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-white/[0.08] sm:max-h-[86vh] overflow-hidden"
          >
            {/* Entête collante: le titre du réglage reste lisible quand on
                descend dans un formulaire long, et le retour reste sous le
                pouce. */}
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.06] bg-[#0A0A0C] px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
              <button
                type="button"
                onClick={onClose}
                aria-label="Retour"
                className="w-10 h-10 -ml-1 rounded-xl grid place-items-center text-[#A1A1A8] transition-colors active:bg-white/[0.06] sm:hover:text-[#F5F5F7]"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-tight text-[#F5F5F7] truncate">{title}</h2>
                {hint && <p className="text-[12px] text-[#6B6B75] truncate">{hint}</p>}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
