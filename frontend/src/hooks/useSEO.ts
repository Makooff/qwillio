import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

const BASE = 'Qwillio';
const DEFAULT_DESC = 'Your AI receptionist that answers every call, books appointments, and never sleeps. Automate your business 24/7.';
const DEFAULT_IMAGE = 'https://qwillio.com/og-image.svg';

export function useSEO({ title, description, canonical, ogImage, noindex }: SEOProps) {
  useEffect(() => {
    const fullTitle = title === BASE ? BASE + ' – AI Receptionist & Business Automation' : `${title} – ${BASE}`;
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
      document.title = `${BASE} – AI Receptionist & Business Automation`;
    };
  }, [title, description, canonical, ogImage, noindex]);
}
