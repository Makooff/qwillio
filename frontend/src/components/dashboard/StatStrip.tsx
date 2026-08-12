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
 * Celle-ci est la forme d'Analytiques, qui est la référence: icône discrète
 * COLLÉE À GAUCHE du nombre, libellé en petit dessous, cellules séparées par
 * des filets et jamais par des cadres.
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
  /* Les colonnes prennent la LARGEUR DE LEUR CONTENU, elles ne sont plus
     égales. Une grille à colonnes égales donne 87 px à chaque cellule sur un
     téléphone, ce qui va pour « 412 » et pas pour « 2m 32s »: le nombre
     débordait sur le filet et sur l'icône de la voisine (retour utilisateur).
     Le contenu ne se laisse pas comprimer, c'est donc l'ESPACE ENTRE les
     cellules qui absorbe la différence.
     Pas de repli en 2×2 pour autant: il décalait la troisième cellule sous la
     première et demandait trois règles de rattrapage pour les filets. */
  const filtering = items.some(i => i.onClick);

  return (
    <div
      className="flex items-stretch justify-between divide-x divide-white/[0.06]"
      role={filtering ? 'group' : undefined}
      aria-label={label}
    >
      {items.map((k, i) => {
        const inner = (
          <>
            {/* L'icône est SUR LA MÊME LIGNE que le nombre, à sa gauche
                (demande utilisateur). Elle était au-dessus, ce qui coûtait une
                ligne entière de hauteur par cellule pour un signe de 14 px, et
                laissait la rangée bien plus haute que ce qu'elle dit. Côte à
                côte, l'icône devient ce qu'elle est: la marque du nombre, pas
                un titre. */}
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              {k.icon && (
                <k.icon
                  size={13}
                  /* `translate-y` et non `items-center`: aligner sur la LIGNE DE
                     BASE ferait flotter l'icône, l'aligner au centre la
                     décalerait vers le bas des chiffres. Ce demi-pixel la pose
                     sur la hauteur d'x. */
                  className="text-white/30 flex-shrink-0 translate-y-[-1px] self-center"
                  aria-hidden="true"
                />
              )}
              {/* Le nombre est BLANC, toujours (demande utilisateur). La teinte
                  d'état descend sur la pastille du libellé: c'est le libellé qui
                  nomme l'état, donc c'est lui que la couleur doit qualifier. Le
                  nombre, lui, se compare d'une cellule à l'autre, et cinq
                  nombres de cinq couleurs différentes ne se comparent pas. */}
              {/* `whitespace-nowrap`: la cellule est étroite sur un téléphone,
                  et une valeur en deux morceaux (« 2m 32s ») s'y coupait en
                  deux lignes, ce qui décalait toute la rangée. La valeur d'une
                  cellule est indivisible par nature.
                  Le corps descend à 16 px sur téléphone, et c'est la
                  contrepartie de cette insécabilité: une durée de six signes
                  mesure 96 px en 18 px gras, pour une colonne de 87 px, et elle
                  débordait sur l'icône de la cellule voisine. */}
              <p className="text-[16px] sm:text-[26px] font-bold tabular-nums leading-none text-white/90 whitespace-nowrap">
                {k.value}
              </p>
              {k.delta !== undefined && k.delta !== 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold self-center ${k.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {k.delta > 0 ? <ArrowUp size={10} aria-hidden="true" /> : <ArrowDown size={10} aria-hidden="true" />}
                  {Math.abs(k.delta)}%
                </span>
              )}
            </div>
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
