import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Lock, MoreVertical, Plus, RotateCw, X } from 'lucide-react';
import QwillioLogo from '../../QwillioLogo';

/* Fenêtre de navigateur, portée du kit « macOS Browser UI Kit (Big Sur) » que
   l'utilisateur a enregistré dans Figma (fileKey 2s5xTDITPM0oycK3mkJNr7, nœud
   « Browser / Google Chrome - Light », spécifications lues via le MCP Figma).

   Les valeurs viennent du fichier, pour une fenêtre de 1280 de large :
     barre d'onglets  37px, fond #DFE1E5
     pastilles        3 x 12px, à 13px du bord, 16px du haut
     onglet           256 x 34, à 70px, coins hauts arrondis, fond blanc
     favicon          18px à 89px / titre 12px #3D4043 à 114px / croix 8px
     barre d'outils   42px, fond blanc, filet bas #B6B6B6
     actions          13px de haut à 15.5px
     barre d'adresse  28px, fond #F1F3F4, rayon 14px, de 108px à -44px
     cadenas          8 x 10.5 à 122px, URL 14px (#767676 puis #202124)
     menu             3 x 13 à droite, 20.5px
   Le kit dessine ces glyphes en SVG ; le proxy réseau de la session interdit
   figma.com, donc ils sont redessinés à l'identique en CSS (pastilles) et en
   lucide (flèches, cadenas, menu), déjà présents dans le projet.

   Le cadre est fluide : toutes les cotes sont proportionnelles au 1280 du
   fichier, la barre se réduit sous 640px (les actions et le menu s'effacent)
   pour rester lisible sur téléphone. */

const CHROME = {
  tabsBar: '#DFE1E5',
  tabTitle: '#3D4043',
  toolbar: '#FFFFFF',
  separator: '#B6B6B6',
  addressBg: '#F1F3F4',
  urlScheme: '#767676',
  urlHost: '#202124',
};

const TRAFFIC = ['#FF5F57', '#FEBC2E', '#28C840'];

export default function BrowserFrame({
  url,
  title,
  children,
  className = '',
}: {
  url: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[12px] border border-q2-plate bg-white ${className}`}>
      {/* Barre d'onglets */}
      <div
        className="flex items-end gap-2 px-3 pt-2 h-[37px]"
        style={{ backgroundColor: CHROME.tabsBar }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-[6px] pb-[10px] shrink-0">
          {TRAFFIC.map((c) => (
            <span key={c} className="block w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex items-center gap-2 h-[27px] max-w-[256px] min-w-0 flex-1 rounded-t-lg bg-white pl-[14px] pr-2">
          <QwillioLogo size={14} />
          <span
            className="text-[12px] truncate min-w-0"
            style={{ color: CHROME.tabTitle }}
          >
            {title}
          </span>
          <X size={9} className="shrink-0 ml-auto" style={{ color: CHROME.tabTitle }} />
        </div>
        <Plus size={12} className="shrink-0 mb-[11px]" style={{ color: CHROME.tabTitle }} />
      </div>

      {/* Barre d'outils */}
      <div
        className="flex items-center gap-3 px-4 h-[42px]"
        style={{
          backgroundColor: CHROME.toolbar,
          boxShadow: `inset 0 -1px 0 ${CHROME.separator}`,
        }}
        aria-hidden="true"
      >
        <div className="hidden sm:flex items-center gap-[14px] shrink-0" style={{ color: CHROME.urlScheme }}>
          <ArrowLeft size={13} />
          <ArrowRight size={13} />
          <RotateCw size={13} />
        </div>
        <div
          className="flex items-center gap-2 h-[28px] flex-1 min-w-0 rounded-full px-3"
          style={{ backgroundColor: CHROME.addressBg }}
        >
          <Lock size={9} style={{ color: CHROME.urlScheme }} className="shrink-0" />
          <span className="text-[13px] truncate min-w-0">
            <span style={{ color: CHROME.urlScheme }}>https://</span>
            <span style={{ color: CHROME.urlHost }}>{url}</span>
          </span>
        </div>
        <MoreVertical size={13} className="hidden sm:block shrink-0" style={{ color: CHROME.urlScheme }} />
      </div>

      {/* Contenu de la page */}
      <div className="bg-q2-void">{children}</div>
    </div>
  );
}
