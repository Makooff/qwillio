import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Search, Filter } from '../icons';
import StatStrip, { type StatCell } from './StatStrip';

/**
 * L'entête des pages du tableau de bord, celle d'Analytiques pour tout le monde.
 *
 * Appels, Leads et le CRM en avaient chacun une, écrite à la main: même
 * intention, trois tailles de titre, trois animations, et une barre de
 * recherche posée à des hauteurs différentes. On lisait trois produits.
 *
 * Ce composant tient les quatre couches dans l'ordre où on les lit:
 *   1. le titre, ce qu'on regarde, et l'action propre à la page;
 *   2. les chiffres, sans cadre, séparés par des filets;
 *   3. la recherche et les filtres, DISPONIBLES sur chaque page qui en a
 *      besoin, à la même place;
 *   4. le panneau de filtres, qui se déplie sans pousser la page d'un coup.
 *
 * Chaque couche entre en décalé (60 ms): le titre d'abord, les chiffres
 * ensuite. C'est ce qui donne un ordre de lecture plutôt qu'un bloc qui
 * apparaît d'un seul tenant.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Une couche, à son rang. */
function Layer({ i, children, className }: { i: number; children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE, delay: i * 0.06 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export interface PageHeaderSearch {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Ce que lit un lecteur d'écran: « Rechercher » seul ne dit pas où. */
  label: string;
}

export interface PageHeaderFilters {
  open: boolean;
  onToggle: () => void;
  /** Nombre de filtres actifs, affiché en pastille. 0 = aucun. */
  count?: number;
  /** Le contenu du panneau déplié. */
  children: ReactNode;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** À droite du titre: période, bascule de vue, export, ajout. */
  action?: ReactNode;
  /** La rangée de chiffres, la même partout. Les cellules peuvent filtrer. */
  kpis?: StatCell[];
  /** Une rangée entièrement à la main. À n'employer que si `kpis` ne suffit
      pas: c'est par là que les trois grammaires de rangée étaient revenues. */
  stats?: ReactNode;
  search?: PageHeaderSearch;
  filters?: PageHeaderFilters;
}

export default function PageHeader({
  title, subtitle, action, kpis, stats, search, filters,
}: PageHeaderProps) {
  const strip = stats ?? (kpis && kpis.length ? <StatStrip items={kpis} /> : null);
  const count = filters?.count ?? 0;

  return (
    <header className="mb-4">
      <Layer i={0} className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#F5F5F7]">{title}</h1>
          {subtitle && <p className="text-[12.5px] mt-0.5 text-[#A1A1A8]">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
      </Layer>

      {strip && (
        <Layer i={1} className="pb-6 mb-6 border-b border-white/[0.06]">
          {strip}
        </Layer>
      )}

      {(search || filters) && (
        <Layer i={2} className="flex flex-col sm:flex-row gap-3">
          {search && (
            <div className="relative flex-1">
              <Search
                size={16}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A8]"
              />
              <input
                type="search"
                value={search.value}
                onChange={e => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                aria-label={search.label}
                /* 16 px sur téléphone: en dessous, iOS zoome au focus et la
                   page reste décalée après la saisie. */
                className="w-full pl-9 pr-4 py-2.5 text-[16px] sm:text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 transition-colors"
              />
            </div>
          )}

          {filters && (
            <button
              type="button"
              onClick={filters.onToggle}
              aria-expanded={filters.open}
              aria-label="Filtres avancés"
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                filters.open || count > 0
                  ? 'bg-[#7349fe]/10 border-[#7349fe]/30 text-[#7349fe]'
                  : 'bg-white/[0.03] border-white/[0.07] text-[#A1A1A8] hover:text-[#F5F5F7]'
              }`}
            >
              <Filter size={14} aria-hidden="true" />
              Filtres
              {count > 0 && (
                <span
                  className="w-5 h-5 rounded-full bg-[#7349fe] text-white text-[10px] flex items-center justify-center font-bold"
                  aria-label={`${count} filtre(s) actif(s)`}
                >
                  {count}
                </span>
              )}
            </button>
          )}
        </Layer>
      )}

      {filters && (
        <AnimatePresence initial={false}>
          {filters.open && (
            <motion.div
              key="filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                {filters.children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </header>
  );
}
