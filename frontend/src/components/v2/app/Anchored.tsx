import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * Un menu déroulant qui SORT de sa carte.
 *
 * La fiche du personnage vit dans un panneau à hauteur bornée
 * (`max-h-[92vh] overflow-y-auto`), et un menu posé en `absolute` dedans
 * n'a que deux issues, toutes deux fausses: coupé par le bord de la carte,
 * ou allongeant la carte, qui gagne alors un ascenseur à chaque ouverture.
 * « Ça ne doit pas déclencher un scroll sur toute la carte, et ça doit
 * dépasser de la carte » (12/09/2026).
 *
 * Le menu est donc rendu dans `document.body`, en `fixed`, sous le milieu de
 * son ancre, et recalé à chaque défilement (en capture: la carte défile, pas
 * la page) et à chaque redimensionnement. Il reste dans l'écran: le centre est
 * ramené dans les marges, et il s'ouvre vers le HAUT quand la place manque
 * en dessous mais pas au-dessus. L'animation reste à l'enfant: ce conteneur
 * ne porte que la position, framer écrirait un `transform` inline qui
 * écraserait un centrage par classe.
 *
 * Le clic « dehors » se juge sur `[data-anchored]`: rendu hors de sa carte,
 * le menu n'est plus un descendant de son ancre, et `ref.contains` le
 * prendrait pour l'extérieur.
 */
export default function Anchored({
  anchor,
  maxWidth,
  gap = 8,
  gutter = 12,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  /** Largeur maximale en px, réduite aux marges de l'écran. */
  maxWidth: number;
  gap?: number;
  gutter?: number;
  children: ReactNode;
}) {
  const [box, setBox] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = anchor.current;
    if (!el) return;

    const place = () => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(maxWidth, vw - 2 * gutter);
      const half = width / 2;
      const centre = Math.min(Math.max(r.left + r.width / 2, gutter + half), vw - gutter - half);
      const below = vh - r.bottom - gap - gutter;
      const above = r.top - gap - gutter;
      /* Vers le haut seulement quand le bas manque ET que le haut offre plus:
         un menu qui s'ouvre au-dessus d'une ancre en bas d'écran se lit encore
         comme le sien. */
      const flip = below < 220 && above > below;
      setBox(flip
        ? { bottom: vh - r.top + gap, left: centre - half, width }
        : { top: r.bottom + gap, left: centre - half, width });
    };

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, maxWidth, gap, gutter]);

  if (!box) return null;

  return createPortal(
    <div
      data-anchored=""
      className="fixed z-[80]"
      style={{ top: box.top, bottom: box.bottom, left: box.left, width: box.width }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Vrai quand un clic tombe sur un menu ancré, où qu'il soit rendu. */
export function inAnchored(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-anchored]') !== null;
}
