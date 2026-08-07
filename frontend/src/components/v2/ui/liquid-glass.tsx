import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

/* Verre liquide, porté du composant 21st « liquid-glass-button » que
   l'utilisateur a envoyé. La différence avec un backdrop-blur ordinaire tient
   en une ligne : le fond n'est pas seulement adouci, il est DÉFORMÉ, par un
   filtre SVG posé en backdrop (turbulence -> déplacement -> flou). Le biseau
   du verre, lui, vient d'une pile d'inset box-shadow, reprise telle quelle.

   Limite assumée et annoncée : WebKit n'accepte pas url() dans
   backdrop-filter. Sur iOS la déformation n'apparaît pas, donc on retombe sur
   un flou classique avec une teinte un cran plus dense, pour que la barre
   reste non traversable. Le biseau, lui, marche partout. */

export const GLASS_FILTER_ID = 'q2-liquid-glass';

/* Le filtre du composant d'origine, valeurs inchangées. */
export function GlassFilter() {
  return (
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter
          id={GLASS_FILTER_ID}
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves={1} seed={1} result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation={2} result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale={70}
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation={4} result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

/* Le navigateur accepte-t-il un filtre SVG en backdrop ? Chromium oui, WebKit
   non. Mesuré au montage plutôt que déduit de l'agent utilisateur. */
export function useLiquidGlassSupport() {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    /* `CSS.supports` ne suffit pas: WebKit ANALYSE `backdrop-filter: url(#…)`
       et répond « oui », puis n'applique rien. Résultat sur iPhone: la barre
       ne floutait pas du tout et on lisait le titre au travers, net. Le repli
       n'était jamais choisi puisque le navigateur s'était déclaré capable.

       WebKit est donc écarté explicitement. Sur Safari et sur tous les
       navigateurs iOS (qui utilisent tous WebKit, Chrome iOS compris), c'est
       le flou classique qui s'applique — moins spectaculaire, mais réel. */
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isWebKit =
      /iPad|iPhone|iPod/.test(ua) ||
      (/Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua)) ||
      // iPadOS 13+ se présente comme un Mac, seul le tactile le trahit.
      (typeof navigator !== 'undefined' &&
        navigator.platform === 'MacIntel' &&
        (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 1);

    const ok =
      !isWebKit &&
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('backdrop-filter', `url("#${GLASS_FILTER_ID}")`);
    setSupported(ok);
  }, []);
  return supported;
}

/* Les deux piles d'ombres du composant d'origine : elles dessinent l'épaisseur
   du verre, ses arêtes éclairées et son ombre portée. */
/* Le composant d'origine pousse ses arêtes noires à 0,9 et lave l'intérieur
   d'un voile noir de 12 % : sur fond crème, la bulle vire au gris et son
   contour se lit comme un trait (retour utilisateur). Les mêmes arêtes sont
   conservées, à peu près au tiers, et le voile intérieur tombe à 4 % pour que
   ce soit le flou qui donne la matière, pas la couleur. */
const BEVEL_LIGHT =
  '0 1px 4px rgba(0,0,0,0.05), inset 3px 3px 0.5px -3px rgba(0,0,0,0.34), inset -3px -3px 0.5px -3px rgba(0,0,0,0.30), inset 1px 1px 1px -0.5px rgba(0,0,0,0.22), inset -1px -1px 1px -0.5px rgba(0,0,0,0.22), inset 0 0 6px 6px rgba(0,0,0,0.04), inset 0 0 2px 2px rgba(0,0,0,0.02), 0 0 12px rgba(255,255,255,0.15)';

/* Variante sombre.
 *
 * Il restait deux sources de blanc, et c'est leur somme qui faisait la lueur
 * qu'on voyait autour de la barre en thème sombre (retour utilisateur):
 *   - une arête basse à 0,34, qui ne se lit plus comme un biseau mais comme un
 *     liseré lumineux dès que le fond derrière est noir;
 *   - deux halos internes (`inset 0 0 6px 6px` et `2px 2px`) qui éclaircissent
 *     toute la surface, d'où la « plaque » plus claire que la page.
 * Le biseau ne garde donc qu'un FILET, en haut, là où la lumière tomberait, et
 * la profondeur est rendue par les ombres portées sombres. */
const BEVEL_DARK =
  '0 0 8px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.10), inset 0 1px 0.5px -0.5px rgba(255,255,255,0.10), inset 0 -1px 0.5px -0.5px rgba(255,255,255,0.05), 0 0 12px rgba(0,0,0,0.15)';

export interface GlassSkinProps {
  /** Verre posé sur un fond sombre : le biseau s'inverse. */
  onDark?: boolean;
  /** Rayon de la surface, pour que les deux couches épousent la forme. */
  radius?: number | string;
  /** Teinte de fond. Basse quand le verre liquide marche, plus dense sinon. */
  tint?: string;
  tintFallback?: string;
  className?: string;
  style?: CSSProperties;
}

/* Peau de verre à poser en `absolute inset-0` dans un conteneur `relative`.
   Deux couches, comme dans le composant d'origine : le backdrop déformé
   dessous, le biseau par-dessus. */
export default function GlassSkin({
  onDark = false,
  radius = 9999,
  tint,
  tintFallback,
  className = '',
  style,
}: GlassSkinProps) {
  const liquid = useLiquidGlassSupport();

  const backdrop = liquid
    ? `url("#${GLASS_FILTER_ID}")`
    : 'blur(24px) saturate(1.8)';

  const background = liquid
    ? (tint ?? (onDark ? 'rgba(8,9,10,0.10)' : 'rgba(255,255,255,0.10)'))
    : (tintFallback ?? (onDark ? 'rgba(8,9,10,0.62)' : 'rgba(255,255,255,0.58)'));

  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} style={style}>
      <span
        className="absolute inset-0 isolate overflow-hidden"
        style={{
          borderRadius: radius,
          background,
          backdropFilter: backdrop,
          WebkitBackdropFilter: backdrop,
          /* Sans promotion, la couche est photographiée une fois au montage et
             ne se rafraîchit jamais quand le contenu défile dessous.
             `translateZ(0)` et non `will-change: backdrop-filter`: Safari ne
             reconnaît pas cette propriété comme indice, donc sur iPhone la
             couche restait justement figée. */
          transform: 'translateZ(0)',
        }}
      />
      <span
        className="absolute inset-0"
        style={{ borderRadius: radius, boxShadow: onDark ? BEVEL_DARK : BEVEL_LIGHT }}
      />
    </span>
  );
}
