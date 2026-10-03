import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

const BASE = 'Qwillio';
const DEFAULT_DESC = 'Qwillio répond à vos appels en français et en anglais, à toute heure. Prise de rendez-vous, qualification des demandes, transfert des urgences.';
/* PNG et non SVG: LinkedIn, Slack, WhatsApp et Teams n'affichent aucun aperçu
   pour une vignette en SVG. Le lien du site partait donc nu partout où il se
   partage, c'est-à-dire partout où il compte. 1200x630, le format attendu. */
const DEFAULT_IMAGE = 'https://qwillio.com/og-image.png';

/* Le titre de repli, celui de la page d'accueil. Il sert aussi au demontage
   (voir le `return`), pour que l'onglet ne reste pas sur le titre d'une page
   qu'on vient de quitter. */
const DEFAULT_TITLE = 'Qwillio, réceptionniste IA en Belgique et en France, 24/7';

/**
 * Le titre complet d'un onglet.
 *
 * POURQUOI LA GARDE. Les pages passent deja leur marque dans le titre
 * (« Questions fréquentes · Qwillio », « Connexion · Qwillio »). Le suffixe
 * etait ajoute sans condition, donc l'onglet et le resultat Google affichaient
 * « Questions fréquentes · Qwillio – Qwillio » sur une bonne dizaine de pages.
 * On ne suffixe que ce qui ne porte pas deja le nom.
 *
 * Le separateur est le point median et non le tiret cadratin: `DA/v2-direction.md`
 * bannit l'em dash, et il etait ici dans le titre de CHAQUE page, c'est-a-dire
 * dans le seul endroit que Google indexe par defaut.
 */
function fullTitleOf(title: string): string {
  if (title === BASE) return DEFAULT_TITLE;
  return /qwillio/i.test(title) ? title : `${title} · ${BASE}`;
}

export function useSEO({ title, description, canonical, ogImage, noindex }: SEOProps) {
  useEffect(() => {
    const fullTitle = fullTitleOf(title);
    document.title = fullTitle;

    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        const attr = selector.includes('[name') ? 'name' : 'property';
        const val = selector.match(/["']([^"']+)["']/)?.[1] || '';
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc = description || DEFAULT_DESC;
    const image = ogImage || DEFAULT_IMAGE;
    const url = canonical || `https://qwillio.com${window.location.pathname}`;

    setMeta('[name="description"]', desc);
    setMeta('[name="robots"]', noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:-1, max-image-preview:large');
    setMeta('[property="og:title"]', fullTitle);
    setMeta('[property="og:description"]', desc);
    setMeta('[property="og:url"]', url);
    setMeta('[property="og:image"]', image);
    setMeta('[name="twitter:title"]', fullTitle);
    setMeta('[name="twitter:description"]', desc);
    setMeta('[name="twitter:image"]', image);

    // Canonical
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, canonical, ogImage, noindex]);
}
