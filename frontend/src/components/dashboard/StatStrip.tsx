import type { LucideIcon } from '../icons';
import { ArrowUp, ArrowDown } from '../icons';

/**
 * La rangée de chiffres du tableau de bord, une seule fois.
 *
 * Trois pages en portaient trois versions: Analytiques posait l'icône au-dessus
 * du nombre et le libellé dessous, Appels mettait le libellé AU-DESSUS et se
 * repliait en 2×2 sur téléphone, Leads alignait de gros nombres colorés avec
 * une pastille. Même information, trois grammaires; on lisait trois produits.
 *
 * Celle-ci est la forme d'Analytiques, qui est la référence: icône discrète,
 * nombre en grand, libellé en petit dessous, cellules séparées par des filets
 * et jamais par des cadres.
 *
 * La COULEUR ne touche jamais le nombre: elle vit sur une pastille posée à
 * gauche du libellé (demande utilisateur). Un nombre se compare à ses voisins,
 * et cinq nombres de cinq teintes ne se comparent plus; un libellé, lui, nomme
 * un état, et c'est bien l'état que la couleur qualifie.
 *
 * Une cellule peut CLIQUER (le pipeline des leads, les statuts du CRM filtrent
 * la liste). C'est la seule variation admise, et elle ne change que l'élément
 * rendu — bouton au lieu de division — pas la géométrie: deux rangées qui se
 * ressemblent doivent se mesurer pareil.
 */

export interface StatCell {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Variation en pourcentage: positive en vert, négative en rouge. */
  delta?: number;
  /** Teinte du nombre. Sert aux états d'un lead, jamais à décorer. */
  color?: string;
  /** Rend la cellule cliquable: elle filtre ce qui est en dessous. */
  onClick?: () => void;
  /** Cellule retenue, quand elle filtre. */
  active?: boolean;
}

export default function StatStrip({ items, label }: { items: StatCell[]; label?: string }) {
  /* Autant de colonnes que de cellules, sans repli.
     Le repli en 2×2 d'Appels décalait la troisième cellule sous la première et
     demandait trois règles de rattrapage pour ses filets. Quatre ou cinq
     nombres courts tiennent en largeur sur un téléphone; c'est le libellé qui
     rétrécit, pas la grille. */
  const cols = items.length >= 5 ? 'grid-cols-5' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-4';
  const filtering = items.some(i => i.onClick);

  return (
    <div
      className={`grid ${cols} divide-x divide-white/[0.06]`}
      role={filtering ? 'group' : undefined}
      aria-label={label}
    >
      {items.map((k, i) => {
        const inner = (
          <>
            <div className="flex items-center justify-between mb-2 min-h-[14px]">
              {k.icon ? <k.icon size={14} className="text-white/30" aria-hidden="true" /> : <span />}
              {k.delta !== undefined && k.delta !== 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${k.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {k.delta > 0 ? <ArrowUp size={10} aria-hidden="true" /> : <ArrowDown size={10} aria-hidden="true" />}
                  {Math.abs(k.delta)}%
                </span>
              )}
            </div>
            {/* Le nombre est BLANC, toujours (demande utilisateur). La teinte
                d'état descend sur la pastille du libellé: c'est le libellé qui
                nomme l'état, donc c'est lui que la couleur doit qualifier. Le
                nombre, lui, se compare d'une cellule à l'autre, et cinq
                nombres de cinq couleurs différentes ne se comparent pas. */}
            <p className="text-[19px] sm:text-[26px] font-bold tabular-nums leading-none text-white/90">
              {k.value}
            </p>
            <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-white/40 mt-1.5 leading-tight">
              {k.color && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: k.color }}
                  aria-hidden="true"
                />
              )}
              {k.label}
            </p>
          </>
        );

        const box = 'px-2 sm:px-6 py-1 text-left first:pl-0 last:pr-0';

        return k.onClick ? (
          <button
            key={i}
            type="button"
            onClick={k.onClick}
            aria-pressed={!!k.active}
            data-radius="keep"
            className={`${box} transition-opacity ${k.active ? 'opacity-100' : 'opacity-55 hover:opacity-100'}`}
          >
            {inner}
          </button>
        ) : (
          <div key={i} className={box}>{inner}</div>
        );
      })}
    </div>
  );
}
